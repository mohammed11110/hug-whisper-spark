
## الهدف
عند تسجيل دفعة جزئية لشهر سابق (المدفوع < إيجار الشهر)، يجب أن يظهر الفرق كمتأخر **لذلك الشهر تحديداً**، مع شارة موجزة بجانب اسم المستأجر تذكر الشهر الأقدم غير المسدَّد والمبلغ، وتُحدَّث تلقائياً مع بداية كل شهر جديد.

## التغييرات

### 1) منطق الحساب (مصدر الحقيقة) — `src/lib/balance.ts`
أضف دالّة جديدة `getUnitArrears(unit, payments, asOf)` تُرجع:
- `cycles[]`: لكل دورة مستحقة منذ المرسى حتى تاريخ اليوم → `{ periodStart, periodEnd, label, rent, paid, shortfall, status: 'paid'|'partial'|'unpaid' }`
- `oldestUnpaid`: أول دورة فيها `shortfall > 0` (سواء كانت `unpaid` أو `partial`)
- `totalShortfall`: مجموع `shortfall` لكل الدورات المستحقّة
- `unpaidCount`: عدد الدورات التي بها متبقٍّ

طريقة التجميع: لكل دورة (محسوبة عبر `getCycleByStartMonth` ابتداءً من `anchor`)، نجمع `amount` لكل الدفعات التي تقع `period_start` فيها داخل نطاق الدورة. الدورة المستحقّة فقط (`advance`: بدأت ≤ اليوم؛ `arrears`: انتهت < اليوم) تُدرج في المتأخرات.

لا نغيّر `computeBalance` ولا `overdueCyclesCount`؛ نُبنى عليهما.

### 2) شارة المتأخرات بجانب اسم المستأجر
مكوّن جديد `src/components/ArrearsBadge.tsx`:
- إدخال: `unit` + `payments`
- يعرض شارة موجزة باللون البرغندي:
  - دورة واحدة: «متأخر: مايو 2026 − 50 ر.ع»
  - أكثر من دورة: «متأخر: مايو 2026 +N − 120 ر.ع»
- صامتة (لا تُعرض) إذا لا يوجد متبقٍّ.

يُستعمل في:
- `src/pages/BuildingDetail.tsx` (بطاقة الوحدة، بجانب اسم المستأجر)
- `src/pages/UnitDetail.tsx` (تحت اسم المستأجر مباشرة)
- `src/pages/Tenants.tsx` (صفّ المستأجر)

### 3) حوار إضافة دفعة جديدة — `src/components/AddPaymentDialog.tsx`
- جلب الدفعات الحالية للوحدة (مع `period_start, period_end, amount`) عند الفتح.
- استدعاء `getUnitArrears` لحساب الأشهر الناقصة.
- بانر إعلامي أعلى الحوار (برغندي خفيف) يعرض:
  - «متأخرات سابقة: مايو 2026 − نقص 50 ر.ع» (وإن وُجد أكثر، قائمة قصيرة بأول 3 + «و N أخرى»).
- في قائمة الشهور المنسدلة، نُضيف وسماً صغيراً «جزئي − نقص X» للأشهر التي فيها دفعة سابقة لكن أقل من الإيجار، حتى يفهم المستخدم سياق اختياره.
- إزالة أي تحقق يمنع `amount < rent` (إن وُجد)، والسماح صراحةً بحفظ دفعة جزئية لشهر مختار.

نفس البانر يُضاف في `src/components/EditPaymentDialog.tsx` للسياق.

### 4) الإشعارات / المتأخرات الشهرية
- `src/pages/Notifications.tsx` و `src/pages/MonthlyCollection.tsx`: اعتماد `getUnitArrears` لإظهار الشهر تحديداً (مايو 2026 − نقص 50 ر.ع) بدل «متأخر» المجرّد. تحديث تلقائي مع بداية كل شهر بالاعتماد على `asOf = new Date()`.

### 5) الاختبارات — `src/lib/balance.test.ts`
- وحدة إيجار 200 شهرياً، مرسى 2026‑04‑01، دفعة جزئية 150 على فترة أبريل، تاريخ اليوم 2026‑05‑24 → `unpaidCount = 2` (أبريل نقص 50 + مايو 200)، `oldestUnpaid = أبريل`، `totalShortfall = 250`.
- وحدة بدفعة كاملة لشهر سابق ودفعة جزئية لشهر تالٍ → الشهر التالي يظهر بشارة جزئية.
- بدون متأخرات → `unpaidCount = 0` ولا شارة.

## ملفات متأثرة
- `src/lib/balance.ts` (إضافة `getUnitArrears`)
- `src/lib/balance.test.ts` (اختبارات جديدة)
- `src/components/ArrearsBadge.tsx` (جديد)
- `src/components/AddPaymentDialog.tsx`
- `src/components/EditPaymentDialog.tsx`
- `src/pages/BuildingDetail.tsx`
- `src/pages/UnitDetail.tsx`
- `src/pages/Tenants.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/MonthlyCollection.tsx`

## بدون تغييرات على قاعدة البيانات
كل المنطق مشتقّ من جدول `payments` الحالي عبر `period_start`/`amount`، لا حاجة لمايجريشن.
