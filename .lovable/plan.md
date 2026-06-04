# إصلاح المعاينة والتنزيل والطباعة على iPhone و iPad

## المشكلة

على أجهزة iOS (Safari و WKWebView داخل تطبيق Capacitor) تحدث ثلاث مشكلات في إيصالات الـ PDF:

1. **التنزيل لا يعمل**: `jsPDF.save(filename)` يستخدم رابط `blob:` + `<a download>`. iOS Safari يتجاهل الخاصية `download` ويفتح الـ blob في نفس التبويب فيضيع التطبيق، وفي WebView لا يحدث شيء إطلاقاً.
2. **الطباعة تفشل**: `window.open("", "_blank", ...)` ثم `document.write` يُحجب على iOS أو يفتح نافذة فارغة. حتى لو فُتحت، استدعاء `win.print()` غير مدعوم في Safari iOS الحديث.
3. **المعاينة تُقص أو لا تمرّر**: `<iframe srcDoc>` داخل الحوار على iOS لا يمرّر بالأصابع بسلاسة، وأحياناً يظهر الإيصال بحجم خاطئ أو مقصوص في iPhone الضيق و iPad في الوضع العمودي.

## ما سأبنيه

### 1. كشف iOS مركزي
- إضافة `src/lib/platform.ts` بدالة `isIOS()` (تكشف iPhone/iPad/iPod + iPadOS الحديث الذي يُبلّغ نفسه كـ Mac مع `maxTouchPoints > 1`) ودالة `isIOSWebView()` للتمييز عن Capacitor.

### 2. مسار تنزيل/مشاركة بديل على iOS (`src/lib/pdfDocs.ts`)
- في `buildPdfFromCanvas` بدل `pdf.save(filename)`:
  - على iOS: استخدام `pdf.output("blob")` + إنشاء `File` ومحاولة `navigator.share({ files: [file] })` أولاً (يفتح ورقة المشاركة الأصلية: حفظ في الملفات/واتساب/طباعة). إذا فشل أو غير مدعوم، نفتح `pdf.output("bloburl")` في تبويب جديد عبر `window.open(url, "_blank")` المُحرَّك بنقرة المستخدم — Safari iOS يعرض حينها PDF بمعاينة أصلية مع زر مشاركة/حفظ.
  - على باقي المنصات: الإبقاء على `pdf.save(filename)` كما هو.
- إضافة fallback نهائي: إذا فشل الكل، إنشاء `<a href={dataUrl}>` ونقره برمجياً.

### 3. مسار طباعة موثوق على iOS (`printHTML`)
- بدل `window.open` ثم `document.write`، إنشاء `<iframe>` مخفي داخل الصفحة الحالية مع `srcdoc=finalHtml`، انتظار `load` + `fonts.ready`، ثم استدعاء `iframe.contentWindow.print()` (مدعوم في iOS Safari). تنظيف الـ iframe بعد الانتهاء.
- هذا يعمل على جميع المنصات ويستبدل المسار الحالي بالكامل، فيحلّ مشكلة حجب النوافذ المنبثقة على iOS.

### 4. تحسين معاينة الإيصال داخل الحوارات
- في `FilePreviewDialog.tsx` و `AddPaymentDialog.tsx` (مكوّن `ScaledReceiptPreview` المضاف سابقاً):
  - إضافة `style={{ WebkitOverflowScrolling: "touch" }}` على حاوية التمرير لتفعيل التمرير الطبيعي على iOS.
  - استخدام `100svh` بدل `100vh` في الارتفاع لتجنب الشريط السفلي لـ Safari الذي يقصّ المحتوى.
  - تقليل الـ padding على شاشات iPhone الضيقة: `p-2 sm:p-4` بدل `p-4 sm:p-6` في `FilePreviewDialog`.
  - إضافة `playsinline`-equivalent للـ iframe: `scrolling="auto"` + `allow="fullscreen"` لمنع iOS من تحويل الإيصال لصفحة منفصلة.
  - ضبط ارتفاع iframe المعاينة في `FilePreviewDialog` من `65vh` ثابت إلى `min(65svh, calc(100svh - 200px))`.

### 5. زر المشاركة على iOS داخل `FilePreviewDialog`
- على iOS فقط، إضافة زر «مشاركة» بجانب «حفظ» يستدعي `navigator.share` بمَلَف الـ PDF — يفتح ورقة iOS الأصلية (حفظ في الملفات، إرسال، طباعة AirPrint). على غير iOS لا يظهر الزر.

## التفاصيل التقنية

```text
isIOS():
  /iP(hone|od|ad)/.test(ua)
  || (platform === "MacIntel" && navigator.maxTouchPoints > 1)

buildPdfFromCanvas (نهاية الدالة):
  if (isIOS()) {
    const blob = pdf.output("blob");
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return; }
      catch (e) { /* المستخدم ألغى → جرب فتح في تبويب */ }
    }
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  pdf.save(filename);

printHTML (إعادة كتابة):
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.srcdoc = finalHtml;
  document.body.appendChild(iframe);
  await load + fonts.ready;
  iframe.contentWindow!.focus();
  iframe.contentWindow!.print();
  setTimeout(() => iframe.remove(), 1000);
```

## ملفات ستتغير

- جديد: `src/lib/platform.ts`
- تعديل: `src/lib/pdfDocs.ts` (`buildPdfFromCanvas` + `printHTML`)
- تعديل: `src/components/FilePreviewDialog.tsx` (تمرير iOS، زر مشاركة، ارتفاع svh)
- تعديل: `src/components/AddPaymentDialog.tsx` (ScaledReceiptPreview: svh + WebkitOverflowScrolling)

## النتيجة المتوقعة

- على iPhone/iPad: زر «حفظ الملف» يفتح ورقة المشاركة الأصلية → حفظ في «الملفات» أو إرسال مباشر.
- زر «طباعة» يفتح حوار AirPrint الأصلي.
- معاينة الإيصال تتمرّر بسلاسة ولا تُقص بأي حجم شاشة.
- سلوك سطح المكتب والأندرويد يبقى كما هو دون تغيير.
