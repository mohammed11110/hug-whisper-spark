# تشخيص: لماذا تظهر "آخر تحقق · خطأ" و"آخر حدث Realtime —"؟

اللوحة الحالية تخفي **سبب** الخطأ في `verifySignatureFresh`، وأيضاً لا تخبرنا إن كانت قناة Realtime متصلة أصلاً. سأوسّع التشخيص حتى نعرف بالضبط أين تنكسر السلسلة.

## الفرضيات المحتملة لـ "verify · خطأ"
1. `supabase.auth.getUser()` يرجع `null` (مثلاً عند زيارة `/welcome` بدون جلسة) → اللوحة تعرض خطأ بينما السبب الحقيقي هو "غير مسجّل دخول".
2. استعلام `profiles` يفشل بسبب RLS أو شبكة.
3. تنزيل الملف من Storage يفشل.

## "آخر حدث Realtime —" يعني
- لم يصل أي حدث `profiles` للقناة منذ فتح الصفحة. قد يكون السبب:
  - لم يحدث تحديث فعلي على `profiles` من جهاز آخر بعد.
  - القناة لم تصل لحالة `SUBSCRIBED` (شبكة/توكن).
  - `profiles` غير مُضافة لـ `supabase_realtime` publication.

## الخطوات

### 1) `src/lib/signature.ts` — توسيع `SignatureDiag`
أضف حقول:
- `lastVerifyError: string | null` — رسالة الخطأ الفعلية (auth/profile/download).
- `lastVerifyStage: "auth" | "profile" | "download" | "done" | null` — أين توقّفنا.
- `verifyCount`, `realtimeCount` — عدّادات تراكمية.

عدّل كل فرع خطأ في `verifySignatureFresh` ليكتب `lastVerifyError` بنص واضح:
- `no-user` عندما `uid === null`.
- `profile: <message>` عند فشل استعلام `profiles` (بعد المحاولة الثانية).
- `download: <message>` عند فشل Storage.

### 2) `src/lib/realtimeSync.tsx` — تشخيص حالة القناة
أضف لـ `signatureDiag` حقول:
- `channelStatus: "idle" | "joining" | "subscribed" | "closed" | "error" | null`
- `channelStatusAt: number | null`

في `ch.subscribe((status) => { ... })` مرّر callback يحدّث `channelStatus` لكل تغيّر حالة (SUBSCRIBED/CHANNEL_ERROR/TIMED_OUT/CLOSED).

### 3) `src/components/SignatureManager.tsx` — توسيع `SignatureSyncPanel`
أضف صفوف جديدة:
- **حالة القناة**: `subscribed` (أخضر) / `joining` (رمادي) / `error/closed` (أحمر) + وقت آخر تغيير.
- **عدّاد الأحداث**: "Realtime: 3 · Verify: 7".
- **المرحلة + رسالة الخطأ**: عند `lastVerifyResult === "error"` اعرض `lastVerifyStage` و`lastVerifyError` بخط أحمر صغير.
- زر إضافي: **"اختبر الاتصال بـ profiles"** ينفّذ `supabase.from('profiles').select('id').limit(1)` ويعرض النتيجة فوراً — يكشف فوراً إن كان الخطأ من الشبكة/RLS أم من المصادقة.

### 4) لا تغييرات في قاعدة البيانات
كل العمل عرض/تشخيص فقط. لن نلمس RLS أو migrations.

## النتيجة المتوقّعة
بعد التطبيق سترى في اللوحة شيئاً مثل:
```
حالة القناة: subscribed (منذ 4 ث)
عدّاد: Realtime 0 · Verify 5
آخر تحقق: قبل 3 ث · خطأ
  المرحلة: auth
  السبب: no-user
```
أو
```
المرحلة: profile
السبب: JWT expired
```
وعندها نعرف بدقة الإصلاح التالي (تجديد جلسة، RLS، أو إضافة `profiles` للـ publication).
