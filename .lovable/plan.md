## المشكلة الفعلية

التزامن الحالي يعتمد على Realtime عبر جدول `profiles`. هذا يفشل في حالات شائعة:
- الجهاز الثاني في الخلفية (iOS يجمّد WebSocket تماماً)، فلا تصل رسالة Realtime.
- اشتراك Realtime على `profiles` يتطلب أن تسمح RLS بقراءة الصف المعدّل — وكثيراً ما يصل الحدث بدون payload `new` بسبب RLS، فيخفق `signature_updated_at !== oldTs` بصمت.
- الكاش المحلي في الجهاز الثاني يحمل `signature_updated_at` قديم. عند فتح التطبيق لاحقاً، `loadSignature` يقارن الطابعَين فقط إذا نجح استعلام `profiles`. لو حدث أي خطأ شبكة عابر يعود الكاش القديم ولا يُعاد المحاولة.

## الحل الجذري — مصدر حقيقة واحد + إبطال إجباري عند الرجوع

### 1. سياسة "always-verify on resume" بدل الاعتماد على Realtime
في كل **mount / focus / visibilitychange→visible / online / SIGNED_IN / TOKEN_REFRESHED**:
- اجلب `signature_updated_at` من الخادم.
- قارنه بـ `localStorage[amlaki_signature_updated_at_v2]`.
- إن اختلف → امسح الكاش، نزّل من Storage، أعِد العرض، وأطلق `signatureBus`.

هذا يضمن أن **أي رجوع للتطبيق ⇒ التوقيع الجديد يظهر فوراً**، حتى لو لم يصل Realtime أبداً.

### 2. تأكيد أن Realtime يرى الحدث فعلاً (مساعد فقط)
- التحقق من أن `profiles` ضمن `supabase_realtime` publication و`REPLICA IDENTITY FULL` (موجود).
- تعديل اشتراك `RealtimeSync` على `profiles` ليفلتر `id=eq.${uid}` صراحةً (أسرع وأكثر موثوقية).
- عند وصول الحدث، نعتمد فقط على وجود `payload.new.signature_updated_at` ونقارنه بـ localStorage — لا نعتمد على `payload.old`.

### 3. إصلاح حالة "الكاش يبقى قديماً للأبد"
- إضافة عدّاد TTL: إن مرّ أكثر من 30 ثانية بدون تحقق، أي قراءة لـ `getSignatureDataUrl` (PDF أو UI) تستدعي `loadSignature` بدل العودة الفورية للكاش.
- `loadSignature` الحالي يقارن timestamps لكنه لا يُجبر إبطال الكاش لو فشل استعلام `profiles` — سنُعيد المحاولة مرة واحدة قبل القبول.

### 4. شارة تأكيد بصرية صغيرة
في `SignatureManager`: شارة تعرض آخر تحديث للتوقيع (مثلاً "محدّث الآن" / "محدّث قبل دقيقتين") مأخوذة من `signature_updated_at`، حتى يرى المستخدم أن الجهاز فعلاً جلب آخر نسخة.

## الملفات المتأثرة

- `src/lib/signature.ts` — دالة `verifySignatureFresh()` جديدة تُستدعى عند resume، TTL 30 ثانية، إعادة محاولة عند فشل profiles.
- `src/components/SignatureManager.tsx` — استدعاء `verifySignatureFresh` بدل `refresh({silent:true})` في visibilitychange/focus/online، وعرض شارة آخر تحديث.
- `src/lib/realtimeSync.tsx` — فلترة `id=eq.${uid}` على اشتراك profiles، الاعتماد على `new.signature_updated_at` فقط.
- (اختياري) إضافة مستمع `window 'online'` event للتحقق فور عودة الإنترنت.

## النتيجة المتوقعة

- iPhone يحفظ التوقيع → iPad في الخلفية → فور فتحه/تركيزه ⇒ التوقيع الجديد يظهر **بدون أي ضغط على تحديث**.
- لو وصل Realtime، التحديث فوري حتى والـ iPad مفتوح.
- لو فشل Realtime (شبكة سيئة، iOS جمّد WebSocket)، فالـ "verify on resume" يضمن المزامنة خلال أقل من ثانية بعد الفتح.
- PDF/الإيصالات تستخدم دائماً آخر توقيع لأن `getSignatureDataUrl` يحترم TTL.
