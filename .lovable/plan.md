## التشخيص

الويب يعمل تمامًا (تحققتُ من `/welcome` و `/` — يُحمَّلان دون أخطاء runtime). إذن المشكلة **في بنية Capacitor فقط**، لا في React/Router/Suspense/ErrorBoundary.

السبب الجذري الأرجح (واحد أو أكثر مما يلي):

1. **النسخة المثبّتة على الجهاز قديمة** — مبنيّة قبل تعديل `capacitor.config.ts` عندما كان `server.url` يشير دائمًا إلى `https://c6fcf97d-...lovableproject.com`. هذا الرابط الآن محميّ ويرجع **401** (مؤكَّد من logs المعاينة)، فيظهر WebView أبيض.
2. **مجلد `dist/` فارغ أو قديم** — لم يتم تشغيل `npm run build` قبل `npx cap sync`.
3. **مسار الأصول المطلقة (`/assets/...`)** قد يفشل أحيانًا في WebView على iOS إذا لم يكن `base` معرَّفًا بشكل آمن.

لا تغييرات في الواجهة. إصلاح startup فقط.

## الخطة

### 1. `vite.config.ts` — تعيين base آمن لـ Capacitor
إضافة `base: "./"` ليُولِّد Vite مسارات أصول نسبيّة تعمل تحت `capacitor://localhost` و `file://` و الويب معًا.

```ts
export default defineConfig(({ mode }) => ({
  base: "./",
  // ...بقية الإعدادات كما هي
}));
```

### 2. `capacitor.config.ts` — تأكيد أنّ `server.url` لن يُسرَّب في بناء الإنتاج
الملف صحيح حاليًا (يُفعَّل `server.url` فقط حين `CAP_ENV=dev`). نُضيف تعليقًا توضيحيًا بسيطًا فقط — لا تغيير سلوكي.

### 3. حذف `server.url` المُخبَّأ في native (إن وجد)
إذا كان لدى المستخدم مجلد `ios/` أو `android/` من بناء سابق، فقد يحتوي `ios/App/App/capacitor.config.json` على `server.url` قديم تم تجميده وقت `npx cap add`. سنُذكِّر المستخدم بإعادة التوليد عبر:
```
rm -rf ios android
npm run build
npx cap add ios
npx cap add android
npx cap sync
```
أو حذف حقل `server` يدويًا من `ios/App/App/capacitor.config.json` و `android/app/src/main/assets/capacitor.config.json` ثم `npx cap sync`.

### 4. تعليمات الإعادة (نطلبها من المستخدم بعد دمج التغييرات)
```
git pull
npm install
npm run build
npx cap sync
npx cap run ios      # أو: npx cap open ios ثم Build في Xcode
```

## ملاحظات تقنية

- لا حاجة لتعديل `App.tsx` أو `RequireAuth` أو `OnboardingTour` أو `Suspense` — كلها تعمل بشكل صحيح على الويب.
- `ErrorBoundary` و Sentry init سليمان؛ لا يلتقطان أي خطأ لأن الفشل يحدث على مستوى تحميل WebView نفسه (قبل React).
- بعد `base: "./"` ستظل المعاينة في Lovable تعمل تمامًا كما هي.

## الملفات المعدَّلة

- `vite.config.ts` — إضافة `base: "./"`
- `capacitor.config.ts` — تعليق توضيحي فقط (اختياري)
