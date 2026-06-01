## المشكلة
دالة `redeem_promo_code` تُحدّث `profiles.subscription_plan` فقط، لكن واجهة المستخدم (`useSubscription`, `user_active_plan`, `account_phase`) تقرأ من جدول `subscriptions` حصراً، فلا يظهر أثر الكود.

## الحل
ترحيل واحد على قاعدة البيانات — لا تغيير في الواجهة أو منطق Paddle.

### 1) تحديث `public.redeem_promo_code`
بعد تحديث `profiles`، إدراج صف اصطناعي في `subscriptions`:
- `user_id` = المستخدم
- `paddle_subscription_id` = `'promo_' || code` (فريد)
- `paddle_customer_id` = `'promo_customer'`
- `product_id` = `'amlaki_' || plan` (مثلاً `amlaki_business`)
- `price_id` = `'promo_' || plan`
- `status` = `'active'`
- `environment` = `'live'` (يلتقطه `useSubscription`)
- `current_period_end` = تاريخ الانتهاء المحسوب
- `current_period_start` = `now()`

مع `ON CONFLICT (paddle_subscription_id)` لتجنّب التكرار.

### 2) إصلاح يدوي للمستخدم الذي استخدم الكود مسبقاً
`INSERT` واحد يقرأ من `promo_codes` حيث `code = 'AMLAKI-LIFE-0NXS9QNW'` وينشئ صف الاشتراك له الآن.

## لا تغيير في
- `useSubscription.ts`، `Settings.tsx`، الواجهة
- سياسات RLS، الأكواد الحالية، دوال Paddle، Webhooks
- بيانات Paddle الحقيقية (الصف الاصطناعي معزول بـ `paddle_subscription_id` يبدأ بـ `promo_`)

## النتيجة
بمجرد تنفيذ الترحيل: الباقة تظهر **Business** فوراً في كل أنحاء التطبيق، وأي كود مستقبلي يعمل تلقائياً.