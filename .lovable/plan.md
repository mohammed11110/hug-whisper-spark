## الهدف
السماح للمشترك بتحديد رقم بداية إيصالات الاستلام (مثلاً يبدأ من 1000)، مع ترقيم تلقائي تصاعدي بدلاً من الرقم الحالي المبني على `Date.now()`.

## التغييرات

### 1) `src/lib/appSettings.tsx`
إضافة حقول جديدة إلى `AppSettings`:
```ts
receipt: {
  prefix: string;        // مثل "R-"  (اختياري، فارغ مسموح)
  startNumber: number;   // رقم البداية، افتراضي 1
  padding: number;       // عدد الخانات (مثلاً 4 → 0001)، افتراضي 0 = بدون حشو
  nextNumber: number;    // العداد الحالي (يُحدّث تلقائياً بعد كل حفظ)
}
```
- إضافة دالة مساعدة `getNextReceiptNumber()` و `bumpReceiptNumber()` على الـ context.
- التهيئة الافتراضية: `{ prefix: "R-", startNumber: 1, padding: 0, nextNumber: 1 }`.
- يُحفظ في نفس `localStorage` key الحالي (مع merge للتوافق).

### 2) `src/components/SettingsPanel.tsx`
إضافة قسم جديد "ترقيم الإيصالات / Receipt numbering":
- حقل: **بادئة الإيصال** (نص، مثل `R-` أو `INV-`)
- حقل: **رقم البداية** (عدد، افتراضي 1)
- حقل: **عدد الخانات** (عدد 0–8)
- حقل: **الرقم التالي** (للقراءة، مع زر "إعادة ضبط" يعيده إلى `startNumber`)
- معاينة مباشرة: `R-0001`

### 3) `src/components/AddPaymentDialog.tsx`
استبدال:
```ts
if (!receipt) setReceipt(`R-${Date.now()}`);
```
بـ:
```ts
if (!receipt) setReceipt(formatReceipt(settings.receipt));
```
وبعد نجاح الحفظ: استدعاء `bumpReceiptNumber()` لزيادة `nextNumber` بمقدار 1.

ملاحظة: المستخدم يستطيع دائماً تعديل الرقم يدوياً قبل الحفظ (الحقل قابل للتحرير كما هو الآن).

## ما لا يتغير
- لا تغييرات في قاعدة البيانات — الإعداد محلي (localStorage) كباقي إعدادات التطبيق الحالية.
- جدول `payments.receipt_number` يبقى كما هو (نص حر).
