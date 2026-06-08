# خطة: تسجيل الدخول عبر Apple Sign-In

تطبيقك يحتوي حالياً على زر "متابعة عبر Apple" في صفحة `/auth` والكود الأساسي موجود في `src/lib/nativeGoogleAuth.ts` (دالة `nativeAppleSignIn`)، لكن يحتاج إعداد كامل من جانب Apple Developer + Supabase حتى يعمل فعلياً.

---

## الخطوة 1 — حساب Apple Developer (يقوم به المستخدم)

تحتاج اشتراك **Apple Developer Program** نشط ($99/سنة). من https://developer.apple.com/account:

### أ) App ID (للتطبيق iOS)
1. **Identifiers** → **+** → **App IDs** → **App**
2. Description: `Amlaki`
3. Bundle ID: `com.mohammeddahaish.amlaki` (Explicit)
4. فعّل **Sign In with Apple** capability
5. Save

### ب) Services ID (للويب + Supabase)
1. **Identifiers** → **+** → **Services IDs**
2. Description: `Amlaki Web`
3. Identifier: `app.lovable.amlaki.web` (يطابق `APPLE_SERVICES_ID` في الكود)
4. فعّل **Sign In with Apple** → **Configure**:
   - Primary App ID: اختر App ID من الخطوة (أ)
   - **Domains**: `amlaki1.app`, `www.amlaki1.app`, `amlaki1-app.lovable.app`, `pbfgqbtppeztnlotqnrz.supabase.co`
   - **Return URLs**:
     - `https://pbfgqbtppeztnlotqnrz.supabase.co/auth/v1/callback`
     - `https://amlaki1.app/auth/callback`

### ج) Key (.p8) لتوقيع الـ Client Secret
1. **Keys** → **+** → اسم: `Amlaki Sign In Key`
2. فعّل **Sign In with Apple** → **Configure** → اختر App ID
3. Continue → Register → **حمّل ملف `.p8` فوراً** (متاح مرة واحدة فقط)
4. سجّل **Key ID** (10 أحرف)
5. سجّل **Team ID** (أعلى يمين Apple Developer Console)

---

## الخطوة 2 — ربط Apple مع Lovable Cloud (BYOC)

Lovable Cloud يقدم خيارين:
- **Managed** (الأسهل): يستخدم credentials افتراضية، لكن سيظهر اسم Lovable في شاشة Apple بدل اسم تطبيقك
- **BYOC** (الموصى به لتطبيق احترافي): يظهر `Amlaki` في شاشة Apple

**التوصية**: BYOC لأن تطبيقك معد للنشر على App Store.

من Lovable Cloud Dashboard:
1. Users → Authentication Settings → Sign In Methods → **Apple**
2. اختر **Use your own credentials**
3. اضغط **Generate Secret** وعبّئ:
   - Team ID, Key ID, Client ID = `app.lovable.amlaki.web`, محتوى ملف `.p8`
4. سيتولد JWT صالح 6 أشهر — ضعه في حقل Client Secret
5. **مهم**: ضع تذكير لتجديده قبل 6 أشهر

<presentation-actions>
<presentation-open-backend>View Backend</presentation-open-backend>
</presentation-actions>

---

## الخطوة 3 — تغييرات الكود (يقوم بها Lovable في build mode)

الكود الحالي جاهز تقريباً، أحتاج فقط:

### `src/lib/nativeGoogleAuth.ts`
لا تغيير — `APPLE_SERVICES_ID = "app.lovable.amlaki.web"` و `APPLE_REDIRECT_URL` صحيحان بالفعل.

### `capacitor.config.ts`
موجود بالفعل بشكل صحيح:
```ts
apple: { clientId: "app.lovable.amlaki.web", redirectUrl: "https://amlaki1.app/auth/callback" }
```

### `src/pages/Auth.tsx`
الزر `handleOAuth("apple")` يعمل: على iOS الأصلي يستدعي `nativeAppleSignIn()` عبر `@capgo/capacitor-social-login`، وعلى الويب/Android يستدعي `supabase.auth.signInWithOAuth({ provider: "apple" })`.

→ **لا حاجة لأي تعديل كود فعلياً** — كل شيء جاهز ومرتبط بنفس قيم الـ Apple Services ID.

---

## الخطوة 4 — إعداد iOS Xcode (يقوم به المستخدم)

في مشروع iOS المحلي:
1. افتح `ios/App/App.xcworkspace`
2. اختر target **App** → **Signing & Capabilities**
3. تأكد Bundle Identifier = `com.mohammeddahaish.amlaki`
4. اضغط **+ Capability** → أضف **Sign in with Apple**
5. تأكد Team مختار وProvisioning Profile يحتوي capability

---

## الخطوة 5 — الأوامر بعد التعديل

```bash
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
```
في Xcode: Product → Clean Build Folder (⇧⌘K) → Run

---

## نطاق الاختبار

| المنصة | الطريقة | الحالة بعد الإعداد |
|---|---|---|
| **iOS device/simulator** | `nativeAppleSignIn()` → idToken → Supabase | ✅ بعد الخطوات 1+2+4 |
| **الويب** (amlaki1.app + lovable.app) | Supabase OAuth redirect | ✅ بعد الخطوات 1+2 |
| **Android** | Supabase OAuth redirect (نفس الويب) | ✅ بعد الخطوات 1+2 |

---

## خارج النطاق
- لا تغيير على Google Sign-In (يعمل أصلاً)
- لا تغييرات قاعدة بيانات
- تجديد JWT بعد 6 أشهر مسؤولية المستخدم

---

**ملاحظة مهمة**: 99% من العمل خارج Lovable (Apple Developer + Lovable Cloud Dashboard). الكود في المشروع جاهز بالفعل ولا يحتاج تعديل. اضغط "Implement plan" فقط إذا أردت مني التحقق مرة أخيرة من الكود أو إضافة رسائل خطأ أوضح؛ وإلا ابدأ بالخطوة 1.
