# إصلاح حزمة الأيقونات والصور لكل أحجام الأجهزة

## المشكلة
رفض App Store Connect بسبب نقص الأيقونات بمقاسات:
- `120×120` (iPhone @2x/@3x)
- `167×167` (iPad Pro @2x)
- وغالباً أيضاً `1024×1024` Marketing، `152×152` (iPad)، `76×76`، `40/58/80/87` للإشعارات/الإعدادات.

السبب: مجلد `ios/App/App/Assets.xcassets/AppIcon.appiconset` على جهاز Mac لديك لا يحتوي PNGs لكل المقاسات لأن `npx capacitor-assets generate` لم يُشغَّل بعد آخر `cap add ios`، أو شُغِّل قبل تحديث `resources/icon.png`.

الملف المصدر `resources/icon.png` (1024×1024، RGB بدون شفافية) صحيح ومتوافق مع متطلبات Apple، لذا الحل هو **إعادة توليد** الحزمة وضمان نسخها داخل المشروع الأصلي.

## الخطة

### 1. تحسين مصدر الأيقونة (اختياري لكن موصى به)
توليد أيقونة 1024×1024 بجودة premium بهوية أملاكي (مفتاح ذهبي/sage على خلفية متدرجة من sage-400 إلى sage-600 مع زخرفة نباتية خفيفة) بدلاً من ملف `resources/icon.png` الحالي — لضمان وضوح أعلى عند التصغير إلى 40px.
- حفظ النتيجة في `resources/icon.png` (RGB، بدون شفافية).
- توليد `resources/icon-foreground.png` (شفاف، الشعار فقط داخل safe-zone 66%) و `resources/icon-background.png` (لون sage صلب) لـ Android Adaptive Icon.

### 2. ضمان توليد كامل لكل المقاسات
إضافة ملف `assets.config.json` في الجذر يجبر `@capacitor/assets` على توليد كل المقاسات بما فيها iPad Pro:

```json
{
  "ios": {
    "iconBackgroundColor": "#5f7e65",
    "iconBackgroundColorDark": "#2c3a2e"
  },
  "android": {
    "iconBackgroundColor": "#5f7e65",
    "iconBackgroundColorDark": "#2c3a2e",
    "adaptiveIconForegroundImage": "resources/icon-foreground.png",
    "adaptiveIconBackgroundImage": "resources/icon-background.png"
  }
}
```

### 3. أتمتة التوليد قبل أي build
تعديل سكربتات `package.json`:
- `"build:ios": "npm run build && npm run cap:icons:ios && npx cap sync ios"`
- `"build:android": "npm run build && npm run cap:icons:android && npx cap sync android"`

هكذا يستحيل أن تنسى توليد الأيقونات قبل الأرشفة في Xcode.

### 4. تحديث `APP_STORE_CHECKLIST.md`
إضافة قسم صريح:
> قبل كل Archive في Xcode:
> ```
> git pull
> npm install
> npm run build:ios
> ```
> ثم في Xcode: Product → Clean Build Folder → Archive.

### 5. ملاحظات تقنية (للمطور)
- `@capacitor/assets@3.0.5` يولّد كل المقاسات التي يطلبها App Store تلقائياً من `resources/icon.png` بشرط أن يكون 1024×1024 RGB.
- المقاسات المُنتَجة لـ iOS: 20, 29, 40, 58, 60, 76, 80, 87, **120**, 152, **167**, 180, 1024.
- لا يجب أن تحتوي أيقونة iOS على alpha channel — حالياً المصدر صحيح.
- بعد التوليد، تحقّق من `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json` بأنه يحتوي مدخلات لـ `60x60@2x` (=120) و `83.5x83.5@2x` (=167).
- Splash موجود بدقة 2732×2732 وهو كافٍ لكل الأجهزة.

## ما سأنفّذه عند الموافقة
1. توليد أيقونة premium جديدة + foreground/background للأندرويد.
2. إضافة `assets.config.json`.
3. تعديل `package.json` بسكربتات `build:ios` و `build:android`.
4. تحديث `APP_STORE_CHECKLIST.md` بالتعليمات بالعربية والإنجليزية.

بعدها تنفذ على Mac:
```bash
git pull && npm install && npm run build:ios
```
ثم Archive في Xcode وسيقبل App Store الرفع.
