## عرض نمط الدفع (مُقدّم/مُؤخّر) في واجهة المستخدم

### الملخص
إظهار قيمة `rent_timing` (مُقدّم advance / مُؤخّر arrears) بجانب بيانات كل وحدة في قائمة شقق المبنى، وفي صفحة تفاصيل المستأجر (تبويب التفاصيل) ضمن بيانات الإيجار.

### التغييرات

1. **صفحة تفاصيل المبنى (`src/pages/BuildingDetail.tsx`)**
   - الموقع: داخل بطاقة الوحدة في قائمة الشقق، بجانب سطر نوع الإيجار والمبلغ.
   - التنفيذ: إضافة `· {t2(u.rent_timing === "arrears" ? "rent_timing_arrears" : "rent_timing_advance")}` إلى النص الفرعي الذي يعرض نوع الإيجار (`u.rent_type`).
   - الموقع المحدد: السطر 281 تقريباً ضمن `<p className="text-xs text-muted-foreground">`.

2. **صفحة تفاصيل الوحدة/المستأجر (`src/pages/UnitDetail.tsx`)**
   - الموقع: داخل بطاقة "مبلغ الإيجار" (DetailsTab → Card الثالث) بجانب `rent_amount` و `rent_type`.
   - التنفيذ: إضافة صف `Row` جديد داخل البطاقة يعرض `t2("rent_timing")` مع القيمة المناسبة (`rent_timing_advance` أو `rent_timing_arrears`).
   - الموقع المحدد: بين السطر 394 (rent_amount) والسطر 395 (DueDateRow).

### ملاحظات
- الحقل `rent_timing` مُحمل مسبقاً في كلا الملفين (`rent_timing` في `BuildingDetail`، و`*` في `UnitDetail`).
- الترجمات موجودة مسبقاً في `i18n2.tsx`: `rent_timing_advance` / `rent_timing_arrears`.
- لا حاجة لتعديل قاعدة البيانات أو API.
