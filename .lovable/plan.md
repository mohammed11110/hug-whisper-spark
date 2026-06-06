# تطبيق الهوية الجديدة (Midnight Gold) على iOS و Android

الهدف: مزامنة الشاشات الأصلية (Splash، خلفية التطبيق، شريط الحالة، أيقونة PWA) مع ألوان الهوية الجديدة المزدوجة Light/Dark.

## التغييرات

### 1. `capacitor.config.ts`
تحديث ألوان الخلفية والـ Splash من اللون القديم `#0d1426` إلى لون الهوية الجديد:
- `ios.backgroundColor`: `#0e1118` (Midnight الرسمي للوضع الداكن)
- `android.backgroundColor`: `#0e1118`
- `SplashScreen.backgroundColor`: `#0e1118`
- إبقاء `launchShowDuration: 500` و `showSpinner: false` كما هي

ملاحظة: نستخدم لون الـ Dark لأن شاشة الإقلاع الأصلية ثابتة ولا تتبدّل مع النظام، واللون الذهبي على Midnight هو توقيع الهوية.

### 2. `public/manifest.webmanifest` (PWA)
- `background_color`: `#0e1118` (بدل `#faf6ee`)
- `theme_color`: `#c9a44c` (الذهب الساطع — بدل الـ sage القديم `#5a7359`)

### 3. `index.html`
بالفعل يحتوي على `theme-color` مزدوج للـ light/dark — لا تغيير مطلوب.

### 4. أيقونات iOS Splash (توثيق فقط)
ملفات `ios/App/App/Assets.xcassets/Splash.imageset/` و `AppIcon` لا تُولَّد من Lovable. سأضيف ملاحظة في الرد النهائي بأن المستخدم يحتاج تشغيل `npx cap sync ios` بعد التعديل، ولو أراد تحديث صور الـ Splash نفسها (الخلفية + الشعار) عليه إعادة توليدها في Xcode أو رفع PNG جديد.

### 5. `AnimatedSplash` overlay
المكوّن الحالي يستخدم class `amlaki-splash` المعرّف في `index.css` — سأتحقق من الألوان داخله وأحدّثها إن كانت لا تزال تشير إلى `#0d1426` لضمان انسجام كامل مع `#0e1118`.

## ملفات ستُعدَّل
- `capacitor.config.ts`
- `public/manifest.webmanifest`
- `src/index.css` (فقط قسم `.amlaki-splash` إن لزم)

## ما لن يتغير
- منطق الأعمال، التوجيه، المصادقة، قاعدة البيانات.
- ملفات `ios/` و `android/` الأصلية (تُولَّد محلياً عند المستخدم عبر `npx cap sync`).

## خطوات المستخدم بعد التطبيق
1. `git pull`
2. `npx cap sync ios && npx cap sync android`
3. إعادة بناء المشروع في Xcode / Android Studio.
