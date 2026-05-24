## الهدف
تعريف موحَّد للمتأخرات في كل التطبيق:

```
متأخرات الوحدة = opening_balance (الرصيد الافتتاحي = متأخرات سابقة)
               + Σ (إيجار الدورة − المدفوع لها)   لكل دورة مستحقة منذ المرسى
```

«مستحقة» = حسب نمط الوحدة:
- `advance` → الدورة الجارية تُحتسب فور بدايتها.
- `arrears` → الدورة لا تُحتسب إلا بعد انتهائها.

تُحدَّث تلقائياً مع بداية كل شهر (الاعتماد على `asOf = new Date()`).

## التغييرات

### 1) `src/lib/balance.ts` — توسيع `getUnitArrears`
- إضافة حقل `openingBalance: number` للنتيجة، يُحسب من `unit.opening_balance` (≥ 0).
- إذا كان `> 0` نُضيف عنصراً افتراضياً في رأس `cycles[]` بـ:
  - `label`: «متأخرات سابقة» / "Prior arrears"
  - `rent = openingBalance`, `paid = 0`, `shortfall = openingBalance`, `status = "unpaid"`
  - `periodStart/End = opening_balance_date` (للترتيب الزمني فقط)
- `totalShortfall` يصبح: `openingBalance + Σ shortfall للدورات`.
- `unpaidCount`: يشمل عنصر المتأخرات السابقة إن وُجد.
- `oldestUnpaid`: المتأخرات السابقة أولاً ثم أقدم دورة بها نقص.
- شارة الإشعار في `ArrearsBadge` تبقى كما هي (تعرض oldestUnpaid + totalShortfall + N).

### 2) حذف/استبدال أي حساب متضارب — مصدر واحد
كل ما يلي يصبح من `getUnitArrears(...).totalShortfall` بدل `computeBalance(...).outstanding`:

| ملف | السطر | الاستبدال |
|---|---|---|
| `src/pages/UnitDetail.tsx` | 315, 454-455 | استخدم `getUnitArrears(unit, payments).totalShortfall` لعرض «الرصيد المتبقي». لا حاجة لـ `priorArrears` المنفصل (السطور 73-77, 209) → احذفه لأن opening_balance يغطّي. |
| `src/pages/BuildingDetail.tsx` | 258 | احذف `computeBalance` غير المستعمل (شارة المتأخرات تستعمل getUnitArrears أصلاً). |
| `src/pages/Tenants.tsx` | 14, 60, 139-155, 175-207, 269, 340, 374-393 | استبدل كل `r.outstanding` بـ `r.arrears` (= totalShortfall). أزل `computeBalance` و`priorArrears` (السطر 60). الفرز/التصفية/البار بحسب arrears. |
| `src/pages/Payments.tsx` | 18, 119-120 | `getUnitArrears(u, allPays).totalShortfall` بدل `computeBalance`. |
| `src/pages/Notifications.tsx` | 12, 58, 66-69 | أزل `computeBalance` و`isUnitOverdue`؛ المتأخر = `arrears.totalShortfall > 0.009`، و`remaining = arrears.totalShortfall`. |
| `src/pages/MonthlyCollection.tsx` | 380 | KPI «الرصيد المتبقي» = arrears.totalShortfall. |
| `src/components/AddPaymentDialog.tsx` | 140-171 | استبدل `computeBalance` بـ `getUnitArrears`؛ احذف منطق `tenancies.outstanding_at_end` (سطور 140-155) لأن opening_balance المُرحَّل عند إنهاء الإيجار يغطّيه ضمن نفس المعادلة، فلا نضاعفه. |
| `src/components/EndTenancyDialog.tsx` | 12, 36, 54-55, 69-149 | استبدل `computeBalance` بـ `getUnitArrears`؛ `outstanding = arrears.totalShortfall`. |
| `src/lib/pdfDocs.ts` | 235, 594-595, 1043 | بقاء العرض كما هو، لكن المُمرَّر إلى `totals.outstanding`/`unpaidTotal` يأتي من `getUnitArrears`. |

### 3) تعريف انتقالي — لا نحذف `computeBalance`
لتفادي كسر اختبارات الإيصالات والـ PDF القديمة:
- نُبقي `computeBalance` و`overdueCyclesCount` و`isUnitOverdue` كدوال مساعدة داخلية.
- لكنّ كل **واجهات الاستخدام** الموضّحة أعلاه تتحوّل إلى `getUnitArrears`. مصدر الحقيقة على الشاشات = arrears فقط.

### 4) `src/lib/balance.test.ts`
- اختبار: opening_balance = 100، إيجار 200، مرسى 2026‑04‑01، دفعة جزئية 150 على أبريل، اليوم 2026‑05‑24 →
  - `unpaidCount = 3` (سابقة + أبريل نقص 50 + مايو 200)
  - `totalShortfall = 350`
  - `oldestUnpaid.label = "متأخرات سابقة"`
- اختبار: opening_balance = 0 ودفعات كاملة → `unpaidCount = 0` و `totalShortfall = 0`.
- اختبار `arrears` timing: لا تُدرج الدورة الحالية ما لم تنتهِ.

## ملفات متأثرة
- `src/lib/balance.ts`
- `src/lib/balance.test.ts`
- `src/components/ArrearsBadge.tsx` (لا تغيير منطقي، يستفيد تلقائياً)
- `src/pages/UnitDetail.tsx`
- `src/pages/BuildingDetail.tsx`
- `src/pages/Tenants.tsx`
- `src/pages/Payments.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/MonthlyCollection.tsx`
- `src/components/AddPaymentDialog.tsx`
- `src/components/EndTenancyDialog.tsx`

## بدون تغييرات على قاعدة البيانات.
