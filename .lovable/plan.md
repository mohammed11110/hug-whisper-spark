## المشكلة
الصورة المرفوعة مقاسها 512×512 بينما App Store يطلب أيقونة **1024×1024 بدون قناة شفافية (alpha)**.

## الحل
أكبّر الصورة إلى 1024×1024 مع خلفية بيضاء صلبة وأحفظها كأيقونة iOS الرسمية للمشروع.

## الخطوات
1. نسخ الصورة المرفوعة إلى `/tmp/icon-src.png`.
2. استخدام ImageMagick (عبر `nix run nixpkgs#imagemagick`) لإنشاء نسخة 1024×1024 بخلفية بيضاء وبدون شفافية، وحفظها في:
   - `public/app-icon-1024.png` (الماستر — هذا الذي ترفعه لـ App Store Connect).
   - `public/apple-touch-icon.png` (180×180 لمتصفح iOS / Add to Home Screen).
   - `public/icon-512.png` (للـ PWA).
3. تحديث `index.html` لإضافة `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` إن لم يكن موجوداً.
4. تحديث `public/manifest.webmanifest` ليشير إلى الأيقونات الجديدة.
5. عرض الأيقونة الناتجة في الردّ لتأكيدها بصرياً.

## ما عليك فعله بعد ذلك
- لـ **App Store**: تنزيل `app-icon-1024.png` من مجلد `public/` ورفعها في App Store Connect → App Information → App Icon.
- لو تستخدم Capacitor للنشر الأصلي: سأخبرك بأمر `npx cap assets generate` لتوليد كل مقاسات iOS تلقائياً من هذه الصورة.

## ملاحظة
لن أغيّر شعار الإعدادات داخل التطبيق — فقط أيقونة الـ iOS/PWA.