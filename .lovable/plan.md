# خطة تفعيل نظام الدفع الحقيقي

## 1. اختيار مزود الدفع

تشغيل `recommend_payment_provider` لتحديد المزود الأنسب. التطبيق SaaS رقمي (إدارة عقارات) → الترشيح المتوقع **Paddle** (Merchant of Record، يتولى الضرائب والامتثال تلقائياً، مناسب للسوق العالمي والعربي).

البديل: **Stripe** إذا أراد المستخدم تحكم أكبر في الضرائب أو كان مستهدفاً لسوق محدد.

لا يحتاج المستخدم لإنشاء حساب مسبق — Lovable توفر التكامل المدمج.

---

## 2. تفعيل البيئة

- استدعاء `enable_paddle_payments` (أو `enable_stripe_payments`).
- بيئة Sandbox تُنشأ فوراً للاختبار بدون أموال حقيقية.
- الانتقال للإنتاج يتطلب توثيق الحساب لاحقاً (Paddle: مراجعة المنتج / Stripe: مطالبة الحساب).

---

## 3. إنشاء المنتجات والخطط

عبر `batch_create_product` — 6 أسعار مطابقة لصفحة Pricing الحالية:

| الخطة | شهري | سنوي |
|---|---|---|
| Basic | $9 | $90 |
| Pro (موصى بها) | $29 | $290 |
| Business | $79 | $790 |

الخطة Free تبقى افتراضية بدون منتج Paddle.

---

## 4. تعديلات قاعدة البيانات

إضافة أعمدة على `profiles`:
- `paddle_customer_id` (text, nullable) — لربط المستخدم بحساب Paddle
- `paddle_subscription_id` (text, nullable) — للاشتراك النشط
- `subscription_interval` (text) — `monthly` / `yearly`

جدول جديد `invoices`:
- `id`, `user_id`, `paddle_invoice_id`, `amount`, `currency`, `status`, `invoice_pdf_url`, `period_start`, `period_end`, `created_at`
- RLS: المستخدم يقرأ فواتيره فقط، الأدمن يقرأ الكل

جدول جديد `subscription_events` (لوغ webhook):
- `id`, `user_id`, `event_type`, `payload jsonb`, `processed_at`

---

## 5. Edge Functions

### `create-checkout`
- يستقبل `plan_id` و `interval` من الواجهة
- ينشئ Paddle Checkout Session مع `customer_email` و `custom_data.user_id`
- يُرجع `checkout_url` لإعادة التوجيه

### `paddle-webhook`
- يستقبل أحداث Paddle (`subscription.created`, `subscription.updated`, `subscription.canceled`, `transaction.completed`, `transaction.paid`)
- يتحقق من توقيع Webhook
- يحدّث `profiles.subscription_plan`/`subscription_status`/`subscription_expires_at`/`paddle_subscription_id`
- يُدرج فاتورة جديدة في `invoices` عند `transaction.paid`
- يسجّل الحدث في `subscription_events`

### `customer-portal`
- يُرجع رابط Paddle Customer Portal للمستخدم لإدارة اشتراكه (إلغاء، تحديث بطاقة، تنزيل فواتير)

---

## 6. تعديلات الواجهة

### `Pricing.tsx`
- استبدال `toast.info("سيتم تفعيل الدفع قريباً")` باستدعاء `create-checkout` ثم `window.location.href = checkout_url`
- الإبقاء على نظام Promo Codes كآلية إضافية

### صفحة جديدة `Subscription.tsx` (أو قسم في Settings)
- عرض الخطة الحالية، تاريخ التجديد، حالة الاشتراك
- زر "إدارة الاشتراك" → `customer-portal`
- قائمة الفواتير مع روابط تنزيل PDF
- زر "إلغاء الاشتراك"

### صفحة نتيجة `/subscription/success`
- تأكيد نجاح الدفع، عرض الخطة الجديدة

---

## 7. الإشعارات والبريد

- Paddle يرسل إيصالات الدفع وفواتير بشكل تلقائي للعميل (لا حاجة لإعداد).
- اختياري: إشعار داخلي في `notifications` عند نجاح/فشل الدفع عبر `paddle-webhook`.

---

## 8. ترتيب التنفيذ

1. `recommend_payment_provider` → تأكيد المستخدم
2. `enable_paddle_payments`
3. مايجريشن: أعمدة `profiles` الجديدة + جدولا `invoices` و `subscription_events`
4. `batch_create_product` للخطط الست
5. Edge Functions الثلاث
6. تعديل `Pricing.tsx` + إنشاء `Subscription.tsx`
7. اختبار في Sandbox: شراء، تجديد، إلغاء، فاتورة

---

## ملاحظات تقنية

- **التجديد التلقائي**: Paddle يتولاه تلقائياً عبر الاشتراك؛ Webhook يحدّث `subscription_expires_at` عند كل دورة.
- **الفواتير**: Paddle يولّد PDF لكل دفعة، نخزّن الرابط في `invoices.invoice_pdf_url`.
- **الأمان**: التحقق من توقيع Webhook إلزامي قبل أي تحديث على DB.
- **التوافق مع Promo Codes**: عند تفعيل كود ترويجي، `paddle_subscription_id` يبقى NULL — الكود مسار منفصل لا يتعارض.
- **تفضيل العملة**: Paddle يحوّل تلقائياً حسب موقع العميل.

---

## ما يتطلب قراراً منك الآن

- تأكيد **Paddle** أم تفضّل **Stripe**؟
- هل ترغب أن تكون صفحة إدارة الاشتراك صفحة مستقلة `/subscription` أم قسم داخل `/settings`؟
