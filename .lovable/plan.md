## المشكلة

داخل تطبيق iOS الأصلي على iPad، نافذة معاينة الملفات (إيصال/عقد/كشف) تظهر بشاشة بيضاء لكل أنواع الملفات.

السبب الجذري في `src/components/FilePreviewDialog.tsx`:

1. **`<iframe srcDoc={...}>` لا يعمل بثبات داخل WKWebView على iPad** — يحصل على origin `about:srcdoc` الذي يتعارض مع focus trap الخاص بـ Radix Dialog ومع تحميل الخطوط/الصور بمسارات نسبية، فيبقى فارغاً.
2. **`inlinePdfFonts` قد يتعلّق** عند جلب ملفات الخطوط من سياق WKWebView (لا timeout)، فتظل المعاينة على "جاري التحضير…" أو تعرض iframe فارغاً.
3. **ارتفاع iframe ينهار على iPad** بسبب `min(65svh, calc(100svh - 220px))` داخل DialogContent ذي max-height محدّد — في الوضع الأفقي على iPad mini يصبح الناتج صغيراً جداً أو صفراً.

## الحل

تغييرات محصورة في ملف واحد: **`src/components/FilePreviewDialog.tsx`**.

1. **استبدال `srcDoc` بـ Blob URL** للـ iframe:
   - بناء `new Blob([renderedHtml], { type: "text/html;charset=utf-8" })` ثم `URL.createObjectURL`، وتمريره عبر `src` بدلاً من `srcDoc`.
   - تنظيف الـ URL القديم عبر `URL.revokeObjectURL` عند تغيير المحتوى أو إغلاق الحوار.
   - blob URLs تعمل بثبات في WKWebView على iPad وتحلّ مشكلة الـ origin الفارغ.

2. **إضافة timeout لـ `inlinePdfFonts`** (3 ثوانٍ):
   - `Promise.race` بين `inlinePdfFonts(html)` و timeout يرجّع الـ html الأصلي.
   - يضمن عدم بقاء spinner التحميل معلّقاً إن فشل جلب الخطوط داخل WKWebView.

3. **ضبط ارتفاع iframe بحدّ أدنى آمن على iPad**:
   - تغيير الارتفاع إلى `max(360px, min(70svh, calc(100svh - 200px)))` مع `minHeight: 360`.
   - يمنع الانهيار في الوضع الأفقي على iPad.

4. **زر احتياطي للمنصة الأصلية**: عند `isNative()`، إذا لم يحمّل المستخدم خلال ~4 ثوانٍ يظهر زر صغير "فتح في عارض النظام" يستدعي `payload.onSave()` (الذي يفتح Share sheet الأصلي على iOS). هذا fallback غير اعتراضي وليس بديلاً عن الإصلاح الأساسي.

### اختبار التحقق

- على الويب: المعاينة تظهر كما كانت (blob URL متوافق مع كل المتصفحات).
- على iPad (Capacitor): فتح إيصال/عقد/كشف من القوائم — يجب أن يظهر محتوى الملف داخل النافذة خلال ثوانٍ.
- لا تغيير في منطق الحفظ/المشاركة أو ملفات PDF — الإصلاح في طبقة العرض فقط.

## ملاحظة

لا حاجة لإعادة build كاملة لـ Xcode لاختبار الإصلاح لأن hot-reload مفعّل في `capacitor.config.ts` (يشير إلى preview URL). بعد التأكد، شغّل `npx cap sync ios` لإصدار جديد.
