
## الهدف
استبدال محرك المتأخرات الحالي بنموذج **الرصيد الجاري** (`balance = totalDue − totalPaid`) كمصدر وحيد للحقيقة، وإصلاح تحديث الواجهة الفوري بعد تسجيل أي دفعة، وإضافة `grace_days` لكل وحدة.

---

## 1. قاعدة البيانات (migration واحد)

**أ. ترحيل `opening_balance` إلى دفعات افتتاحية:**
- لكل وحدة فيها `opening_balance > 0`: إنشاء صف في `payments` بمبلغ سالب (`-opening_balance`) بتاريخ `opening_balance_date`، نوع `payment_method='opening'`, وعلم `notes='OPENING_BALANCE_MIGRATION'`، مع `period_start = period_end = opening_balance_date`.
  - أو بديل أنظف: عمود جديد `payments.kind` بقيم `('rent','opening','adjustment')` — وندخل الدفعة الافتتاحية ككين `opening` بمبلغ موجب يُعامَل كـ "due" لا "paid".
  - **القرار**: نختار البديل الثاني لتجنّب المبالغ السالبة المربكة في الإيصالات.
- بعد الترحيل: تصفير `units.opening_balance` و`units.opening_balance_date` وإزالة قيد `protect_unit_opening_balance` (يصبح بلا معنى).

**ب. حقل `grace_days`:**
- `ALTER TABLE units ADD COLUMN grace_days int NOT NULL DEFAULT 0 CHECK (grace_days BETWEEN 0 AND 30)`.

**ج. عمود `payments.kind`:**
- `ALTER TABLE payments ADD COLUMN kind text NOT NULL DEFAULT 'rent' CHECK (kind IN ('rent','opening','adjustment'))`.

**د. تبسيط الـ trigger:**
- استبدال `recompute_unit_state` بنسخة أبسط: تحسب `balance` من `(cycles_due × rent) − sum(payments where kind='rent') + sum(payments where kind='opening')` وتحدّث `units.status` (`paid|upcoming|due|grace|overdue|critical`).
- يبقى الـ trigger لتسريع الفلاتر/الإشعارات في الخلفية فقط — الواجهة لا تعتمد عليه.

---

## 2. محرك حساب موحّد جديد — `src/lib/balance.ts`

استبدال شامل بدالة واحدة:

```ts
calculateUnitBalance(unit, payments, today) → {
  totalDue, totalPaid, balance,
  arrears, credit,
  status: 'paid'|'upcoming'|'due'|'grace'|'overdue'|'critical',
  daysLate,                 // أيام منذ أقدم تاريخ استحقاق غير مدفوع
  nextDueDate, nextDueAmount,
  cycles: [{periodStart, periodEnd, dueDate, rent, label}],  // للإيصالات
}
```

منطق محوري:
- `dueCount` = عدد تواريخ الاستحقاق التي مضت منذ `contract_start_date` حتى `today` بناءً على `due_day` و`rent_timing`.
- `totalDue = dueCount × rent_amount + Σ opening_payments`.
- `totalPaid = Σ payments where kind='rent' && !deleted_at && unit_id=...`.
- `balance = totalDue − totalPaid`.
- الحالة:
  - `balance ≤ 0` → `paid` (مع `credit` لو سالب).
  - `balance > 0` و`today < nextDueDate` → `upcoming`.
  - `today === nextDueDate` → `due`.
  - `today ≤ nextDueDate + grace_days` → `grace`.
  - `balance ≥ 2 × rent` → `critical`.
  - غير ذلك → `overdue`.
- `daysLate` = الفرق بالأيام بين `today` وأقدم `dueDate` غير مغطّى من الرصيد.

الاحتفاظ بـ `getNextDueInfo` و`buildReceiptPeriodLabel` و`distributePayment` (الإيصالات لا زالت تحتاج `period_start/period_end`).

اختبارات vitest جديدة تغطّي: دفعة جزئية، دفعة زائدة (credit)، due_day مخصص، رصيد افتتاحي بعد الترحيل، حالة grace.

---

## 3. إصلاح التحديث الفوري (البق الرئيسي)

السبب: `QuickAddPaymentFab` (الزرّ العائم) يفتح `AddPaymentDialog` بدون أي callback لإخبار الصفحات بإعادة التحميل، وصفحات `BuildingDetail` و`Tenants` لا تستمع لأي حدث.

الحل — **bus بسيط بدون إضافة react-query:**

أ. ملف جديد `src/lib/paymentsBus.ts`:
```ts
type Listener = (unitId?: string) => void;
const listeners = new Set<Listener>();
export const paymentsBus = {
  emit: (unitId?: string) => listeners.forEach(l => l(unitId)),
  subscribe: (l: Listener) => { listeners.add(l); return () => listeners.delete(l); },
};
```

ب. كل دالة حفظ/حذف/تعديل دفعة (`AddPaymentDialog`, `EditPaymentDialog`, `PaymentsTrash`, edge functions client side) تنادي `paymentsBus.emit(unitId)` بعد النجاح.

ج. كل صفحة تعرض رصيداً (`UnitDetail`, `BuildingDetail`, `Tenants`, `Payments`, `Dashboard`, `Reports`) تستخدم hook موحّد:
```ts
useEffect(() => paymentsBus.subscribe(() => load()), []);
```

د. تمرير `onSaved` صراحةً في `QuickAddPaymentFab` لينادي `paymentsBus.emit()` أيضاً (احتياط).

---

## 4. مكونات الواجهة

- **`ArrearsBadge`** → يستهلك `calculateUnitBalance` ويعرض شارة بأحد الألوان الست:
  - `upcoming` slate، `due` gold، `grace` terracotta-light، `overdue` terracotta، `critical` burgundy، `paid` sage.
- **`UnitHealthBadge`** → يبسَّط على نفس مخرجات الدالة الجديدة.
- إضافة شارة "رصيد إيجابي" (credit) في `UnitDetail` و`BuildingDetail`.
- في `EditUnitDialog` و`AddUnitDialog`: حقل `grace_days` (Input number 0–30، افتراضي 0، مع شرح "عدد أيام السماح بعد تاريخ الاستحقاق").

---

## 5. تنظيف

- إزالة `opening_balance` UI من كل المربعات (حقول، تحذيرات، شارات "متأخرات سابقة" في `ArrearsBadge`).
- حذف الكود الخاص بـ `priorPaid` و"single-day payments" في `balance.ts` (لم يعد له معنى بعد الترحيل).
- تحديث `protect_unit_opening_balance` → حذفه.
- اختبار `balance-arrears.test.ts` يُعاد كتابته للسيناريوهات الجديدة.

---

## 6. الإشعارات (المرحلة 9 من الطلب)

**غير مشمولة الآن** — تتطلب جدول قوالب + cron + بوابة SMS/WhatsApp مدفوعة. سأقترحها كخطوة لاحقة بعد تثبيت النواة.

---

## الملفات المتأثرة

```
supabase migration (واحد)
src/lib/balance.ts                         ← إعادة كتابة جزئية
src/lib/paymentsBus.ts                     ← جديد
src/components/AddPaymentDialog.tsx        ← emit + إزالة منطق opening_balance
src/components/EditPaymentDialog.tsx       ← emit
src/components/QuickAddPaymentFab.tsx      ← emit
src/components/ArrearsBadge.tsx            ← منطق الحالات الستّ
src/components/UnitHealthBadge.tsx         ← مبسّط
src/components/EditUnitDialog.tsx          ← حقل grace_days
src/components/AddUnitDialog.tsx           ← حقل grace_days
src/pages/UnitDetail.tsx                   ← subscribe + استهلاك calculateUnitBalance
src/pages/BuildingDetail.tsx               ← subscribe
src/pages/Tenants.tsx                      ← subscribe
src/pages/Payments.tsx                     ← subscribe
src/pages/Dashboard.tsx                    ← subscribe
src/pages/Reports.tsx                      ← استخدام الدالة الجديدة
src/test/balance-arrears.test.ts           ← إعادة كتابة
```

هل أبدأ بهذه الخطة كاملة، أم تريد تقسيمها (1=migration+balance.ts، 2=bus+UI، 3=grace_days) لتراجع كل مرحلة على حدة؟
