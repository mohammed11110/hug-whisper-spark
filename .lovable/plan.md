## المشكلة

كل صفحة تنتهي بشاشة "حدث خطأ ما". السبب الجذري ظاهر في الكونسول:

```
GET /rest/v1/profiles?... 403 (Forbidden)
```

عند فحص قاعدة البيانات وجدت أن **لا جدول واحد** في `public` يملك أي `GRANT` للأدوار `anon` / `authenticated` / `service_role`. ترحيل RLS الأخير فعّل السياسات لكنه نسي منح الصلاحيات الأساسية على الجداول، وبدون `GRANT` تُرجع PostgREST خطأ 403 مهما كانت سياسات RLS صحيحة. الـ ErrorBoundary يلتقط الاستثناء من React Query ويُظهر الشاشة الحمراء.

## الحل

ترحيل واحد يضيف `GRANT` المناسب لكل جدول، مع احترام سياسات RLS الحالية (القراءة المجهولة فقط حيث تسمح السياسات).

### الجداول المتأثرة (29 جدولاً)

`activity_log, building_members, buildings, daily_bookings, daily_cleaners, daily_cleaning_tasks, daily_message_templates, daily_pricing_rules, daily_units, email_send_log, email_send_state, email_unsubscribe_tokens, expenses, in_app_notifications, invitations, maintenance_requests, notification_log, notification_preferences, payments, profiles, promo_codes, push_subscriptions, subscription_events, subscriptions, suppressed_emails, tenancies, unit_audit_log, units, user_roles`

### قواعد المنح

- **جداول المستخدم العادية** (مثل `buildings`, `units`, `payments`, `tenancies`, `expenses`, `maintenance_requests`, `notification_preferences`, `push_subscriptions`, `in_app_notifications`, `activity_log`, `invitations`, `building_members`, `daily_*`, `subscriptions`, `subscription_events`, `unit_audit_log`):
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
  GRANT ALL ON public.<t> TO service_role;
  ```
- **`profiles`, `user_roles`**: نفس ما سبق (authenticated فقط، بدون anon).
- **جداول يقرأها anon عند صفحات الإلغاء/الترميز**:
  - `email_unsubscribe_tokens`, `suppressed_emails`, `promo_codes`: تُضاف `GRANT SELECT TO anon` أيضاً إذا وُجدت سياسة قراءة عامة.
- **جداول إدارية فقط** (`notification_log`, `email_send_log`, `email_send_state`): `GRANT ALL ON ... TO service_role;` فقط (لا تكشف للعميل).

### خطوة التحقق

1. تشغيل الترحيل.
2. إعادة تحميل `/` — يجب أن تختفي شاشة الخطأ وتظهر لوحة التحكم.
3. تأكيد أن قائمة العقارات/الدفعات/المستأجرين تعمل.
4. تشغيل `supabase--linter` للاطمئنان.

لا تغييرات على كود الواجهة — المشكلة كلها في طبقة قاعدة البيانات.
