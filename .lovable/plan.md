# خطة شاملة — نظام العقود والمتأخرات والمدفوعات

## ملاحظة مهمة على المعمارية الموجودة
الجدول المطلوب `leases` موجود فعلاً باسم `tenancies` بنفس الأعمدة المطلوبة تماماً (id, unit_id, tenant_name, tenant_phone, tenant_id_number, rent_amount, due_day, contract_start_date, contract_end_date/ended_at, status, opening_balance). `payments.tenancy_id` موجود وممتلئ عبر backfill + trigger من التحديث الأخير. سنبني الإصلاح فوق هذه البنية بدلاً من إنشاء جدول مكرر يكسر البيانات والكود.

سنضيف فقط ما ينقص: `grace_days`, `paid_up_to`, جدول `lease_adjustments`، ومنطق "الرصيد الجاري" كمصدر وحيد للحقيقة.

---

## 1) قاعدة البيانات (migration واحدة)

### إضافات على `tenancies`
- `paid_up_to date` (آخر شهر تم سداده فعلاً قبل إنشاء العقد — لا يحتسب ما قبله كمتأخرات).
- `grace_days integer NOT NULL DEFAULT 0`.

### جدول جديد `lease_adjustments`
أعمدة: `id, tenancy_id, amount (موجب=خصم/إعفاء، سالب=إضافة دين), reason text, created_by, created_at`.
- GRANT للأدوار الثلاثة + RLS عبر `has_building_access` على `tenancies.building_id`.
- سياسات: قراءة للأعضاء، كتابة للمحاسبين والمالك.

### تنظيف الحقول المخزّنة بشكل خاطئ
- إيقاف الاعتماد على `units.status` كمصدر مالي (نُبقي العمود للتوافق، لكن لا نقرأه في الحسابات).
- إضافة index: `idx_payments_tenancy_active ON payments(tenancy_id) WHERE deleted_at IS NULL`.

### تحديث `recompute_unit_state`
يحذف ما تبقّى من منطق "العدّ بالصفوف" ويستبدله بصيغة الرصيد الجاري المعرّفة في القسم 2، مع احترام `paid_up_to` و`lease_adjustments`.

---

## 2) المصدر الوحيد للحقيقة — `src/lib/balance.ts`

دالة واحدة `getLeaseArrears(lease, payments, adjustments, today)` تُعيد:
```
{ status, balance, totalDue, totalPaid, totalAdjustments,
  monthsLate, fromMonth, upToMonth, credit, daysLate, dueDates[] }
```

الخوارزمية:
1. `anchorDate = lease.paid_up_to || lease.contract_start_date`.
2. بناء `dueDates[]` من `anchorDate` حتى اليوم بخطوة شهر على `due_day` (مع `LEAST(28, due_day)` لتفادي شهور قصيرة).
3. `totalDue = dueDates.length * rent + opening_balance`.
4. `totalPaid = Σ amount` للإيصالات حيث `tenancy_id === lease.id` و`deleted_at IS NULL` (جمع المبالغ، لا الصفوف).
5. `totalAdjustments = Σ amount` للتعديلات على نفس العقد.
6. `balance = totalDue − totalPaid − totalAdjustments`.
7. `status`:
   - `balance <= 0.009` → `paid` (مع `credit = |balance|` إن كان سالباً).
   - `balance >= 2 * rent` → `critical`.
   - قبل `due_day` للشهر الحالي → `upcoming`.
   - في يوم الاستحقاق → `due`.
   - ضمن `grace_days` بعده → `grace`.
   - بعد ذلك → `overdue`.
8. `monthsLate = Math.ceil(balance / rent)`، `upToMonth = dueDates.at(-1)`, `fromMonth = dueDates[len − monthsLate]`.

تُهجَّر دوال `getUnitArrears` و`calculateUnitBalance` لتستدعي `getLeaseArrears` تحت الغطاء (توقيع متوافق رجعياً).

إزالة كل المسارات المكسورة:
- ❌ `payments.length > 0 → paid`
- ❌ `units.update({status:'paid'})` بعد إدخال إيصال
- ❌ `paid = payments.length × rent`
- ❌ أي فلترة بـ `unit_id` فقط

---

## 3) دورة حياة العقد

### إخلاء الوحدة (`EndTenancyDialog` — موجود، يحتاج تثبيت)
- `tenancies.status='ended'`, `ended_at=today`, تسجيل `outstanding_at_end = balance`.
- مسح حقول المستأجر من `units` + `status='vacant'`.
- **الإيصالات لا تُمسّ** — تبقى مرتبطة بالعقد المنتهي.

### تسجيل مستأجر جديد (`NewTenancyDialog` — موجود، نضيف حقلين)
- إضافة حقلَي `paid_up_to` و`opening_balance` في النموذج.
- إنشاء عقد جديد `status='active'` بـ `tenancy_id` جديد.
- الإيصالات الجديدة تُربط تلقائياً عبر `payments_autofill_tenancy` trigger (موجود).

### "تعديل الرصيد" — مكوّن جديد `AdjustBalanceDialog`
- موجود فعلاً كملف، يُعاد تأهيله ليكتب في `lease_adjustments` بدلاً من تعديل `opening_balance`.
- يطلب: المبلغ (موجب=إعفاء، سالب=إضافة)، السبب (مطلوب).
- يظهر كصفّ شفّاف في "كشف الحساب" بشارة "تعديل".

---

## 4) واجهة المستخدم

### في كل المستدعين (تمرير العقد النشط)
الملفات: `ArrearsBadge`, `UnitHealthBadge`, `EndTenancyDialog`, `EditPaymentDialog`, `AddPaymentDialog`, `UnitDetail`, `Tenants`, `Payments`, `Reports`, `Notifications`, `Dashboard`.

- تحميل خريطة `unitId → activeLease` (استعلام واحد على `tenancies` حيث `status='active'`).
- استدعاء `getLeaseArrears(activeLease, payments, adjustments, today)`.
- تمرير `adjustments` (استعلام جديد على `lease_adjustments`).

### شارة "متأخر من شهر إلى شهر" (`ArrearsBadge`)
- استخدام `fromMonth → upToMonth` من النتيجة.
- ألوان: `upcoming` رمادي/أزرق، `due` ذهبي، `grace` تيراكوتا فاتح، `overdue` تيراكوتا، `critical` بورجندي، `paid` سيج، `credit` ذهبي بنبضة.

### قسم "سجل العقود" على صفحة الوحدة (`UnitDetail`)
- جدول للعقود `status='ended'`: اسم المستأجر، الفترة، إجمالي المدفوع، `outstanding_at_end`، حالة الوديعة.
- زر "عرض الإيصالات" يفتح Drawer للقراءة فقط لإيصالات ذلك العقد.

### "كشف الحساب" للعقد النشط
- جدول موحّد: استحقاقات شهرية + إيصالات + تعديلات، مرتبة زمنياً، مع عمود "الرصيد الجاري" بعد كل صف.

---

## 5) التحديث الفوري (Instant UI)

كل من: إضافة إيصال، تعديل، حذف/استرجاع، إخلاء، تسجيل جديد، تعديل رصيد:
```ts
queryClient.invalidateQueries(['tenancies'])
queryClient.invalidateQueries(['units'])
queryClient.invalidateQueries(['payments'])
queryClient.invalidateQueries(['lease_adjustments'])
paymentsBus.emit(unitId)
```
موجود جزئياً عبر `paymentsBus` — نُكمل التغطية.

---

## 6) اختبارات Vitest جديدة

ملف `src/test/lease-arrears.test.ts`:
- متأخرات 300، دفع 100 → balance=200, status='overdue', monthsLate=1.
- سداد كامل → 'paid' فورياً.
- مرور `due_date` → +1 شهر متأخر تلقائياً.
- دفع زائد → credit.
- مستأجر جديد بـ `paid_up_to=2025-12-31` → متأخرات تبدأ من يناير 2026.
- إخلاء + مستأجر جديد → الرصيد صفر، لا يرى إيصالات العقد السابق.
- تعديل رصيد إعفاء 50 → balance ينقص 50.

تحديث `src/test/balance-arrears.test.ts` ليستخدم التوقيع الجديد.

---

## القسم التقني (للمراجعة)

### ملفات تتغيّر
- **migration جديد**: `tenancies` (+`paid_up_to`, `grace_days`) + جدول `lease_adjustments` + RLS/GRANT + index + `recompute_unit_state` محدّث.
- `src/lib/balance.ts` — دالة `getLeaseArrears` + توافق رجعي.
- `src/lib/leases.ts` (جديد) — helpers لتحميل العقد النشط والتعديلات بدفعة واحدة.
- `src/components/AdjustBalanceDialog.tsx` — يكتب في `lease_adjustments`.
- `src/components/NewTenancyDialog.tsx` — حقول `paid_up_to` + `opening_balance` + `grace_days`.
- `src/components/EndTenancyDialog.tsx` — تثبيت `outstanding_at_end` من `getLeaseArrears`.
- `src/components/ArrearsBadge.tsx`, `UnitHealthBadge.tsx` — استهلاك النتيجة الجديدة.
- `src/pages/UnitDetail.tsx` — سجل العقود + كشف حساب موحّد.
- `src/pages/Tenants.tsx`, `Payments.tsx`, `Reports.tsx`, `Notifications.tsx`, `Dashboard.tsx` — تمرير العقد النشط + التعديلات.
- اختبار جديد `src/test/lease-arrears.test.ts` + تحديث `balance-arrears.test.ts`.

### ما لا يتغيّر
- لا حذف ولا تعديل لأي إيصال قديم.
- جدول `tenancies` يبقى بنفس الاسم (الـ "lease" المطلوب).
- صلاحيات RLS وسياسات الـ grace كما هي.
- المذكّرات (قسم 13) تُؤجَّل لما بعد استقرار النواة.

## معايير القبول
كل الاختبارات في "ACCEPTANCE TESTS" أعلاه تمر، مع تأكيد بصري على شاشتَي `UnitDetail` و`Tenants`.
