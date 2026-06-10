## المشكلة
عند رفع التوقيع من الآيفون، يُحفظ في:
1. `storage/signatures/{uid}.png`
2. `profiles.signature_path` يُحدّث للمستخدم

لكن على الآيباد لا يظهر لأن:
- `loadSignature()` يُستدعى مرة واحدة عند فتح الشاشة فقط — لا يوجد اشتراك Realtime على `profiles.signature_path`.
- الكاش المحلي `amlaki_signature_dataurl_v2` على الآيباد كان فارغاً قبل الرفع، ولم يُجدَّد.
- مزامنة `RealtimeSync` العامة لا تُبطل أي شيء خاص بالتوقيع، ولا تُعيد جلب الـ Storage blob.
- حتى عند العودة من الخلفية، لا يوجد `visibilitychange` listener داخل `SignatureManager`.

## الحل الجذري

### 1. مزامنة Realtime مخصّصة للتوقيع
في `src/lib/signature.ts` أضف:
- مُصدِر أحداث بسيط `signatureBus` (نمط `paymentsBus`) يطلق `'changed'` عند تحديث أو حذف التوقيع.
- اشتراك Realtime عام على `profiles` للمستخدم الحالي يُراقب تغيّر `signature_path` أو `signature_updated_at`، يُفرّغ الكاش المحلي ويُطلق `signatureBus.emit('changed')`.
- يُركَّب الاشتراك مرة واحدة من `RealtimeSync` (موجود في `AppShell`) بحيث يعمل عالمياً على جميع الأجهزة.

### 2. تحديث `SignatureManager.tsx`
- يستمع لـ `signatureBus.on('changed', () => loadSignature())`.
- يستمع أيضاً لـ `visibilitychange`/`focus` ليُعيد `loadSignature()` عند رجوع التطبيق من الخلفية (تأمين iOS الذي يقطع Realtime).
- عند `loadSignature()`، إذا كان `signature_updated_at` أحدث من تاريخ الكاش المحلي → تجاهل الكاش وحمّل من Storage مباشرة.

### 3. ختم زمني في الكاش
في `signature.ts`:
- خزّن `amlaki_signature_updated_at_v2` بجانب الـ data URL.
- قبل استخدام الكاش، قارن مع `profiles.signature_updated_at` الحالي. إذا الخادم أحدث → أعد التنزيل واستبدل الكاش.
- هذا يضمن أنه حتى لو فُتح الآيباد بكاش قديم (أو فارغ)، يجلب النسخة الصحيحة فوراً.

### 4. تحميل استباقي عند تسجيل الدخول
في `auth.tsx` أو `RealtimeSync` بعد توفّر `user.id`:
- استدعِ `loadSignature()` مرة واحدة بصمت لتعبئة الكاش، حتى لو لم يفتح المستخدم شاشة الإعدادات.
- بهذا يكون التوقيع جاهزاً لتوليد PDF فوراً على الجهاز الجديد.

### 5. تفعيل Realtime على عمود التوقيع
الجدول `profiles` مفعّل أصلاً في `supabase_realtime` ضمن مهاجرة المزامنة السابقة، لذا لا حاجة لمهاجرة جديدة — فقط نضيف المستمعين.

## النتيجة المتوقعة
- رفع التوقيع من الآيفون → ظهور فوري (ثوانٍ) على الآيباد دون إعادة تسجيل دخول أو تحديث يدوي.
- العودة من الخلفية على iOS → فحص تلقائي وتحديث.
- توليد إيصالات PDF على أي جهاز يستخدم التوقيع الصحيح دائماً.

## الملفات المتأثرة
- `src/lib/signature.ts` — إضافة `signatureBus`، ختم زمني للكاش، دالة `subscribeSignatureSync()`.
- `src/lib/realtimeSync.tsx` — تركيب الاشتراك + تحميل استباقي عند الدخول.
- `src/components/SignatureManager.tsx` — مستمعون للحدث + visibility/focus.
