# تفعيل PWA لتطبيق أملاكي

## الهدف
تفعيل Progressive Web App ليدعم:
- التثبيت على الشاشة الرئيسية (Install prompt يعمل فعلياً)
- العمل دون اتصال (offline) مع cache ذكي
- تحديث تلقائي عند نشر إصدار جديد

## الخطوات

### 1. تثبيت الحزمة
- إضافة `vite-plugin-pwa` كـ devDependency

### 2. تحديث `vite.config.ts`
إضافة `VitePWA` plugin بإعدادات آمنة:
- `registerType: "autoUpdate"` — تحديث تلقائي
- `devOptions.enabled: false` — لا يعمل في dev (يمنع تعطيل preview)
- `navigateFallbackDenylist: [/^\/~oauth/, /^\/auth/]` — لا يتدخل في OAuth وSupabase auth
- `runtimeCaching`:
  - HTML navigations → `NetworkFirst` (3s timeout)
  - الصور والخطوط → `CacheFirst` مع expiration
  - Supabase API → `NetworkOnly` (لا cache للبيانات الحساسة)
- استخدام `manifest: false` للإبقاء على `public/manifest.webmanifest` الحالي

### 3. حماية معاينة Lovable
في `src/main.tsx` قبل أي registration:
- كشف iframe أو hostname يحتوي `lovableproject.com` / `id-preview--`
- إذا كان preview → unregister أي service worker موجود
- بقية الحالات → السماح للـ SW بالعمل

### 4. منع التعارض مع Capacitor
- داخل Capacitor (native app)، تعطيل تسجيل SW (نتحقق من `window.Capacitor`)
- التطبيق الأصلي يفتح من `dist` محلياً، لا يحتاج SW

### 5. تحديث `manifest.webmanifest`
- التأكد من اكتمال الحقول (موجودة بالفعل) — لا تغييرات كبيرة
- إضافة `id: "/"` لاستقرار الهوية

### 6. مؤشر تحديث متاح
- استخدام `useRegisterSW` hook لإظهار toast صغير "تحديث جديد متاح" مع زر إعادة تحميل
- بأسلوب أملاكي (sage palette، بالعربية)

## ملاحظات مهمة
- **PWA لن يعمل في معاينة Lovable** (مقصود) — يعمل فقط على النطاق المنشور `amlaki1.app`
- **لن يتعارض مع تطبيق iOS/Android** — Capacitor يستخدم WebView محلي بدون SW
- `InstallPrompt` و `OfflineBanner` الموجودان مسبقاً سيعملان بشكل أفضل بعد التفعيل

## الملفات المتأثرة
- `package.json` (إضافة dependency)
- `vite.config.ts` (إضافة plugin)
- `src/main.tsx` (guard + register)
- `public/manifest.webmanifest` (تعديل بسيط)
- `src/components/PWAUpdatePrompt.tsx` (ملف جديد)
- `src/components/AppShell.tsx` (إدراج المكون الجديد)
