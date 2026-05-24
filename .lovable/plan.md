# تحديث "آخر شهر مدفوع" → تاريخ كامل (يوم/شهر/سنة)

## التغيير
بدّل قائمة الشهر المنسدلة في `LastPaymentSection` بمنتقي تاريخ كامل (يوم + شهر + سنة) باستخدام Shadcn DatePicker (Calendar داخل Popover) مع المحافظة على حقل المبلغ كما هو.

## السلوك الجديد
- المستخدم يختار **تاريخ آخر دفعة** (مثلاً 15 مارس 2025) + **المبلغ**.
- نحدد الشهر الذي ينتمي إليه التاريخ → نستخدم بدايته ونهايته كـ `period_start`/`period_end` للدفعة في جدول `payments`.
- `opening_balance_date` = أول يوم في الشهر التالي للتاريخ المختار.
- `last_paid_date` على الوحدة = التاريخ المختار بالضبط (بدل آخر يوم في الشهر).
- `payment_date` = اليوم (تاريخ التسجيل الفعلي في النظام).

## الواجهة
```
☑ المستأجر دفع إيجار شهور سابقة
   تاريخ آخر دفعة:  [📅 15 مارس 2025]      المبلغ:  [150]
   ⓘ المتأخرات ستُحسب تلقائياً من أبريل 2025
```

## الملفات المعدّلة
- `src/components/LastPaymentSection.tsx`
  - تغيير `month: string` → `date: Date | undefined` في الواجهة.
  - استبدال `<Select>` بـ `<Popover>` + `<Calendar mode="single">` مع `className="p-3 pointer-events-auto"`.
  - تصدير دالتين مساعدتين: `monthBoundsFromDate(date)` ترجع `{start, end, nextMonthStart, label}`.
  - حذف `getLastPaidMonthOptions` و `nextMonthStartISO` (لم تعد لازمة).
  - تعطيل التواريخ المستقبلية في الـ Calendar.

- `src/components/NewTenancyDialog.tsx`
  - تبديل `prevPayMonth: string` بـ `prevPayDate: Date | undefined`.
  - عند الحفظ: استخدم `monthBoundsFromDate(prevPayDate)` بدل lookup من القائمة.
  - `last_paid_date` = `prevPayDate.toISOString().slice(0,10)`.

- `src/components/EditUnitDialog.tsx`
  - نفس التعديل.

## ملاحظات تقنية
- استخدام `date-fns` (موجود بالمشروع) لتنسيق العرض حسب اللغة (ar/en).
- لا تغيير في قاعدة البيانات.
- باقي المنطق (`computeBalance`, صفحة المستأجرين) يبقى كما هو.
