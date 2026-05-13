## خطة: استعادة كلمة المرور

### 1. صفحة "نسيت كلمة المرور" — `/forgot-password`
ملف جديد: `src/pages/ForgotPassword.tsx`
- حقل بريد إلكتروني واحد + زر "إرسال رابط الاستعادة"
- استدعاء:
  ```ts
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  ```
- رسالة نجاح: "تحقق من بريدك الإلكتروني"
- رابط رجوع لصفحة `/auth`

### 2. صفحة "إعادة تعيين كلمة المرور" — `/reset-password`
ملف جديد: `src/pages/ResetPassword.tsx` (مسار **عام**، بدون `RequireAuth`)
- حقلان: كلمة مرور جديدة + تأكيد
- نفس قيود اللغة الإنجليزية المطبّقة في `Auth.tsx`
- استدعاء `supabase.auth.updateUser({ password })`
- بعد النجاح: توجيه إلى `/auth?mode=signin` مع رسالة نجاح

### 3. رابط في صفحة الدخول
في `src/pages/Auth.tsx`:
- إضافة رابط صغير "نسيت كلمة المرور؟" أسفل حقل كلمة المرور (يظهر فقط في وضع `signin`)
- يوجّه إلى `/forgot-password`

### 4. تسجيل المسارات
في `src/App.tsx`:
- إضافة `<Route path="/forgot-password" element={<ForgotPassword />} />` (عام)
- إضافة `<Route path="/reset-password" element={<ResetPassword />} />` (عام)

### 5. الترجمات
في `src/lib/i18n2.tsx` إضافة:
- `forgot_password` — "نسيت كلمة المرور؟" / "Forgot password?"
- `reset_password` — "إعادة تعيين كلمة المرور" / "Reset password"
- `send_reset_link` — "إرسال رابط الاستعادة" / "Send reset link"
- `reset_email_sent` — "تحقق من بريدك الإلكتروني لإعادة التعيين" / "Check your email to reset"
- `new_password` — "كلمة مرور جديدة" / "New password"
- `confirm_password` — "تأكيد كلمة المرور" / "Confirm password"
- `passwords_dont_match` — "كلمتا المرور غير متطابقتين" / "Passwords don't match"
- `password_updated` — "تم تحديث كلمة المرور" / "Password updated"

### النطاق
- ملفات جديدة: `ForgotPassword.tsx`, `ResetPassword.tsx`
- تعديلات: `Auth.tsx`, `App.tsx`, `i18n2.tsx`
- لا تغييرات في قاعدة البيانات
- يستخدم رسائل البريد الافتراضية لـ Lovable Cloud (تعمل تلقائياً بدون إعداد إضافي)

### ملاحظة
رسائل البريد الافتراضية ستصل من نطاق Lovable. إذا أردت لاحقاً تخصيص القوالب أو استخدام نطاقك الخاص، يمكنني إعداد ذلك.