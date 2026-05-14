# إصلاح ملاحظة "متبقي إيجار هذا الشهر"

## المشكلة
في بطاقة الوحدة بصفحة المبنى تظهر ملاحظة **"متبقي إيجار هذا الشهر"** للمستأجر فيجاكومار سبرامنيان رغم أن عقده يبدأ في 1/6/2026 (لم يبدأ بعد).

السبب: حساب `monthRemaining` في `src/pages/BuildingDetail.tsx` (سطر 253) يعتمد فقط على وجود اسم مستأجر ونوع إيجار شهري ومبلغ > 0، ولا يأخذ بعين الاعتبار `contract_start_date` ولا حالة الوحدة `soon`.

## الإصلاح المقترح
في `src/pages/BuildingDetail.tsx` داخل تعريف `monthRemaining`، إضافة شرطين:

1. وجود `contract_start_date` وأن يكون ≤ اليوم.
2. حالة الوحدة ليست `soon` ولا `vacant` (أي العقد فعّال).

```ts
const contractStarted =
  !!u.contract_start_date && new Date(u.contract_start_date) <= today;
const isActive = u.status !== "soon" && u.status !== "vacant";

const monthRemaining =
  u.tenant_name && u.rent_type === "monthly" && monthRent > 0 && contractStarted && isActive
    ? Math.max(0, monthRent - monthPaid)
    : 0;
```

نفس المنطق `computeBalance` (الذي يحسب `outstanding_balance` المعروض فوق الملاحظة) يعتمد على عدد الفترات المنقضية منذ `contract_start_date`، فهو يُرجع 0 تلقائياً للعقود المستقبلية — لذا لا يحتاج تعديل.

## ملاحظة جانبية
صفحة `MonthlyCollection.tsx` تتعامل مع الأمر بشكل صحيح بالفعل (تُصفّي الوحدات حسب `contract_start_date <= month.end`)، لذا لا تحتاج تغييراً.

## الملفات المعدّلة
- `src/pages/BuildingDetail.tsx` — تعديل سطر واحد لشرط `monthRemaining`.
