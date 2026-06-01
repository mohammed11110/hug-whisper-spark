## السبب الجذري

صفحتا **الإعدادات** و**المباني** تتعطلان بسبب خطأ في `src/hooks/useSubscription.ts:169-179`:

```
cannot add `postgres_changes` callbacks for realtime:subs:<uid> after `subscribe()`.
```

اسم القناة ثابت `` `subs:${user.id}` ``. في React StrictMode (وضع التطوير) أو عند إعادة تنفيذ الـeffect سريعاً:
1. التشغيل الأول: ينشئ القناة → `.on().on().subscribe()`.
2. الـcleanup يستدعي `removeChannel` لكنه غير متزامن.
3. التشغيل الثاني: `supabase.channel("subs:<uid>")` يُرجع نفس الـinstance المشتركة سابقاً، فيستدعي `.on()` بعد `subscribe()` ← يرمي خطأ يُسقط الشجرة عبر `ErrorBoundary`.

نفس النمط حدث سابقاً مع قنوات `activity_log_*` وتم إصلاحه بإضافة `crypto.randomUUID()`؛ هذه القناة لم تُحدّث.

## الإصلاح

في `src/hooks/useSubscription.ts` — استخدام معرف فريد لكل اشتراك:

```ts
useEffect(() => {
  if (!user) return;
  const channelName = `subs:${user.id}:${crypto.randomUUID()}`;
  const channel = supabase
    .channel(channelName)
    .on("postgres_changes", { ... }, () => load())
    .on("postgres_changes", { ... }, () => load())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [user, load]);
```

تغيير سطر واحد. يحل عطل صفحة الإعدادات وصفحة المباني (وأي صفحة تستهلك `useSubscription`).

## التحقق

بعد التعديل، أعيد تحميل `/settings` و`/buildings` في المعاينة وأتأكد من عدم ظهور شاشة "حدث خطأ ما" ومن خلو الكونسول من الخطأ.
