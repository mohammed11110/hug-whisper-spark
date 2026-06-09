
## المشكلتان

1. **الرفع لا "يظهر" بعد الحفظ**: في `SignatureManager.tsx` نعتمد بعد الحفظ على دورة كاملة (تحديث `profiles.signature_path` → تنزيل الملف من جديد من Storage → تحويله إلى Data URL). أي خطأ صامت في أي خطوة (تحديث الملف الشخصي يعيد 0 سطر، كاش متصفح، عدم انتظار الكاش، أو فشل قراءة الصورة في الـ`<img>`) ينتج عنه بقاء المعاينة فارغة رغم نجاح الرفع.
2. **خانة رسم التوقيع صغيرة 3:1 داخل مودال صغير**، والخط 2.2px ثابت يبدو خشناً.

## الحل (واجهة فقط — لا تغييرات على قاعدة البيانات)

### 1) ملف `src/components/SignatureManager.tsx`

- **عرض فوري بعد الحفظ بدون round-trip**: بعد `saveSignature(blob)` بنجاح، نحوّل نفس `blob` المرفوع إلى Data URL ونضعه مباشرة في `setDataUrl(...)` بدل الاعتماد على `refresh()`. `refresh()` يبقى للتحميل الأول/التحديث اليدوي فقط.
- **قبول أوسع للملفات + حماية HEIC**: تغيير `accept` إلى `image/*` (مع إبقاء قائمة بيضاء PNG/JPEG/WEBP في الكود)، ورسالة واضحة عند HEIC: "صيغة HEIC غير مدعومة — حوّلها إلى JPG/PNG".
- **معالجة JPG بشكل صحيح**: ملء خلفية بيضاء قبل `drawImage` لتجنّب ظهور سواد عند بعض المتصفحات، وضمان أن الناتج PNG فعلاً (`Blob.type === image/png`).
- **رسائل خطأ تشخيصية**: التقاط الخطأ الفعلي من Storage/profile.update وعرضه (بدل "تعذّر الحفظ" المبهم) حتى نرى السبب الحقيقي إن تكرر.
- **تنظيف الـ `<img>` cache**: إضافة `?v={Date.now()}` على Data URL غير ضروري، لكن سنفرض إعادة mount عبر `key={dataUrl}` لضمان إعادة الرسم.

### 2) مودال الرسم — أكبر وأدق

- **ملء الشاشة**: `DialogContent` بـ `max-w-[100vw] w-screen h-[100dvh] sm:rounded-none p-0` مع شريط علوي (عنوان + زر إغلاق) وشريط سفلي (مسح/تراجع/حفظ) ومنطقة canvas تأخذ كل المساحة المتبقية.
- **نسبة العرض الذكية**: على الموبايل nudge للوضع الأفقي عبر CSS `landscape` hint، والـcanvas يستخدم `width:100%; height:100%` بدل `aspect-ratio: 3/1`.
- **دقة عالية**: `devicePixelRatio` يبقى، لكن نزيد سقفه إلى `min(dpr, 3)` لتجنّب canvases ضخمة على شاشات 4x.
- **خط أدق وأكثر سلاسة**:
  - تقليل `lineWidth` الأساسي إلى 1.4px.
  - **سُمك متغيّر حسب السرعة** (pressure-like): عند الحركة البطيئة 2.0px، السريعة 0.8px — يعطي إحساس قلم حقيقي.
  - استخدام `pressure` من PointerEvent عند توفّره (Apple Pencil / S-Pen).
  - تنعيم Catmull-Rom spline بدل quadratic بسيط، مع رسم تدريجي للـstroke الحالي فقط (لا redraw كامل عند كل حركة — تحسين أداء كبير).
  - `getCoalescedEvents()` لالتقاط نقاط أكثر بين الإطارات على الأجهزة عالية الـHz.

### تفاصيل تقنية

```ts
// instead of refresh() after save:
const dataUrl = await blobToDataUrl(blob);
setDataUrl(dataUrl);
// also persist in sessionStorage so other pages see it
sessionStorage.setItem("amlaki_signature_dataurl_v1", dataUrl);
sessionStorage.setItem("amlaki_signature_uid_v1", uid);
```

```ts
// variable-width stroke segment
const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
const speed = dist / Math.max(1, dt);          // px/ms
const width = clamp(2.0 - speed * 0.9, 0.8, 2.0) 
            * (event.pressure > 0 ? 0.6 + event.pressure * 0.8 : 1);
ctx.lineWidth = width;
```

## خارج النطاق

- لا تغيير على bucket `signatures`، RLS، أو جدول `profiles`.
- لا تغيير على حقن التوقيع في PDF (`pdfDocs.ts`) — يقرأ من نفس الـcache.
