# المشكلة الجذرية

بعد رفع/رسم التوقيع، يحدث التسلسل التالي خلال أقل من ثانية:

1. `persistAndShow` يرفع الملف لـ Storage ويحدّث `profiles.signature_path` + `signature_updated_at`.
2. ينشئ data URL محلياً ويستدعي `primeSignatureCache(url)` → الذي **يُطلق `signatureBus.emit()` على نفس الجهاز**.
3. تظهر رسالة "تم حفظ التوقيع" ✅
4. لكن بالتوازي تنطلق **ثلاث آليات تحديث متزامنة**:
   - `signatureBus.on(...)` داخل `SignatureManager` → `refresh({ hard: true })` → **يمسح الكاش الذي للتوّ كُتب** ويحاول إعادة التنزيل من Storage.
   - اشتراك Realtime المحلي على `profiles` (UPDATE) → نفس المسح والتنزيل.
   - `RealtimeSync` العام يرى نفس حدث `profiles` UPDATE → يمسح الكاش ويستدعي `preloadSignature()` ويطلق البص.

نتيجة هذا التدافع:
- التنزيل من Storage يحدث قبل أن تنتشر صلاحيات الملف الجديد على عُقد التخزين على iOS أحياناً، فيفشل بهدوء.
- `loadSignature` يرى `signature_path` موجود لكن `download` يفشل → يُعيد `url=null` (لأن الكاش كان قد مُسح للتوّ).
- `setDataUrl(null)` يُفرغ المعاينة، فيظن المستخدم أن التوقيع لم يُحفظ.

أيضاً عند فشل التنزيل يخرج toast خطأ "تعذّر تحميل التوقيع" حتى في وضع `silent` لأن شرط الخطأ في `refresh()` لا يحترم `silent`.

# الحل

## 1. لا تمسح الكاش الذي للتوّ كُتب
في `src/lib/signature.ts`:
- إضافة طابع زمني `lastLocalPrimeAt` داخل الموديول يُضبط داخل `primeSignatureCache` و`saveSignature`.
- `clearSignatureCache` يقبل خياراً `respectRecentPrime` يتجاهل المسح إذا مرّ أقل من 5 ثوانٍ على آخر prime محلي.
- `preloadSignature` و`loadSignature` يحترمان نفس النافذة: إذا الكاش الحالي يطابق `signature_updated_at` من الخادم → استخدمه مباشرة بدون أي تنزيل.

## 2. منع الـ echo داخل نفس الجهاز
- `primeSignatureCache` **لا يُطلق `signatureBus.emit()` فوراً**. السبب: التطبيق الذي حفظ يعرف القيمة الجديدة، ولا يحتاج إشعار نفسه.
- يُطلق البص فقط من `deleteSignature` ومن مستمعي Realtime على الأجهزة الأخرى.

## 3. تبسيط `SignatureManager`
- إزالة اشتراك Realtime المحلي المكرر (يُغطّيه `RealtimeSync` العام).
- مستمع `signatureBus` و`visibilitychange`/`focus` يستخدم `refresh({ silent: true })` بدون `hard: true`. مسح الكاش يصبح من اختصاص `loadSignature` فقط عند اكتشاف اختلاف الـ timestamp.
- إخفاء toast الخطأ في وضع `silent` (يبقى `console.warn` فقط).

## 4. تأخير قصير قبل أول تنزيل بعد الرفع
- في `saveSignature`، بعد `upload` ناجح، نعتبر القيمة المرفوعة هي المصدر المعتمد ولا نعيد جلبها. الكاش يُكتب من الـ blob الأصلي مع `signature_updated_at` المرسل في `UPDATE`.
- لو احتجنا تأكيد، نقرأ `signature_updated_at` بعد `update().select().single()` بدلاً من توليده محلياً.

## 5. حماية إضافية في `RealtimeSync`
- عند استقبال UPDATE على `profiles` لنفس المستخدم، نقارن `signature_updated_at` الجديد مع آخر طابع زمني محلي. إذا متطابق (نحن من أحدثه) → لا شيء. وإلاّ → امسح الكاش وأطلق البص.

# الملفات المتأثرة

- `src/lib/signature.ts` — منطق الكاش، `lastLocalPrimeAt`، إصلاح `primeSignatureCache`، `saveSignature` يُرجع `signature_updated_at` الفعلي.
- `src/components/SignatureManager.tsx` — إزالة اشتراك Realtime المحلي، إزالة `hard: true` من المستمعين، احترام `silent` في رسائل الخطأ.
- `src/lib/realtimeSync.tsx` — مقارنة الطابع الزمني المحلي قبل مسح الكاش وإطلاق البص.

# النتيجة المتوقعة

- بعد الحفظ، التوقيع يظهر فوراً ويبقى ظاهراً (لا يختفي بعد ثانية).
- لا تنزيل تخزيني فوري بعد كل رفع — الكاش هو نفس الـ blob المرفوع.
- المزامنة بين الأجهزة الأخرى تبقى كما هي عبر Realtime + مقارنة الطابع الزمني.
