## الهدف
إصلاح تسجيل الدخول بجوجل على iOS داخل تطبيق Amlaki (Capacitor + @capgo/capacitor-social-login)، وحلّ الانهيار: *"Your app is missing support for the following URL schemes"*.

## القيم المعتمدة

| المفتاح | القيمة |
|---|---|
| Bundle ID | `com.mohammeddahaish.amlaki` |
| Web Client ID (serverClientId) | `333958704131-3f0rajm780ophcb2g770apn5hkbto3hq.apps.googleusercontent.com` |
| iOS Client ID | `333958704131-p0345q3rti29e70oesqmgvpah2q8e58a.apps.googleusercontent.com` |
| Reversed URL Scheme | `com.googleusercontent.apps.333958704131-p0345q3rti29e70oesqmgvpah2q8e58a` |

> ملاحظة: قيمة الـ iOS التي أرسلتَها كانت تطابق Web Client ID تقريباً (يبدو خطأ في النسخ). اعتمدتُ على الـ REVERSED_CLIENT_ID كمصدر صحيح لأنه ما أضفته فعلياً في Xcode.

## التغييرات في الكود

### 1) `capacitor.config.ts`
استبدال قيم placeholder لإعدادات `SocialLogin`:
```ts
SocialLogin: {
  google: {
    webClientId: "333958704131-3f0rajm780ophcb2g770apn5hkbto3hq.apps.googleusercontent.com",
    iOSClientId: "333958704131-p0345q3rti29e70oesqmgvpah2q8e58a.apps.googleusercontent.com",
  },
  apple: { clientId: "app.lovable.amlaki.web", redirectUrl: "https://amlaki1.app/auth/callback" },
}
```

### 2) `src/lib/nativeGoogleAuth.ts`
استبدال الثوابت العلوية بالقيم الحقيقية:
```ts
export const GOOGLE_IOS_CLIENT_ID = "333958704131-p0345q3rti29e70oesqmgvpah2q8e58a.apps.googleusercontent.com";
export const GOOGLE_WEB_CLIENT_ID = "333958704131-3f0rajm780ophcb2g770apn5hkbto3hq.apps.googleusercontent.com";
```
(تبقى `APPLE_*` كما هي.)

> هذه القيم عامّة وآمنة في المستودع (publishable).

## التحقّق من الجانب الأصلي (iOS) — يحتاج تأكيداً منك في Xcode

لن يستطيع أي تعديل في الكود إخفاء خطأ *"missing URL schemes"* إن لم تكن القيم التالية موجودة فعلياً في مشروع iOS:

1. **`ios/App/App/Info.plist` → `CFBundleURLTypes`** يجب أن يحتوي:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>com.googleusercontent.apps.333958704131-p0345q3rti29e70oesqmgvpah2q8e58a</string>
       </array>
     </dict>
   </array>
   ```
2. **Bundle Identifier** في Xcode = `com.mohammeddahaish.amlaki` (مطابق لما في Google Cloud → iOS OAuth Client).
3. حذف أي `GIDClientID` قديم/خاطئ في `Info.plist` (إن وُجد) لأن المكوّن الإضافي يمرّر القيمة برمجياً.

## التحقّق في Supabase (Backend / Lovable Cloud)

- المزوّد Google مفعّل.
- في حقل **Authorized Client IDs** أضف **كلا الـ IDs** (Web + iOS) مفصولة بفواصل — هذا ضروري كي يقبل Supabase الـ `idToken` القادم من iOS الأصلي:
  ```
  333958704131-3f0rajm780ophcb2g770apn5hkbto3hq.apps.googleusercontent.com,333958704131-p0345q3rti29e70oesqmgvpah2q8e58a.apps.googleusercontent.com
  ```
- URI الـ callback لـ Web (في Google Cloud → Web client):
  `https://pbfgqbtppeztnlotqnrz.supabase.co/auth/v1/callback`

## الأوامر بعد التعديل

```bash
npm install
npm run build
npx cap sync ios
npx cap open ios
```
ثم في Xcode: Product → Clean Build Folder → Run.

## نطاقات العمل بعد الإصلاح
- **Web**: عبر `supabase.auth.signInWithOAuth({ provider: "google" })` (Redirect).
- **iOS Simulator / Device**: عبر `@capgo/capacitor-social-login` ⇒ `signInWithIdToken`.

## خارج النطاق
- إعدادات Apple Sign-In (مكتملة سابقاً، لا تتغيّر).
- Android (يعمل لاحقاً عبر نفس الـ Web Client ID + SHA-1).
