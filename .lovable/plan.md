# خطة إصلاح أزرار الطباعة والتحميل على الايباد/الايفون

## المشكلة

في صفحة المدفوعات، عند الضغط على أيقونة 🖨 أو ⬇ لا يحدث شيء على iPad/iPhone (TestFlight).

السبب الجذري (من الكود):

1. كل زر ملفوف داخل `DropdownMenu` لاختيار اللغة (عربي/إنجليزي). على WKWebView داخل Capacitor، الضغطة الأولى تفتح القائمة فقط، والضغطة الثانية على عنصر القائمة تُغلق القائمة ويُنفّذ الـ handler **بعد** انكسار سياق إيماءة المستخدم — مما يجعل بعض واجهات iOS (Share sheet, AirPrint) لا تفتح.
2. الـ handler يستخدم `html2canvas` لتحويل الإيصال إلى صورة قبل بناء الـ PDF. على iOS Capacitor قد يفشل بصمت (خط/صورة CORS) ولا يصل أبدًا إلى `handlePdfBlobNative`، فلا تظهر حتى رسالة خطأ.
3. لا يوجد `try/catch` خارجي حول الزر نفسه يضمن ظهور toast عند فشل صامت.

## الحل

تبسيط التدفق على iOS الأصلي إلى مسار واحد مُختبَر يعمل (`PrintView` على `/p/:token` — أُصلح مؤخرًا باستخدام Blob URL)، وإزالة القائمة المنسدلة، وإضافة تسجيل أخطاء واضح.

### التغييرات في `src/pages/Payments.tsx`

1. **إزالة `DropdownMenu` حول زري الطباعة والتحميل** — استبدالها بأزرار مباشرة بضغطة واحدة، تستخدم اللغة الافتراضية (`receiptLang`، مع إمكانية تغييرها من الإعدادات كما هي). هذا يحافظ على سياق إيماءة المستخدم.
2. **في `printReceipt` و `downloadReceiptPDF`**:
   - على `isNative()`: تجاوز `html2canvas` تمامًا واستدعاء `openPrintView(html, filename, { lang })` — يفتح صفحة `/p/:token` التي تحتوي على أزرار "حفظ أو مشاركة" + "طباعة" تعمل عبر Safari ViewController / Share sheet الأصلي (هذا المسار يعمل حاليًا بعد إصلاح Blob URL).
   - تغليف الكامل في `try/catch` يضمن `toast.error(String(e?.message || e))` و `console.error("[receipt]", e)` على أي فشل.
3. **iPhone Safari (غير Capacitor)**: نفس المسار — `openPrintView`.
4. **الويب**: يبقى السلوك الحالي (نافذة منبثقة + `window.print` أو `pdf.save`).

### التغييرات في `src/lib/pdfDocs.ts`

- إضافة دالة `openPrintViewForDownload(html, filename, lang)` صغيرة (أو إعادة استخدام `openPrintView` مع علم) تفتح PrintView مع تمرير `intent: "save"` كي يُبرز زر "حفظ أو مشاركة" أولًا. (اختياري — قد لا يلزم لأن PrintView يعرض الزرين معًا.)

### بدون تغيير

- لا تغييرات على Capacitor config، لا plugins جديدة، لا تغيير قاعدة بيانات.
- المسارات على الويب تبقى كما هي.
- `AddPaymentDialog`, `PrintView`, `FilePreviewDialog` لا تتغير (أُصلحت سابقًا).

## ملاحظات

- بعد تطبيق التغييرات: `npm run build` + `npx cap sync ios` + Archive جديد إلى TestFlight.
- إن استمرت المشكلة بعد ذلك، فالتسجيل المضاف سيُظهر سبب الفشل في console logs (يمكن قراءته من Safari → Develop → iPad).
