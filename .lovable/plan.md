## المشكلة
أداة `@capacitor/assets` تتطلب `resources/splash.png` مربعاً بحجم **2732×2732** بكسل على الأقل. الملف الحالي **1920×1080** فقط، لذا تظهر رسالة "Splash Screen GIF is missing" (الكلمة مضللة — الأداة تقصد PNG غير صالح).

## الحل
1. **استبدال `resources/splash.png`** بصورة جديدة:
   - الأبعاد: **2732 × 2732** بكسل (مربعة)
   - الخلفية: لون العلامة الكريمي `#faf6ee`
   - في المنتصف: شعار التطبيق من `resources/icon.png` بحجم ~768 بكسل
   - بدون شفافية (RGB فقط)

2. **إضافة `resources/splash-dark.png`** (نفس المواصفات لكن بخلفية داكنة `#1a1a1a`) — اختياري لكن يوصى به للوضع الليلي.

3. **عدم تعديل أي ملف آخر** — `capacitor.config.ts` والأيقونات الأخرى تبقى كما هي.

## بعد التنفيذ
بعد `git pull` على جهاز Mac، نفّذ:
```bash
npx capacitor-assets generate \
  --iconBackgroundColor '#faf6ee' \
  --iconBackgroundColorDark '#1a1a1a' \
  --splashBackgroundColor '#faf6ee' \
  --splashBackgroundColorDark '#1a1a1a'
```
ستولّد كل مقاسات iOS/Android تلقائياً دون أي رسائل خطأ.

## تفاصيل تقنية
سأستخدم ImageMagick لإنشاء الصورتين من `resources/icon.png` الموجود (1024×1024) — لا حاجة لرفع أي شيء جديد منك.
