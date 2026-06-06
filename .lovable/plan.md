# إصلاح "المتابعة بحساب Google" داخل تطبيق iOS (App Store / TestFlight)

## المشكلة بإيجاز
- في المتصفح: زر Google يعمل لأن `window.location.origin` = `https://amlaki1.app`، ومسار OAuth المُدار من Lovable Cloud (`/~oauth/initiate` و`/~oauth/callback`) يقدر يرجّع المستخدم للموقع.
- داخل تطبيق iOS الأصلي (Capacitor): `window.location.origin` = `capacitor://localhost`، وهذا الـ origin **غير مسموح به** عند Google، فلا يوجد مكان شرعي يرجع إليه التوكن → شاشة بيضاء أو فشل صامت.

الحل الصحيح والمعتمد لتطبيقات iOS الأصلية هو استخدام **تسجيل دخول Google الأصلي عبر إضافة Capacitor** بدل تدفق OAuth الويب، ثم تسليم `idToken` لـ Supabase عبر `signInWithIdToken`.

---

## الحل (نظرة عامة)

1. **اكتشاف المنصة**: لو التطبيق يعمل داخل Capacitor (iOS/Android) نستعمل المسار الأصلي. أما المتصفح فيبقى كما هو على Lovable OAuth (لا تغيير على تجربة الويب).
2. **إضافة مكتبة Native Google Sign-In**: `@capacitor-community/social-login` (تستخدم `ASWebAuthenticationSession` + Google SDK على iOS، و`CredentialManager` على Android).
3. **في `src/pages/Auth.tsx`**: زر "المتابعة بحساب Google" يتفرع:
   - ويب → `lovable.auth.signInWithOAuth("google", ...)` (كما هو).
   - Native → `SocialLogin.login({ provider: "google", ... })` ثم `supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce })`.
4. **`capacitor.config.ts`**: إضافة بلوك إعدادات الإضافة (iOS clientId, Web serverClientId, scopes).
5. **بيانات OAuth في Google Cloud Console** (المستخدم ينشئها): 
   - **iOS Client ID** للـ Bundle `app.lovable.c6fcf97d71d44c46b75687a26fc2bf21`.
   - **Web Client ID** (مطلوب كـ serverClientId حتى يقبل Supabase الـ idToken).
6. **في Xcode**: إضافة `GIDClientID` و `CFBundleURLSchemes` (Reversed Client ID) إلى `Info.plist` ثم إعادة البناء ورفع نسخة جديدة لـ TestFlight.

> الكود الحالي للويب (`lovable.auth.signInWithOAuth`) لا يُلمس، فلا تتأثر تجربة المتصفح أبداً.

---

## الملفات التي ستتغير

- `package.json` — إضافة `@capacitor-community/social-login`.
- `capacitor.config.ts` — بلوك إعدادات الإضافة.
- `src/pages/Auth.tsx` — تفريع زر Google حسب المنصة، إضافة nonce.
- (اختياري) ملف صغير `src/lib/nativeAuth.ts` لتغليف منطق Native Google.

لا تغيير على:
- `src/integrations/lovable/index.ts` (مولّد آلياً).
- `src/integrations/supabase/client.ts`.
- مسار البريد/كلمة المرور أو باقي الصفحات.

---

## الخطوات التي يقوم بها المستخدم (مرّة واحدة)

### أ) إنشاء بيانات OAuth في Google Cloud Console
1. ادخل https://console.cloud.google.com → "APIs & Services" → "Credentials".
2. أنشئ **Web OAuth Client ID** (يلزم لـ Supabase / serverClientId) — احفظ `Web Client ID`.
3. أنشئ **iOS OAuth Client ID** ووضع **Bundle ID** = `app.lovable.c6fcf97d71d44c46b75687a26fc2bf21` — احفظ `iOS Client ID` و `Reversed Client ID`.
4. في إعدادات Supabase Auth (داخل Lovable Cloud → Authentication → Providers → Google): أضف `Web Client ID` ضمن "Authorized Client IDs".

### ب) تحديث المشروع محلياً وإعادة البناء لـ iOS
بعد ما أكتب التعديلات في الكود:
```bash
git pull
npm install
npx cap sync ios
npx cap open ios
```
ثم في Xcode:
- افتح `App/Info.plist` وأضف:
  - `GIDClientID` = `<iOS Client ID>`.
  - تحت `CFBundleURLTypes` أضف Scheme جديد قيمته = `<Reversed Client ID>` (مثال: `com.googleusercontent.apps.123456-abcdef`).
- اختر جهازاً/سيميوليتر وابني (`Cmd+R`) للاختبار، ثم Archive → رفع نسخة جديدة لـ TestFlight.

---

## تفاصيل تقنية

### كيف يصبح الزر في `Auth.tsx`
```ts
import { Capacitor } from "@capacitor/core";

async function handleGoogle() {
  if (Capacitor.isNativePlatform()) {
    const { SocialLogin } = await import("@capacitor-community/social-login");
    await SocialLogin.initialize({
      google: {
        iOSClientId: "<iOS Client ID>",
        webClientId: "<Web Client ID>", // serverClientId
      },
    });
    const nonce = crypto.randomUUID();
    const res = await SocialLogin.login({
      provider: "google",
      options: { scopes: ["email", "profile"], nonce },
    });
    const idToken = (res as any).result?.idToken;
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
      nonce,
    });
    if (error) throw error;
    navigate("/");
  } else {
    // كما هو حالياً — Lovable OAuth
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw result.error;
    if (result.redirected) return;
    navigate("/");
  }
}
```

### تعديل `capacitor.config.ts`
يُضاف داخل `plugins`:
```ts
SocialLogin: {
  google: {
    iOSClientId: "<iOS Client ID>",
    webClientId: "<Web Client ID>",
  },
},
```

### لماذا هذا الحل وليس غيره
- `lovable.auth.signInWithOAuth` و`/~oauth/*` مصممان لمتصفح ويب على `https://...`. داخل WebView ينطلق على `capacitor://localhost` ولا يُسمح به في Google.
- استخدام Universal Links وفتح Safari من التطبيق ممكن لكنه تجربة سيئة (يخرج المستخدم من التطبيق ثم يعود)، ولا يحل قبول Google.
- `signInWithIdToken` هو الطريق الرسمي لتسليم هوية Google من تطبيق أصلي إلى Supabase.

---

## ما الذي سيحدث للويب؟
لا شيء. مسار المتصفح يبقى يستعمل Lovable OAuth بدون أي تغيير.

## بعد التنفيذ
- اختبر على جهاز iPhone/iPad فعلي (السيميوليتر قد لا يدعم Google SDK جيداً).
- لو ظهرت رسالة "Unsupported provider" من Supabase: تأكد أن مزوّد Google مُفعّل في Lovable Cloud وأنك أضفت `Web Client ID` في "Authorized Client IDs".

## ما أحتاجه منك للبدء
- تأكيد أنك ستنشئ Client IDs في Google Cloud Console (لازم — لا يمكن إنشاؤها من Lovable).
- بمجرد موافقتك على هذه الخطة، أبدأ التعديل وأعطيك القيم/الأماكن الدقيقة التي تلصقها.
