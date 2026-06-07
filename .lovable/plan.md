## التغيير

حذف عبارة **PROPERTY MANAGEMENT** الظاهرة تحت اسم Amlaki / أملاكي في شاشة البداية (Splash).

## الملف المتأثر

- `src/components/AnimatedSplash.tsx` — حذف السطر:
  ```tsx
  <div className="amlaki-splash__tag">PROPERTY MANAGEMENT</div>
  ```
  مع تنظيف أي CSS مرتبط بـ `amlaki-splash__tag` إن وُجد.

## ما لن يتغيّر

النصوص الوصفية في الملفات التالية تبقى كما هي لأنها وصف داخلي للمتاجر/SEO ولا تظهر للمستخدم داخل التطبيق:
- `public/manifest.webmanifest` — اسم التطبيق في متجر PWA
- `index.html` و `public/llms.txt` — وصف SEO
- `src/pages/Terms.tsx` و `src/pages/Privacy.tsx` و `src/pages/Install.tsx` — نصوص قانونية/تعريفية

إن أردت حذفها أيضًا من هذه المواضع أخبرني وسأوسّع الخطة.

## النتيجة

شاشة البداية ستعرض فقط: **شعار المفتاح + Amlaki + أملاكي** — بدون الـ tagline.
