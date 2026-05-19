# خطة: تفعيل المدفوعات لتطبيق أملاكي عبر Paddle

## 1. تفعيل Paddle
- تشغيل أداة `enable_paddle_payments` — تفتح نموذج تسجيل (بريد، اسم، اسم النشاط).
- ستظهر تلقائياً **بيئة اختبار (Sandbox)** فوراً للتجربة بدون أموال حقيقية.
- لقبول مدفوعات حقيقية لاحقاً: إكمال التحقق داخل لوحة Paddle (هوية + بيانات نشاط).

## 2. إنشاء منتجات الاشتراك
بعد التفعيل، سأنشئ 6 أسعار في Paddle مطابقة لخطط أملاكي الحالية:

| الخطة | شهري | سنوي |
|---|---|---|
| Basic | $9 | $90 |
| Professional | $29 | $290 |
| Business | $79 | $790 |

(خطة Free تبقى بدون منتج — يتم تفعيلها مباشرة)

## 3. ربط زر الاشتراك في صفحة الأسعار
- تعديل `src/pages/Pricing.tsx` ليستدعي edge function عند الضغط على "اشترك".
- إنشاء edge function `create-checkout` تُنشئ Paddle Checkout Session وترجع رابط الدفع.
- توجيه المستخدم لإكمال الدفع في صفحة Paddle المستضافة.

## 4. تحديث حالة الاشتراك تلقائياً
- إنشاء edge function `paddle-webhook` يستقبل أحداث Paddle:
  - `subscription.created` / `subscription.activated` → تحديث `profiles.subscription_plan` و `subscription_status` و `subscription_expires_at`.
  - `subscription.canceled` → تحديث `canceled_at`.
  - `transaction.completed` → تسجيل في `subscription_events`.
- الجدول `profiles` و `subscription_events` موجودان بالفعل ويحتويان الأعمدة المطلوبة (`paddle_customer_id`, `paddle_subscription_id`, ...).

## 5. صفحة "إدارة الاشتراك"
- إضافة زر في الإعدادات لفتح **Paddle Customer Portal** حيث يستطيع المستخدم:
  - تحديث بطاقته
  - تنزيل الفواتير
  - إلغاء الاشتراك

## 6. اختبار شامل في Sandbox
- شراء وهمي بكل خطة
- التحقق من تحديث `profiles` تلقائياً عبر الـ webhook
- اختبار الإلغاء

---

### تفاصيل تقنية
- **Edge functions جديدة**: `create-checkout`, `paddle-webhook`, `customer-portal`
- **لا حاجة لـ migration** — جداول `profiles` و `subscription_events` جاهزة
- **الأمان**: التحقق من توقيع Paddle webhook، استخدام `verify_jwt = false` للـ webhook فقط
- **العملة**: USD (يمكن إضافة OMR/SAR لاحقاً عبر Paddle multi-currency)

### ما خارج هذه الخطة
- التحقق من النشاط التجاري في Paddle (يقوم به المستخدم لاحقاً للانتقال للإنتاج)
- إضافة عملات إضافية أو ضرائب محلية (Paddle يتولاها تلقائياً)
- صفحة فواتير داخل التطبيق (يمكن إضافتها لاحقاً — الفواتير متاحة في Paddle Portal)
