# الحل الجذري لمشاكل PDF على iPhone و iPad

## المشكلة الجذرية

على iOS (Safari + WKWebView داخل Capacitor):
- `<a download>` يُتجاهل تماماً
- `navigator.share({files})` غير موثوق داخل WebView
- `window.open(blob:URL)` محجوب
- `iframe.contentWindow.print()` من iframe مخفي لا يستدعي AirPrint في iOS 17+
- `iframe srcDoc` لا يمرّر باللمس بسلاسة

النتيجة: المستخدم لا يستطيع حفظ ولا طباعة ولا حتى قراءة الإيصال بشكل صحيح.

## الفكرة الأساسية

بدل إجبار توليد PDF على iOS، نفتح **صفحة طباعة كاملة** في تبويب جديد عبر نقرة المستخدم. Safari يتعامل معها أصلياً:
- زر المشاركة الأصلي → حفظ في «الملفات» كـ PDF / AirDrop / واتساب / بريد
- زر الطباعة → AirPrint مباشرة
- تمرير لمسي طبيعي وحجم نص مضبوط

هذا هو نفس الأسلوب الذي تستخدمه البنوك و Stripe على iOS.

سطح المكتب و Android يبقى سلوكهم كما هو (`jsPDF.save` يعمل ممتاز).

## الملفات

### 1. جديد: `src/pages/PrintView.tsx`
صفحة `/p/:token` تقرأ HTML من `sessionStorage` (key = token) وتعرضه ملء الصفحة مع:
- خطوط Noto Kufi + Outfit مضمّنة عبر `inlinePdfFonts`
- `<meta viewport>` صحيح
- شريط علوي ثابت فيه زرّان فقط: «حفظ / مشاركة» (يستدعي `window.print()` فيستخدم Safari Save as PDF) و«طباعة» (نفس الشيء، فـ Safari iOS يدمجهما في نفس الورقة)
- زر إغلاق صغير
- يحذف الـ token من `sessionStorage` بعد القراءة

### 2. تعديل: `src/App.tsx`
إضافة route عام (خارج RequireAuth لأنه يُفتح في تبويب جديد قد يفقد الجلسة):
```
<Route path="/p/:token" element={<PrintView />} />
```

### 3. تعديل: `src/lib/pdfDocs.ts`
إضافة helper جديد:
```ts
export function openPrintView(html: string, filename: string): boolean
```
- يولّد token عشوائي
- يخزّن `{ html, filename, title }` في `sessionStorage`
- `window.open('/p/' + token, '_blank')` (يجب أن يُستدعى من نقرة مستخدم مباشرة)
- يُرجع true عند النجاح، false إذا حُجبت النافذة

في `buildPdfFromCanvas` و `printHTML` على iOS:
- جرّب `openPrintView` أولاً
- إذا فشل (نادر) ارجع للسلوك الحالي (blob + window.open) كـ fallback

### 4. تعديل: `src/components/FilePreviewDialog.tsx`
- زر «حفظ أو مشاركة» على iOS يستدعي `openPrintView(html, filename)` مباشرة بدل توليد PDF داخل التطبيق
- زر «طباعة» على iOS يفعل نفس الشيء (Safari سيتولى الباقي)
- على غير iOS: لا تغيير، يبقى `pdf.save()` و `printHTML`
- استبدال `<iframe srcDoc>` بـ `<div dangerouslySetInnerHTML>` (مع DOMPurify) داخل حاوية `WebkitOverflowScrolling: touch` على iOS فقط، للتمرير السلس

### 5. تعديل: `src/components/AddPaymentDialog.tsx`
نفس النمط: على iOS استبدال `await savePdfBlob(...)` و `printHTML(...)` بـ `openPrintView(...)`.

## النتيجة المتوقعة

| المنصة | معاينة | حفظ | طباعة |
|---|---|---|---|
| Desktop | iframe كما هو | `pdf.save()` | iframe print |
| Android | iframe كما هو | `pdf.save()` | iframe print |
| iPhone Safari | div مع تمرير لمسي | صفحة /p/:token → Share → Save to Files | صفحة /p/:token → AirPrint |
| iPad Safari | div مع تمرير لمسي | نفسه | نفسه |
| Capacitor iOS | نفسه | Safari الخارجي عبر `window.open` | نفسه |

ترقيم الإيصالات لا يتأثر — يبقى عبر RPC الخادم.

## ملاحظة تقنية
`window.open` يجب أن يُستدعى **متزامناً** من معالج النقرة (بدون `await` قبله) وإلا حجبه iOS. الكود سيهيّئ الـ token ويخزّن في sessionStorage ثم يفتح فوراً، ويترك تحضير الخطوط للصفحة الجديدة.
