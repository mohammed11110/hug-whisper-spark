# إصلاح شاشة بيضاء على https://amlaki1.app

## المشكلة
النسخة المنشورة على الدومين تعرض شاشة بيضاء على المتصفح بسبب خطأ JavaScript:

```
TypeError: Cannot read properties of undefined 
(reading '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED')
   at react-vendor-ByxrdbF-.js
```

السبب الجذري في `vite.config.ts` — قاعدة `manualChunks`:
- تضع `react-dom` و `react-router` و `scheduler` في chunk اسمه **react-vendor**
- لكن `react` نفسه لا يطابق أي شرط ⇒ يذهب إلى chunk افتراضي
- `react-dom` يحمّل قبل `react` ⇒ ينهار التطبيق

النسخة الـ Preview وiOS WebView (بعد `cap sync`) لا تظهر المشكلة لأنها dev build بدون code splitting.

## التغيير المطلوب
ملف واحد فقط: `vite.config.ts` — تعديل سطر واحد ليضم `react` إلى نفس الـ chunk:

```ts
// قبل
if (id.includes("/react-dom/") || id.includes("/react-router") || id.includes("/scheduler/")) 
  return "react-vendor";

// بعد
if (
  id.includes("/node_modules/react/") ||
  id.includes("/node_modules/react-dom/") ||
  id.includes("/react-router") ||
  id.includes("/scheduler/")
) return "react-vendor";
```

هذا يضمن تحميل `react` و `react-dom` في نفس الملف وبالترتيب الصحيح.

## ما لن يتغير
- لا تعديل على أي صفحة، UI، ألوان، PDF، أو منطق
- لا تعديل على iOS / Android native
- لا migrations
- لا تغيير في الـ design tokens

## بعد الإصلاح
1. **Publish → Update** لإعادة نشر النسخة على `amlaki1.app`
2. مسح cache المتصفح أو فتح نافذة خاصة للاختبار
3. لا حاجة لإعادة `cap sync` لأن iOS WebView لا يستخدم البناء المنشور للويب
