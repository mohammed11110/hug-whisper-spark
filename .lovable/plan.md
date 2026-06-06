## المشكلة

عند توليد الإيصال يظهر `Can't find variable: FileReader`. السبب أن الكود يعتمد على `new FileReader()` في موضعين يُستدعَيان أثناء توليد الإيصال:

1. **`src/lib/nativeFiles.ts`** — `blobToBase64()` يحوّل ملف الـ PDF إلى base64 لكتابته في كاش الجهاز عبر Capacitor Filesystem. يُستدعى عند الحفظ/المشاركة على iOS/Android.
2. **`src/lib/pdfDocs.ts`** — `urlToDataUrl()` يحوّل الصور إلى data URLs قبل html2canvas. يعمل داخل سياق iframe في بعض الحالات حيث قد لا يكون `FileReader` متاحاً (WKWebView مع srcdoc، أو سياقات مقيّدة).

`FileReader` قد لا يكون مضموناً في بعض سياقات WKWebView/سياقات iframe المسروقة (sandboxed/srcdoc) — بينما `Blob.prototype.arrayBuffer()` و `btoa` متاحان دائماً.

## الحل

استبدال كل استخدام لـ `FileReader` بمسار يعتمد على `Blob.arrayBuffer()` + ترميز base64 يدوي (نفس النمط المُستخدم بالفعل في `fetchFontAsDataUrl` في `pdfDocs.ts`). مع الحفاظ على fallback إلى FileReader للمتصفحات القديمة جداً.

### تغييرات الملفات

**`src/lib/nativeFiles.ts`** — تعديل `blobToBase64`:
- استخدام `await blob.arrayBuffer()` ثم تحويل البايتات إلى base64 عبر `btoa` بتقطيع 0x8000.
- في حال عدم توفّر `arrayBuffer` (نادر جداً)، fallback إلى `FileReader` داخل `if (typeof FileReader !== "undefined")`، وإلا رمي خطأ واضح.

**`src/lib/pdfDocs.ts`** — تعديل `urlToDataUrl` (السطر ~1659):
- نفس النمط: `blob.arrayBuffer()` → base64 → `data:${blob.type};base64,...`.
- نفس الحارس `typeof FileReader !== "undefined"` كـ fallback.

**`src/pages/Settings.tsx` (السطر 108)** — مراجعة الاستخدام:
- إن كان قراءة ملف نصياً، استخدام `await file.text()` بدلاً من `FileReader.readAsText`.
- إن كان قراءة كـ DataURL، استخدام نفس مساعد `arrayBuffer→base64`.

### اختبار التحقق

- توليد إيصال على preview الويب (يجب أن يحفظ PDF كما كان).
- إعادة إصدار build مع `npx cap sync ios`، ثم تجربة "تحميل الإيصال" داخل تطبيق iOS — يجب أن تفتح ورقة المشاركة بدون رمي الخطأ.
- التحقق من سجل console بعدم وجود `FileReader is not defined`.

## ملاحظة

التغييرات محصورة في طبقة المساعدات (helpers) ولا تمسّ منطق العقود أو الإيصالات أو الـ UI. التوافق مع الويب والمنصّات الأصلية محفوظ.
