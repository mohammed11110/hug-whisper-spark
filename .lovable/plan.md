## السبب
دالّتا `computeBalance` و`overdueCyclesCount` في `src/lib/balance.ts` تجمعان **كل** الدفعات (بما فيها ما تمّ قبل الـ anchor)، بينما المتراكم (`accrued`) يُحسب فقط من الـ anchor. النتيجة: الدفعات القديمة تسدّد دورات مستقبلية وهميّاً، فتختفي المتأخرات الحقيقيّة.

`getNextDueInfo` يطبّق الفلتر الصحيح بالفعل (يستثني الدفعات الأقدم من `opening_balance_date`). سنطبّق نفس المبدأ في الدالّتين الأخريين.

## التغييرات

### 1) `src/lib/balance.ts` — `computeBalance`
- قراءة `anchorIso = unit.opening_balance_date || unit.contract_start_date`.
- عند جمع `paid`: استثناء أي دفعة `payment_date < anchorIso` (نفس الفلتر الموجود في `getNextDueInfo`).
- بقيّة المنطق بدون تغيير. `opening_balance` يبقى كما هو ويمثّل الرصيد المتبقّي عند الـ anchor.

### 2) `src/lib/balance.ts` — `overdueCyclesCount`
نفس الفلتر على `paid`، حتى يعطي `isUnitOverdue` و`Notifications` نتيجة صحيحة.

### 3) اختبارات `src/lib/balance.test.ts`
حالة جديدة مطابقة لـ V1:
- وحدة `arrears`، إيجار 200، `opening_balance_date=2026-04-01`
- دفعة فترتها مارس (`period_end=2026-03-31`، `payment_date=2026-05-04`)
- لا توجد دفعة لأبريل
- في 24/5: `outstanding=200`، `overdueCyclesCount=1`، `isUnitOverdue=true`

### 4) لا تغييرات في صفحات العرض
كلّها تعتمد على هذه الدوال — ستظهر المتأخرات تلقائياً.

## النتيجة المتوقّعة للـ V1
- بطاقة الوحدة في `/buildings/V2`: «الرصيد المستحق: 200 ر.ع.»، وشارة «متأخر».
- Tenants / Notifications: تظهر ضمن «متأخرون».
- B2 #06 السابقة تبقى صحيحة (outstanding=0) لأنّ دفعتها تغطّي أبريل والـ anchor مايو 1.

## الملفات المتأثّرة
- `src/lib/balance.ts`
- `src/lib/balance.test.ts`
