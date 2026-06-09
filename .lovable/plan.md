## السبب الجذري المؤكد

السبب الحقيقي لفشل Google على iPhone هو **عدم تطابق Bundle ID**:

| الموقع | القيمة الحالية | يجب أن تكون |
|---|---|---|
| Xcode (التطبيق الفعلي) | `com.mohammeddahaish.amlaki` | ✓ |
| Google Cloud iOS Client | `com.mohammeddahaish.amlaki` | ✓ |
| `capacitor.config.ts` | `app.lovable.c6fcf97d71d44c46b75687a26fc2bf21` | **`com.mohammeddahaish.amlaki`** ❌ |
| Apple Services ID | `app.lovable.amlaki.web` | يحتاج مراجعة |

Google iOS SDK يتحقق أن Bundle ID وقت التشغيل = Bundle ID المسجّل في OAuth Client. عدم التطابق ينتج خطأ `invalid_audience` بالضبط كما يحدث.

## الخطوات

### 1. توحيد Bundle ID في `capacitor.config.ts`
- تغيير `appId` من `app.lovable.c6fcf97d71d44c46b75687a26fc2bf21` إلى `com.mohammeddahaish.amlaki` ليطابق Xcode وGoogle Console.

### 2. التحقق من تكوين Apple Sign In
- Apple Services ID الحالي `app.lovable.amlaki.web` لا يطابق Bundle ID الجديد.
- سأبقي على **Apple Managed Auth** من Lovable Cloud (لا BYOC) لأنه لا يحتاج Team ID/JWT يدوي.
- للتدفق الأصلي على iOS، Apple يستخدم Bundle ID مباشرة (لا يحتاج Services ID)، فالحل: استخدم `com.mohammeddahaish.amlaki` كـ `clientId` داخل `SocialLogin.initialize`.

### 3. تحديث `src/lib/nativeGoogleAuth.ts`
- تغيير `APPLE_SERVICES_ID` من `app.lovable.amlaki.web` إلى `com.mohammeddahaish.amlaki` (Bundle ID — هذا ما يقبله Apple على iOS الأصلي).
- إزالة `APPLE_REDIRECT_URL` من Apple init (غير مطلوب على iOS الأصلي وكان سبب خطأ "Invalid response code: 200").
- إبقاء Google `iOSClientId` كما هو (صحيح بالفعل).

### 4. إبقاء `Auth.tsx` كما هو
- المنطق صحيح: Web → Lovable Managed، Native → SDKs.

### 5. إعادة مزامنة مزوّدي Auth في Lovable Cloud
- إعادة تشغيل `configure_social_auth` لـ google و apple لضمان توافق الإعدادات الخلفية.

## ما يجب على المستخدم فعله بعد التطبيق

1. في **Xcode**: التأكد أن Bundle Identifier للتطبيق = `com.mohammeddahaish.amlaki` (موجود بالفعل).
2. `git pull` ثم `npx cap sync ios`.
3. في Xcode: **Clean Build Folder** ثم Rebuild.
4. تثبيت التطبيق على iPhone وتجربة Google + Apple.

## ملاحظة بشأن Team ID

Team ID `ABCD123456` الظاهر في Google Console هو حقل اختياري معلوماتي ولا يؤثر على عمل OAuth وقت التشغيل (Google يتحقق بـ Bundle ID + Client ID فقط). يمكن تركه أو تحديثه لاحقاً.

## ملفات ستُعدَّل
- `capacitor.config.ts`
- `src/lib/nativeGoogleAuth.ts`
- `.lovable/plan.md`

## معايير القبول
- لا يظهر `invalid_audience` عند الضغط على Google في iPhone.
- لا يظهر `Invalid response code: 200` عند Apple.
- كلا الزرين يفتحان شاشة النظام الأصلية ويُنشئان جلسة فعلية.
- الويب يبقى يعمل بدون كسر.
