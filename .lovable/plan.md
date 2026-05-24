# خطة التنفيذ

ربط احتساب موعد الاستحقاق وفترة الإيصال بتاريخ بداية العقد ونمط الدفع، بدلاً من الاعتماد على «يوم الاستحقاق» كرقم منفصل.

## السلوك المستهدف

- **مؤخّر، عقد يبدأ 10/1/2026:** الاستحقاق 10/2/2026 — نص الإيصال «إيجار الفترة من 10/1/2026 إلى 9/2/2026».
- **مقدّم، عقد يبدأ 1/1/2026:** الاستحقاق 1/1/2026 — نص الإيصال «إيجار شهر 1/2026».

## التغييرات

### 1. `src/lib/balance.ts`
- تعديل `periodsElapsed` لاستخدام **يوم بداية العقد** (مثلاً اليوم 10) كنقطة قطع للفترة الشهرية، بدل افتراض اليوم الأول.
- إضافة دالة `getNextDueInfo(unit, payments)` تُرجع:
  - `nextDueDate` — تاريخ الدفعة القادمة
  - `periodStart` / `periodEnd` — حدود الفترة المستحقة
  - `receiptLabel` — نص جاهز للإيصال حسب النمط
- نقطة المرجع: `opening_balance_date` إن وُجد، وإلا `contract_start_date`.

### 2. `src/components/AddPaymentDialog.tsx` و `EditPaymentDialog.tsx`
- عند فتح الحوار، نملأ تلقائياً: `period_start`, `period_end`, و«ملاحظة الإيصال» من `getNextDueInfo`.
- اقتراح المبلغ = `rent_amount` للفترة الواحدة، مع إمكانية التعديل.

### 3. واجهات الوحدة (`AddUnitDialog`, `EditUnitDialog`, `NewTenancyDialog`)
- إخفاء حقل **«يوم الاستحقاق»** المنفصل.
- مزامنة `due_day` تلقائياً من يوم `contract_start_date` عند الحفظ (للتوافق العكسي).
- إبقاء أزرار نمط الدفع (مقدّم/مؤخّر) كما هي.
- إضافة سطر تنبيه: «يُحتسب موعد الاستحقاق تلقائياً من تاريخ بداية العقد ونمط الدفع».

### 4. `src/lib/pdfDocs.ts`
- استخدام `receiptLabel` الموحّد في إيصالات PDF.

### 5. عرض «الاستحقاق القادم»
- في `src/pages/UnitDetail.tsx` و `src/pages/MonthlyCollection.tsx`: إظهار تاريخ الاستحقاق القادم بصيغة جديدة («مؤخّر — تستحق في 10/2» / «مقدّم — تستحق في 1/2»).

### 6. `src/lib/i18n2.tsx`
مفاتيح جديدة:
- `next_due_on`: «الاستحقاق القادم»
- `receipt_period_advance`: «إيجار شهر {month}»
- `receipt_period_arrears`: «إيجار الفترة من {start} إلى {end}»
- `due_auto_hint`: «يُحتسب موعد الاستحقاق تلقائياً من تاريخ بداية العقد».

## التحسينات الإضافية المُضمَّنة

- **اقتراح تلقائي للفترة والمبلغ** في حوار إضافة دفعة (الاقتراح #2).
- **شارة بصرية** في بطاقة الوحدة توضّح النمط وموعد الاستحقاق القادم (الاقتراح #3).

> تم تأجيل: فترة السماح (#1) وتنبيهات واتساب قبل الاستحقاق (#4) — يمكن إضافتها لاحقاً عند الطلب.

## الملفات المعدّلة

- `src/lib/balance.ts`
- `src/lib/i18n2.tsx`
- `src/lib/pdfDocs.ts`
- `src/components/AddPaymentDialog.tsx`
- `src/components/EditPaymentDialog.tsx`
- `src/components/AddUnitDialog.tsx`
- `src/components/EditUnitDialog.tsx`
- `src/components/NewTenancyDialog.tsx`
- `src/pages/UnitDetail.tsx`
- `src/pages/MonthlyCollection.tsx`

## ملاحظات

- لا حاجة إلى migration: نستخدم الأعمدة الموجودة (`contract_start_date`, `rent_timing`, `opening_balance_date`, `due_day`).
- منطق المتأخرات الحالي في `computeBalance` يبقى صحيحاً مع التعديل على `periodsElapsed`.
