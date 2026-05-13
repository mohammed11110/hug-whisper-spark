# خطة دمج Paddle للاشتراكات

## الأسعار المعتمدة
- **Free**: عقار واحد، 5 وحدات، بدون فريق
- **Pro شهري**: 49 ريال/شهر
- **Pro سنوي**: 399 ريال/سنة (توفير 33%)
- **تجربة مجانية**: 14 يوم بدون بطاقة

## 1. إعداد Paddle (يدوي من المستخدم)
في لوحة Paddle Sandbox سيتم إنشاء:
- منتج "Pro Subscription" بسعرين (Price IDs):
  - `pri_monthly_sar_49`
  - `pri_yearly_sar_399`
- المستخدم يزودنا بـ Price IDs بعد الإنشاء (سأطلبها بعد الموافقة)
- إعداد Webhook endpoint يشير إلى Edge Function

## 2. تغييرات قاعدة البيانات (Migration)
إضافة أعمدة لجدول `profiles`:
- `paddle_customer_id` (text)
- `paddle_subscription_id` (text)
- `subscription_interval` (text: monthly/yearly)
- `trial_ends_at` (timestamptz)

جدول جديد `subscription_events` لسجل الفواتير والأحداث:
- نوع الحدث، المبلغ، التاريخ، رابط الفاتورة، payload الخام
- RLS: المستخدم يرى أحداثه فقط

## 3. Edge Functions (3 وظائف)
- **`paddle-checkout`**: ينشئ جلسة Checkout transaction للمستخدم الحالي ويعيد رابط الدفع
- **`paddle-webhook`**: يستقبل أحداث Paddle (subscription.created/updated/canceled، transaction.completed)، يتحقق من التوقيع، ويحدث `profiles` و`subscription_events`
- **`paddle-portal`**: يولّد رابط Customer Portal لإدارة الاشتراك/الإلغاء

أسرار مطلوبة:
- `PADDLE_API_KEY` (Sandbox)
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_PRICE_MONTHLY` و `PADDLE_PRICE_YEARLY`

## 4. واجهة المستخدم داخل `/settings`
تبويب جديد **"الاشتراك والفواتير"** يحتوي:
- بطاقة الخطة الحالية (Free/Pro، تاريخ التجديد، حالة)
- مفتاح تبديل شهري/سنوي مع إبراز التوفير
- زر "ترقية إلى Pro" → يستدعي `paddle-checkout`
- إذا Pro: زر "إدارة الاشتراك" → `paddle-portal`، وزر "إلغاء"
- جدول الفواتير السابقة من `subscription_events`
- قسم "كود ترويجي" (الموجود حالياً) يبقى كما هو

تحديث صفحة `/pricing` الحالية بالأسعار الجديدة وأزرار تربط بـ checkout.

## 5. حماية الميزات (Feature Gating)
دالة `usePlan()` hook تتحقق من:
- عدد العقارات/الوحدات
- عدد أعضاء الفريق
- ميزات Pro (تقارير متقدمة، رفع ملفات)
عرض modal الترقية عند تجاوز حدود Free.

## التفاصيل التقنية
- Paddle Billing API v2 (Sandbox أولاً)
- التحقق من توقيع Webhook عبر HMAC-SHA256
- التعامل مع `subscription.activated`, `subscription.updated`, `subscription.canceled`, `transaction.completed`, `transaction.payment_failed`
- العملة: SAR
- بعد الاختبار في Sandbox، التبديل إلى Production يتطلب توثيق حساب Paddle ثم تحديث المفاتيح

## ما سأطلبه بعد الموافقة
1. إنشاء المنتجين في Paddle وإعطائي Price IDs
2. `PADDLE_API_KEY` و `PADDLE_WEBHOOK_SECRET` (سأطلبهم عبر نموذج آمن)
