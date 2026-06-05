## الحالة الحالية
لا، **هذه الخطة لم تُنفَّذ بالكامل**.

الموجود الآن في المشروع:
- ما زال هناك اعتماد على **`window.open()`** و **`window.print()`** لمسار الطباعة/المعاينة.
- ما زال تنزيل PDF يتم عبر **`pdf.save(...)`** / سلوك متصفح عادي.
- يوجد workaround باسم **`PrintView`** و **`openPrintView()`** لفتح صفحة طباعة داخلية، وليس تدفق Capacitor native الذي طلبته.
- لا توجد حالياً حزم مستخدمة أو استيرادات فعالة لـ:
  - `@capacitor/filesystem`
  - `@capacitor/share`
  - `@capacitor/browser`
- لا يوجد تفريع واضح يعتمد على **`Capacitor.getPlatform()`** لتبديل السلوك بين web و iOS/Android.

## ما سأبنيه
1. **إضافة التدفق Native للموبايل**
   - استخدام `Capacitor.getPlatform()` لتحديد المنصة.
   - على `web`: الإبقاء على السلوك الحالي للمتصفح.
   - على `ios` / `android`: التحويل إلى مسار Native بالكامل.

2. **إنشاء طبقة موحّدة للتعامل مع ملفات PDF**
   - دوال مشتركة مثل:
     - `savePdfNative(...)`
     - `sharePdfNative(...)`
     - `previewPdfNative(...)`
   - توليد PDF كـ base64 / arraybuffer ثم كتابته في `Directory.Cache`.
   - الحصول على `fileUri` ثم:
     - `Share.share(...)` للحفظ/المشاركة/الطباعة عبر AirPrint
     - `Browser.open(...)` للمعاينة داخل العارض الأصلي

3. **استبدال handlers الحالية للأزرار**
   - زر **التحميل**: على native يفتح share sheet بدلاً من download المتصفحي.
   - زر **المعاينة**: على native يفتح العارض الأصلي عبر `Browser.open({ url: fileUri })`.
   - زر **الطباعة**: على native يوجّه إلى share/native viewer بدل `window.print()`.

4. **ربط ذلك بواجهات المعاينة الحالية**
   - `FilePreviewDialog` سيبقى كواجهة التطبيق، لكن أزراره ستستدعي المسار المناسب حسب المنصة.
   - أي مسارات PDF أخرى خارج هذا الحوار سيتم توحيدها على نفس الخدمة حتى لا يبقى سلوك مكسور في صفحة أخرى.

5. **إظهار أخطاء مفهومة للمستخدم**
   - عند فشل إنشاء الملف أو الكتابة أو فتح المعاينة سيتم إظهار toast واضح بدل الصمت الحالي.

6. **مراجعة إعدادات Capacitor الخاصة بـ iOS**
   - التأكد من أن التدفق لا يحتاج تعديلات إضافية غير موجودة.
   - إن احتاجت ملاحظات تخص Xcode/Info.plist سأذكرها بوضوح بعد التنفيذ.

## الملفات المتوقعة للتعديل
- `package.json`
- `src/lib/pdfDocs.ts`
- `src/components/FilePreviewDialog.tsx`
- `src/pages/UnitDetail.tsx`
- `src/pages/Payments.tsx`
- وقد أضيف ملف خدمة صغير مثل `src/lib/nativeFiles.ts` لتجميع منطق Capacitor

## تفاصيل تقنية
- **Web**
  - الاحتفاظ بـ `window.print()` / download / preview browser كما هو أو مع أقل تعديل لازم.
- **Native**
  - `Filesystem.writeFile({ path, data, directory: Directory.Cache })`
  - `Filesystem.getUri(...)`
  - `Share.share({ title, url: fileUri })`
  - `Browser.open({ url: fileUri })`
- لن أعتمد على `window.print()` داخل Capacitor native.
- سأُبقي Sonner/toast الحالي لرسائل الفشل والنجاح الخفيفة.

## التحقق بعد التنفيذ
- التحقق برمجياً من أن كل زر يستدعي handler صحيح حسب المنصة.
- اختبار preview داخل بيئة المشروع بقدر الممكن.
- ثم أعطيك خطوات اختبار سريعة على **iPhone/iPad حقيقيين** لأن AirPrint/share sheet لا يمكن تأكيدهما بالكامل من داخل الـ sandbox.

## ملاحظتان مهمتان
- سأركز فقط على **إصلاح download / preview / print على iPhone & iPad داخل Capacitor**.
- إذا وافقت، أنفّذ الخطة مباشرة وأستبدل الـ workaround الحالي بالمسار Native المطلوب حيث يلزم.