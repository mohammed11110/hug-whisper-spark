## 1) نتيجة فحص الأمان (إعادة الفحص)

أعدت تشغيل الفحص الكامل. **لا توجد ثغرات قابلة للاستغلال جديدة.** ما ظهر:

- **50 تنبيهًا متطابقًا** من نوع `SECURITY DEFINER function executable` — وهذه فحوصات داخلية لـ Supabase على دوال نظامية (مثل `pgmq.*`، `auth.*`، إلخ) وعلى دوالنا الـ SECURITY DEFINER التي **تتطلّب** هذه الصلاحية لتعمل (مثل `has_role`, `has_building_access`, `log_activity`, `redeem_promo_code`, `allocate_receipt_numbers`…). كل دالة تتحقق من `auth.uid()` داخليًا. هذه ضوضاء معيارية، ليست ثغرات.
- **3 ملاحظات "verify"** (warn فقط، لا exploit):
  1. `invitations.token` مرئي لصاحب الدعوة عبر بريده — هذا مقصود لأن التوكن يُرسَل أصلًا بالبريد كرابط القبول.
  2. `promo_codes` — لا توجد سياسة SELECT للمستخدم العادي (صحيح)، والاستبدال يتم عبر RPC SECURITY DEFINER مع تحقق كامل (`redeem_promo_code`). سليم.
  3. `activity_log` / `in_app_notifications` على Realtime — Supabase Realtime يُطبّق RLS صفًا بصف. سبق تأكيد هذا السلوك المقصود.

**النتيجة: لا يوجد إجراء أمني مطلوب.** سأحدّث ذاكرة الأمان لتثبيت هذه القرارات.

---

## 2) إكمال التهيئة الأصلية (Capacitor)

ملاحظة: مكوّنات الإيصالات/الـPDF تستخدم بالفعل `nativeFiles.ts` (الإضافات مثبّتة: filesystem, share, browser). لكن **بقيت 6 مسارات browser-only** تنكسر داخل WebView على iOS/Android. الخطّة تركّز عليها وحدها.

### المسارات المنكسرة حاليًا في التطبيق الأصلي

| # | الملف | السلوك الحالي | السلوك بعد الإصلاح |
|---|---|---|---|
| 1 | `src/lib/exportCSV.ts` | `<a download>` لا يعمل في WebView | على native: تحويل إلى Blob → `shareBlobNative()` (Save to Files / إرسال) |
| 2 | `src/pages/Backup.tsx` (تنزيل JSON) | نفس المشكلة | نفس المعالجة |
| 3 | `src/pages/Settings.tsx` (تصدير إعدادات JSON) | نفس المشكلة | نفس المعالجة |
| 4 | `src/pages/Admin.tsx` (تصدير CSV) | نفس المشكلة (يَمرّ عبر helper مشترك بعد توحيد exportCSV) | يُحَلّ تلقائيًا عند إصلاح #1 |
| 5 | `src/components/FileUpload.tsx` (معاينة الملف) | `window.open(signedUrl)` يُحجب في WebView | استخدام `Browser.open({ url })` على native |
| 6 | `src/pages/Maintenance.tsx` (`<a target=_blank>` لصورة الصيانة) | يفتح فارغًا في WebView | تحويلها لزر يستدعي `Browser.open` على native، ويبقى رابطًا على web |

### روابط خارجية (Paddle Customer Portal، WhatsApp، إلخ)

ثلاث نقاط تستخدم `window.open` لروابط خارجية، وهي تعمل عادة لكن يُفضّل استخدام Capacitor `Browser.open` لفتح in-app browser موحّد بدل المتصفح الخارجي:

- `src/components/GraceBanner.tsx:46` (Paddle portal)
- `src/pages/Settings.tsx:94` (Paddle portal)
- `src/pages/Pricing.tsx:142` (Paddle checkout fallback)
- `src/components/BusinessWhatsAppSection.tsx:69` (`wa.me/...`)
- `src/components/PaymentTestModeBanner.tsx` (رابط docs)

سأضيف helper موحّد `openExternal(url)` في `nativeFiles.ts` يختار `Browser.open` على native و`window.open` على web.

### الكاميرا (`@capacitor/camera`)

التطبيق حاليًا يستخدم `<input type="file" accept="image/*" capture="environment">` في `FileUpload.tsx`. هذا **يعمل** على iOS/Android WebView مع إذن الكاميرا الافتراضي (Capacitor 8 يطلبه عبر Info.plist تلقائيًا). إضافة `@capacitor/camera` تتطلّب إعادة كتابة كاملة لمسار الرفع. **مقترحي: عدم إضافتها الآن** ما لم يبلّغ المستخدم عن عطل فعلي في الكاميرا داخل التطبيق الأصلي. إن كنت ترغب بإضافتها أخبرني، وسأعدّل الخطّة.

### تفاصيل تقنية للتنفيذ

**A. `src/lib/exportCSV.ts`** — تعديل دالة `downloadCSV()`:
```ts
if (isNative()) {
  await shareBlobNative(blob, finalName, { title: finalName });
  return;
}
// existing <a download> path …
```

**B. `src/lib/nativeFiles.ts`** — إضافة:
```ts
export async function openExternal(url: string) {
  if (isNative()) await Browser.open({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
}
export async function saveJsonNative(obj: unknown, filename: string) { /* JSON → Blob → share */ }
```

**C. `Backup.tsx` و `Settings.tsx`** — استبدال `<a download>` بـ `saveJsonNative()` على native.

**D. `FileUpload.tsx` و `Maintenance.tsx`** — استبدال `window.open` / `<a target=_blank>` بـ `openExternal()`.

**E. `GraceBanner.tsx`، `Settings.tsx` (portal)، `Pricing.tsx`** — استبدال `window.open(data.url)` بـ `openExternal(data.url)`.

**F. `Info.plist` / `AndroidManifest`** — لا تغييرات مطلوبة. `@capacitor/share` و`@capacitor/filesystem` يديران الأذونات الافتراضية. الكتابة إلى `Directory.Cache` لا تحتاج إذن مكتبة الصور.

### بعد التنفيذ

ستحتاج محليًا:
```bash
git pull
npm install     # لا توجد إضافات جديدة
npx cap sync ios
npx cap sync android
```
ثم اختبار على جهاز حقيقي:
- تصدير CSV من Admin → يفتح Share sheet → احفظ في Files / أرسل واتساب ✅
- نسخ احتياطي JSON من Backup ✅
- تصدير إعدادات JSON من Settings ✅
- معاينة عقد/هوية مرفوعة من FileUpload → يفتح PDF viewer داخل التطبيق ✅
- صورة صيانة من Maintenance → تفتح في in-app browser ✅
- زر Paddle customer portal → in-app browser ✅
- زر "أرسل كود واتساب" → in-app browser ثم العودة ✅

### الملفات التي ستتغيّر

- `src/lib/nativeFiles.ts` (إضافة `openExternal` + `saveJsonNative`)
- `src/lib/exportCSV.ts`
- `src/pages/Backup.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Admin.tsx` (مراجعة فقط — يَمرّ عبر helper)
- `src/components/FileUpload.tsx`
- `src/pages/Maintenance.tsx`
- `src/components/GraceBanner.tsx`
- `src/pages/Pricing.tsx`
- `src/components/BusinessWhatsAppSection.tsx`

لا تغييرات على قاعدة البيانات. لا migrations. لا secrets جديدة.

اقرأ هذه التدوينة لمزيد من التفاصيل حول Capacitor:
https://lovable.dev/blog/2025-02-25-building-a-mobile-app-with-lovable-and-capacitor
