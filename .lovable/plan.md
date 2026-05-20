## الوضع الحالي ✅

مشروعك **مُجهّز بالكامل** لـ Capacitor — لا حاجة لأي تعديلات على الكود:
- `capacitor.config.ts` موجود ومضبوط (appId, appName: Amlaki, خلفية cream)
- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/splash-screen` مثبّتة
- Splash screen مضبوط بألوان الهوية

## ماذا سأفعل

لا توجد تعديلات كود مطلوبة على Lovable. سأقدّم لك **دليل تشغيل خطوة بخطوة** على جهازك بعد تصدير المشروع.

## الخطوات على جهازك

### 1. تصدير المشروع
- اضغط زر **GitHub** أعلى يمين Lovable → **Export to GitHub**
- استنسخ المشروع: `git clone <repo-url>`

### 2. تثبيت الاعتماديات
```bash
cd amlaki
npm install
```

### 3. إضافة المنصات
```bash
npx cap add ios       # يحتاج macOS + Xcode
npx cap add android   # يحتاج Android Studio
```

### 4. بناء التطبيق ومزامنته
```bash
npm run build
npx cap sync
```

### 5. التشغيل
```bash
npx cap run ios       # على Mac
npx cap run android   # على أي نظام
```

## المتطلبات

| المنصة | الأداة المطلوبة | النظام |
|--------|----------------|--------|
| iOS | Xcode 15+ | macOS فقط |
| Android | Android Studio | Windows / Mac / Linux |
| App Store | حساب Apple Developer ($99/سنة) | — |
| Google Play | حساب Google Play ($25 مرة واحدة) | — |

## وضع التطوير السريع (Hot Reload)

ملفك يدعم بالفعل التحديث الفوري من sandbox Lovable. لتفعيله:
```bash
CAP_ENV=dev npx cap sync
npx cap run ios
```
سيتصل التطبيق مباشرة بـ Lovable preview ويعكس تغييراتك فوراً.

## بعد كل تحديث في Lovable
```bash
git pull
npm install
npm run build
npx cap sync
```

## للنشر على المتاجر

- **iOS**: افتح `npx cap open ios` → Xcode → Archive → Distribute to App Store
- **Android**: افتح `npx cap open android` → Build → Generated Signed Bundle → ارفع لـ Play Console

📖 **اقرأ المقال الرسمي لتفاصيل أكثر**:
https://lovable.dev/blog/mobile-development-with-capacitor

---

**هل أبدأ التنفيذ؟** ملاحظة: المشروع جاهز فعلياً، لذا "التنفيذ" هنا يعني فقط التأكد من الإعدادات. إذا أردت إضافات (إشعارات Push، كاميرا أصلية، Face ID...) أخبرني وسأضيف الـ plugins المناسبة.
