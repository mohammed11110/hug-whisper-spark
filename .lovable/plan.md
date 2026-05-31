## المشكلة
معاينة العقد وكشف الحساب PDF تعرض الأحرف العربية منفصلة (غير موصولة).

## السبب الجذري
المعاينة تستخدم `<iframe srcDoc={html}>`. داخل `srcdoc` يكون أصل المستند `about:srcdoc`، فتفشل المسارات النسبية للخطوط (`/fonts/NotoKufiArabic-*.ttf`) المضمّنة عبر `@font-face` في HTML المُولَّد. عند فشل تحميل خط Noto Kufi Arabic يسقط المتصفح إلى خط افتراضي لا يدعم وصل الحروف العربية فتظهر منفصلة.

ملاحظة: التنزيل والطباعة الفعليان يعملان بشكل صحيح لأنهما يمرّان عبر html2canvas مع خطوط محمّلة مسبقاً في التطبيق — المشكلة محصورة في الـ iframe فقط.

## الإصلاح

**ملف واحد فقط: `src/components/FilePreviewDialog.tsx`**

حقن وسم `<base href="${window.location.origin}/">` داخل `<head>` الـ HTML قبل تمريره إلى `srcDoc`، حتى تُحلّ مسارات الخطوط النسبية إلى أصل التطبيق ويتم تحميل Noto Kufi Arabic بنجاح.

```ts
const withBase = (html: string) => {
  const base = `<base href="${window.location.origin}/">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  }
  return `<!doctype html><html dir="rtl" lang="ar"><head>${base}</head><body>${html}</body></html>`;
};

<iframe srcDoc={withBase(payload.html)} ... />
```

## التحقق
- فتح معاينة العقد (عماني وعام) → التأكد من وصل الأحرف.
- فتح معاينة كشف حساب المستأجر PDF → التأكد من وصل الأحرف.
- التأكد أن CSV preview والتنزيل والطباعة لم تتأثر.

## خارج النطاق
- لا تعديل على `src/lib/pdfDocs.ts`.
- لا تعديل على `src/pages/UnitDetail.tsx`.
- لا تغيير على منطق التنزيل/الطباعة.
