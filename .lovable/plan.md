# مزامنة فورية شاملة بين كل الأجهزة

نُنشئ قناة Realtime واحدة على مستوى التطبيق تستمع لتغييرات كل جداول بيانات المستخدم، ونُبلّغ الصفحات لتُعيد الجلب فوراً — بدون أي تدخل يدوي.

## 1) Migration: تفعيل Realtime على الجداول

`ALTER PUBLICATION supabase_realtime ADD TABLE` + `REPLICA IDENTITY FULL` لكل من:
- `buildings`, `units`, `tenancies`, `payments`, `expenses`, `maintenance_requests`
- `profiles`, `receipt_counters`, `in_app_notifications`, `activity_log`
- `building_members`, `invitations`, `unit_audit_log`
- `daily_bookings`, `daily_units`, `daily_cleaning_tasks`, `daily_pricing_rules`, `daily_message_templates`, `daily_cleaners`

RLS الموجودة تكفي لتقييد ما يصل لكل مستخدم.

## 2) ناقل مركزي — `src/lib/realtimeSync.tsx`

مكوّن `<RealtimeSync />` يُركَّب مرة في `AppShell`:
- يفتح قناة `amlaki-sync-{uid}` ويشترك بـ `postgres_changes` (`event:'*'`) لكل الجداول أعلاه.
- لكل حدث:
  - يستدعي `queryClient.invalidateQueries(...)` للمفاتيح ذات الصلة.
  - يستدعي `paymentsBus.emit()` عند تغييرات `payments` (لإعادة استخدام البنية الحالية).
  - يُطلق `CustomEvent('amlaki:data-changed', { detail: { table, eventType } })` على `window`.
- يُعيد فتح القناة عند `auth.onAuthStateChange` ويُغلقها عند الخروج.

## 3) خطّاف للصفحات — `src/lib/useLiveData.ts`

```ts
useLiveData(tables: string[], refetch: () => void, opts?: { debounceMs?: number })
```
- يستمع لـ `amlaki:data-changed` ويستدعي `refetch` (debounce 250ms) إذا كان `detail.table ∈ tables`.
- يستدعي `refetch` أيضاً عند `visibilitychange→visible` و`focus` (لتغطية فترات نوم iOS).

## 4) ربط الصفحات

سطر واحد في كل صفحة يستدعي `useLiveData(...)` مع دالة الجلب الحالية:

| الصفحة | الجداول |
|---|---|
| Dashboard | units, payments, tenancies, buildings, expenses, maintenance_requests |
| Buildings | buildings, units |
| BuildingDetail | units, tenancies, payments, expenses |
| UnitDetail | units, tenancies, payments, maintenance_requests, expenses |
| Payments / PaymentsTrash / PreviousBalances | payments, units |
| Tenants | tenancies, units |
| Maintenance | maintenance_requests, units |
| BuildingExpenses | expenses, units |
| Activity | activity_log |
| Notifications | in_app_notifications |
| Team | building_members, invitations |
| Reports | payments, expenses, units |
| daily/* | daily_bookings, daily_units, daily_cleaning_tasks, daily_pricing_rules, daily_message_templates |

## 5) النتيجة

- تسجيل دفعة / تعديل عقد / إضافة وحدة من أي جهاز → يظهر على باقي الأجهزة خلال أقل من ثانيتين.
- يعمل في الخلفية على iOS؛ عند العودة للتطبيق يُجبر التحديث (focus/visibility) لضمان عدم تفويت أي تغيير.
- لا تغييرات على الواجهة أو الـ design system، ولا أي تأثير على الأداء (قناة واحدة فقط).
