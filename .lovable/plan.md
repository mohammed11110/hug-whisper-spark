## الهدف
إصلاح تسجيل الدخول الأصلي على iPhone بشكل نهائي بحيث يعمل Google وApple من شاشة النظام الأصلية بدون أخطاء `invalid_audience` أو `Unacceptable audience in id_token`.

## السبب الحقيقي
المشكلة ليست من الزر أو الواجهة فقط، بل من عدم تطابق القيم التي يتوقعها نظام المصادقة الخلفي مع الـ ID Token القادم من iPhone:

- **Google**: الخلفية يجب أن تقبل أكثر من Client ID عند استخدام الويب + iOS native، وبحسب التوثيق يجب وضع **كل Client IDs** في إعداد مزود Google، مع **Web Client ID أولاً** ثم iOS Client ID.
- **Apple**: في iOS native، التوكن يستخدم **Bundle ID / App ID** كـ audience. لذلك الخلفية يجب أن تعرف **Bundle ID** كـ Client ID مقبول. وإذا بقي Apple web مفعلاً أيضاً، يلزم إضافة **Services ID** كذلك.
- **الكود الحالي** أيضاً ناقص في نقطة مهمة: Google native الأفضل أن يمر عبر **nonce** ثم `signInWithIdToken()`، وApple على iOS لا يحتاج `clientId` مُجبراً داخل plugin لأن الـ plugin يستخدم Bundle ID تلقائياً.

## ما سأطبقه
### 1) ضبط إعدادات المصادقة الخلفية بما يطابق native iOS
- **Google provider**:
  - ضبط قائمة Client IDs لتشمل:
    - `333958704131-3f0rajm780ophcb2g770apn5hkbto3hq.apps.googleusercontent.com` (Web)
    - `333958704131-p0345q3rti29e70oesqmgvpah2q8e58a.apps.googleusercontent.com` (iOS)
  - بالترتيب: **Web أولاً ثم iOS**.
- **Apple provider**:
  - ضبط Client ID ليقبل:
    - `com.mohammeddahaish.amlaki` (iOS App ID / Bundle ID)
    - وإذا استمر دعم Apple على الويب أيضاً: `app.lovable.amlaki.web` كذلك
  - إذا كان الويب Apple مستخدماً فعلاً، أتأكد أن إعداداته الخلفية تبقى صالحة معه أيضاً.

### 2) تحديث تدفق Google native في الكود
- إعادة بناء `src/lib/nativeGoogleAuth.ts` ليتبع نمط native الموصى به:
  - توليد `rawNonce`
  - اشتقاق `nonceDigest`
  - تمرير `nonceDigest` إلى Google native login
  - تمرير `rawNonce` إلى `supabase.auth.signInWithIdToken()`
- إضافة حماية من مشكلة **token caching** على iOS:
  - إذا رجع توكن قديم أو nonce غير متطابق، يتم تسجيل خروج Google محلياً وإعادة المحاولة مرة واحدة.
- الإبقاء على استخدام `GOOGLE_WEB_CLIENT_ID` و `GOOGLE_IOS_CLIENT_ID` الحاليين إذا كانت صحيحة.

### 3) تصحيح Apple native في الكود
- إزالة فرض `clientId` الخاص بـ Apple من تهيئة plugin على iOS، لأن التوثيق يشير إلى أن iOS يستخدم **Bundle ID تلقائياً**.
- الإبقاء على `signInWithIdToken({ provider: 'apple' })` لكن بعد تنظيف التهيئة لتطابق native iOS الفعلي.
- إذا احتاج الويب Apple مساراً مختلفاً، يبقى في `Auth.tsx` عبر OAuth الويب كما هو.

### 4) الإبقاء على بنية الشاشة الحالية
- `src/pages/Auth.tsx` يبقى منطقياً كما هو تقريباً:
  - **Native** → SDK أصلي
  - **Web** → OAuth المُدار في المتصفح
- فقط أربط التدفق الجديد المحسن بدون تغيير تصميم الصفحة.

### 5) تحسين رسائل الخطأ والتشخيص
- إضافة رسائل أدق للمستخدم عند رفض audience أو nonce.
- إبقاء `console.error` منظم ليسهل التقاط السبب إذا ظهر خطأ جديد.

## الملفات المستهدفة
- `src/lib/nativeGoogleAuth.ts`
- `src/pages/Auth.tsx` (إن احتاج ربط أو رسائل فقط)
- `capacitor.config.ts` (مراجعة فقط؛ الـ `appId` الآن صحيح)

## تفاصيل تقنية مهمة
- حسب التوثيق، **Google provider في الخلفية** عند وجود Web + iOS يجب أن يقبل **عدة Client IDs مفصولة بفواصل**، مع **Web أولاً**.
- حسب التوثيق، **Apple native على iOS** يعتمد على **Bundle ID** كـ audience، والخلفية يجب أن تقبله.
- إذا أردنا استمرار Apple على الويب أيضاً، فالأفضل أن تقبل الخلفية **Bundle ID + Services ID** معاً بحسب المنصة.
- هذا يعني أن **الحل الجذري يتطلب شقين معاً**:
  1. تصحيح الكود native
  2. تصحيح إعدادات مزودي المصادقة في الخلفية

## التحقق بعد التنفيذ
- على iPhone:
  - زر Google يفتح شاشة اختيار الحساب الأصلية ثم يدخل بدون `Unacceptable audience in id_token`
  - زر Apple يفتح شاشة Apple الأصلية ثم يدخل بدون `.invalid_audience`
- على الويب:
  - Google وApple عبر المتصفح يستمران بالعمل
- لا يحدث كسر في تسجيل الدخول بالبريد الإلكتروني

## ما ستفعله أنت بعد التنفيذ
- `git pull`
- `npx cap sync ios`
- فتح Xcode ثم **Clean Build Folder**
- إعادة التثبيت على iPhone والتجربة

## ملاحظة تنفيذية
هذا حل جذري فعلاً لأنه يعالج **مصدر رفض التوكن** في الخلفية، وليس فقط تغييرات سطحية في الواجهة أو Bundle ID.