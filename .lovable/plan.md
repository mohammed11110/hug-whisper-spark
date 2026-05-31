## الهدف
عرض **فترة الإيجار على إيصال الاستلام** (PDF + الـ HTML المعروض داخل قائمة الدفعات) وفق القاعدة المعتمدة، مع كتابتها بعربية سليمة متّصلة واتجاه صحيح للأرقام والتواريخ.

## القاعدة (تذكير)

| بداية العقد | نص الفترة على الإيصال |
|---|---|
| اليوم 1 من الشهر | "شهر يونيو 2026" — اسم الشهر كاملاً |
| أي يوم D ≠ 1 | "من 10/1/2026 إلى 9/2/2026" |
| الشهر التالي أقصر | يُقصّ على آخر يوم (مثال 31/1 → 28/2) |

النص يُبنى مرّة واحدة عبر `formatCycleLabel` / `getCycleForPeriodStart` الموجودَين في `src/lib/balance.ts`، فيتطابق ما في الإيصال مع ما هو محفوظ.

## التغييرات

### 1) `src/pages/Payments.tsx` — مصدر التسمية على الإيصال
- حذف `monthLabel(dateStr)` المحلية التي تطبع "مايو 2026" دائماً من `period_start` بصرف النظر عن يوم بداية العقد.
- تمرير كائن الوحدة الكامل داخل `Row` (نحتاج `contract_start_date`, `due_day`, `rent_timing`, `rent_amount`، إلخ — معظمها مجلوب أصلاً في `load()`).
- إنشاء `cycleLabel(row, lang)` يستدعي `getCycleForPeriodStart(unit, row.period_start, lang)` ويرجع النص الموحَّد.
- استبدال الاستخدامات الثلاثة:
  - `buildReceiptHTML` (السطر 276) → `cycleLabel`
  - بطاقة الدفعة (السطر 437) → `cycleLabel`
  - تصدير CSV `rent_month` (السطر 353) → `cycleLabel`

### 2) `src/lib/pdfDocs.ts` — كتابة عربية متّصلة + اتجاه صحيح
- `periodLabel` يُمرَّر جاهزاً من المُتّصلين (`AddPaymentDialog`، `Payments`، `UnitDetail`). لا حساب جديد هنا.
- لفّ التواريخ الرقمية داخل `<bdi dir="ltr">…</bdi>` في الفقرة العربية (السطر 555) وفي بطاقة "عن فترة الإيجار" (573) وصف جدول البنود (581)، حتى لا تنعكس "10/1/2026 → 9/2/2026" داخل سياق RTL.
- استبدال السهم `→` بكلمة "إلى" داخل النص العربي وبسهم `–` في النص الإنجليزي حتى يظهر بخطّ متّصل ومألوف بلا اعتماد على رمز قد يُكسر الاتصال البصري.
- التأكد من ضبط `lang="ar"` و`dir="rtl"` على عنصر الفقرة المُتضمِّن للنص + استخدام خط `Noto Kufi Arabic` المُعرَّف بالفعل في `pdfDocs.ts` لضمان التشكيل المتّصل.

### 3) `src/components/AddPaymentDialog.tsx`
- لا تغيير في المنطق؛ فقط التأكد أن `primaryPeriodLabel` المُرسَل لـ `ReceiptData.periodLabel` يأتي من `formatCycleLabel` (موجود). نتحقق من السطر 452 و666.

### 4) `src/pages/UnitDetail.tsx` — سجلّ الدفعات + إيصال إعادة الطباعة
- استبدال أي اشتقاق محلي للشهر من `period_start` بـ `getCycleForPeriodStart(unit, p.period_start, lang)` للوحدة الحالية.
- عند إعادة طباعة إيصال قديم: تمرير `periodLabel` المحسوب من نفس الدالة إلى `buildReceiptHTML`.

### 5) `src/components/EditPaymentDialog.tsx`
- بالفعل يستخدم `getCycleForPeriodStart` (تمّ سابقاً) — لا تغيير.

### 6) اختبارات (`src/test/balance-arrears.test.ts`)
- التأكد من أن `getCycleForPeriodStart` تعطي:
  - بداية 10/1/2026 → "من 10/1/2026 إلى 9/2/2026"
  - بداية 15/3/2026 → "من 15/3/2026 إلى 14/4/2026"
  - بداية 1/6/2026 → "يونيو 2026"
  - بداية 31/1/2026 → ينتهي 28/2/2026 (أو 29/2 في الكبيسة)

## ملاحظات
- لا تغييرات على قاعدة البيانات.
- مصدر التسمية واحد لكل المسارات: AddPayment + EditPayment + Payments list + UnitDetail history + Receipt PDF → كلها عبر `formatCycleLabel` / `getCycleForPeriodStart`.
- التطبيق يشمل **كل الوحدات وكل المستأجرين وكل الأشهر والسنوات** تلقائياً.

## ملفات ستُعدَّل
- `src/pages/Payments.tsx`
- `src/lib/pdfDocs.ts`
- `src/pages/UnitDetail.tsx`
- `src/test/balance-arrears.test.ts`
