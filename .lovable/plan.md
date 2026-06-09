## المشكلة
زرّا Google و Apple في `src/pages/Auth.tsx` لا يستجيبان (في الويب، الموقع المنشور، وتطبيق Capacitor) لأن الكود على الويب يستدعي `supabase.auth.signInWithOAuth` مباشرةً، بينما المشروع مُفعَّل عليه **Lovable Cloud Managed OAuth** (`src/integrations/lovable/index.ts` موجود). في هذه الحالة المسار الصحيح هو `lovable.auth.signInWithOAuth(...)` الذي يمر عبر بروكسي `/~oauth` الخاص بـ Lovable. الاستدعاء الحالي يفشل بصمت (Unsupported provider أو redirect لا يحدث) ولا تظهر أي رسالة.

أيضًا على الجوال (Capacitor) المسار يستخدم `@capgo/capacitor-social-login` — هذا صحيح ولكن سنتأكد من أن init يتم قبل أي محاولة وأن الأخطاء تُعرض للمستخدم.

## الخطة

### 1) تحديث الويب إلى Lovable Managed OAuth
- في `src/pages/Auth.tsx` استبدال `supabase.auth.signInWithOAuth({ provider, ... })` بـ:
  ```ts
  import { lovable } from "@/integrations/lovable";
  const result = await lovable.auth.signInWithOAuth(provider, {
    redirect_uri: `${window.location.origin}/`,
  });
  if (result.error) throw result.error;
  if (result.redirected) return; // المتصفح ينتقل
  navigate("/");
  ```
- إبقاء فرع `isNativeApp()` كما هو (يعمل عبر `@capgo/capacitor-social-login`).

### 2) تحسين تجربة الخطأ والـ busy
- إضافة `console.error` + `toast.error` واضح يضمّ اسم المزوّد ورسالة الخطأ.
- في الويب: عدم استدعاء `setBusy(false)` فقط في `catch` بل أيضًا في حال `redirected=false` غير المتوقع، لمنع تجمد الزر.
- إضافة `aria-busy` ومؤشر تحميل صغير داخل الزر أثناء الانتظار.

### 3) التحقق من إعدادات المزوّدين في Lovable Cloud
بعد تطبيق الكود، نتأكد أن مزوّدَي `google` و `apple` مفعّلان فعلاً في **Users → Authentication Settings → Sign In Methods** عبر استدعاء `configure_social_auth({ providers: ["google", "apple"] })` لإعادة توليد أي إعداد ناقص (مع الاحتفاظ بـ email).

### 4) التحقق من أن Capacitor SocialLogin مهيّأ
- `capacitor.config.ts` يحتوي بالفعل على `webClientId` و `iOSClientId` و Apple `clientId` — صحيح.
- التأكد من أن `nativeGoogleSignIn` / `nativeAppleSignIn` يستدعيان `ensureInit()` (موجود بالفعل) وأن أي خطأ يُعرض في `toast` بدلاً من البلع.

### 5) اختبار التحقق
- على الموقع المنشور (amlaki1.app): الضغط على Google يجب أن يعيد التوجيه إلى `oauth.lovable.app` ثم Google ثم يعود ويسجّل الجلسة.
- على معاينة Lovable: نفس السلوك (يدعم `lovable.auth.signInWithOAuth` المعاينة).
- على iOS Capacitor: يفتح شيت Apple/Google الأصلي وتُنشأ الجلسة عبر `idToken`.

### 6) إن كانت المشكلة بعد التحديث لا تزال على الموقع المنشور فقط
نتحقق من سجلات auth (`supabase analytics_query`) لرؤية أي خطأ `invalid_provider` أو `redirect_uri_mismatch`، ثم نضيف الدومين `amlaki1.app` في إعدادات المزوّد عند الحاجة.

## ملفات سيتم تعديلها
- `src/pages/Auth.tsx` (المنطق فقط — لا تغييرات بصرية على الأزرار)
- `src/lib/nativeGoogleAuth.ts` (تحسين رسائل الخطأ فقط، اختياري)
- استدعاء أداة `configure_social_auth` لإعادة تأكيد تفعيل google + apple

## ملاحظة
هذه تغييرات منطقية في طبقة المصادقة فقط — لا تمس التصميم أو الأعمال (Payments, Receipts…).