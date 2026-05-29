# خطة اعتماد هيكل الاشتراكات الجديد

## 1) الخطط الجديدة (شهري + سنوي بخصم ~17%)

| الخطة | الوحدات | شهري | سنوي | سعر الوحدة الإضافية/شهر |
|---|---|---|---|---|
| Free | 3 | $0 | — | لا يمكن (ترقية مطلوبة) |
| Personal | 10 | $7.99 | $79 | $0.99 |
| Pro | 25 | $19.99 | $199 | $0.69 |
| Business | 75 | $49.99 | $499 | $0.49 |

- **إلغاء Enterprise فوراً**: حذفها من صفحة الأسعار + من `PLAN_UNIT_LIMITS` + من خريطة المنتجات. إذا وُجد مشتركون قدامى، يستمر اشتراكهم حتى نهاية الفترة عبر السلوك الطبيعي لـ Paddle، ثم يسقطون إلى Free.

## 2) منتجات Paddle (بيئة الاختبار، تُزامن مع الإنتاج عند النشر)

- تحديث الأسعار الموجودة عبر `PATCH /prices`:
  - `starter_monthly` → إعادة تسمية المنتج إلى **Personal** + سعر `799` cents + إضافة `starter_yearly` بـ `7900`.
  - `pro_monthly` → `1999` + `pro_yearly` `19900`.
  - `business_monthly` → `4999` + `business_yearly` `49900`.
- **أرشفة** `enterprise_monthly` + `enterprise_yearly` + منتج `amlaki_enterprise`.
- **منتجات إضافية للوحدات** (recurring monthly، quantity-based):
  - `amlaki_personal_addon` → سعر `personal_addon_unit` $0.99/شهر
  - `amlaki_pro_addon` → سعر `pro_addon_unit` $0.69/شهر
  - `amlaki_business_addon` → سعر `business_addon_unit` $0.49/شهر

## 3) قاعدة البيانات

```sql
-- إضافة عمود الوحدات الإضافية المشتراة (من بنود Paddle subscription)
ALTER TABLE public.subscriptions
  ADD COLUMN addon_units integer NOT NULL DEFAULT 0;

-- تحديث get_plan_unit_limit للأرقام الجديدة
-- free=3, personal=10 (alias starter), pro=25, business=75
-- (إبقاء enterprise=∞ احتياطاً للمشتركين القدامى)

-- enforce_unit_quota: استخدام (plan_limit + addon_units) بدلاً من plan_limit وحده
```

## 4) Webhook الاشتراك

عند `subscription.updated`/`created` نمر على كل `items[]`:
- البند الأساسي → `product_id` و `price_id` كما هي.
- البنود الإضافية (addon) → جمع `quantity` في `addon_units`.

## 5) واجهة الشراء عند تجاوز الحد

عند فشل إضافة وحدة بسبب `unit_quota_exceeded`، بدلاً من رسالة خطأ فقط نفتح **مودال "أضف وحدات"**:

- يعرض الباقة الحالية وعدد الوحدات الإضافية الحالية.
- ثلاثة أزرار: **+1 وحدة**، **+5 وحدات**، **+10 وحدات** مع السعر الإجمالي الشهري لكل خيار حسب الباقة.
- زر "ترقية الباقة" كبديل.
- عند الاختيار → استدعاء edge function جديدة `add-subscription-units` تنفذ `PATCH /subscriptions/{id}` لزيادة `quantity` للبند الإضافي (أو إضافته إن لم يكن موجوداً).
- بعد النجاح، realtime يحدّث `subscriptions` ويعيد محاولة إضافة الوحدة.

الوحدات الإضافية تُستخدم في **أي مبنى** (لأن الحد محسوب على إجمالي وحدات المستخدم).

## 6) صفحة الأسعار

- إعادة كتابة `PLANS` بالقيم الجديدة + حذف Enterprise + إضافة قسم "الوحدات الإضافية" تحت كل خطة مدفوعة يعرض سعر الوحدة.
- في `Settings`، تحديث `planLabel` (إضافة "personal").
- `useSubscription.PRODUCT_TO_PLAN`: إضافة `amlaki_personal` ← `personal`، الاحتفاظ بـ `amlaki_starter` كـ alias مؤقت للقدامى → `personal`.

## 7) لقطة التغييرات (تقنية)

- `src/hooks/useSubscription.ts` — أرقام الحدود، نوع `PlanTier` (إضافة `personal`)، قراءة `addon_units` ودمجها في `unitLimit`.
- `src/pages/Pricing.tsx` — هيكل الخطط الجديد + قسم الوحدات الإضافية.
- `src/pages/Settings.tsx` — `planLabel`.
- `src/components/AddUnitDialog.tsx` + `AddBuildingDialog.tsx` — استدعاء مودال جديد `BuyAddonUnitsDialog` بدل toast الخطأ.
- `src/components/BuyAddonUnitsDialog.tsx` — جديد.
- `supabase/functions/add-subscription-units/index.ts` — جديد.
- `supabase/functions/payments-webhook/index.ts` — تجميع addon items.
- migration: عمود `addon_units` + تحديث `get_plan_unit_limit` + `enforce_unit_quota`.

## ملاحظات

- المستخدمون الحاليون على Free بـ 4-5 وحدات: يحتفظون بوحداتهم، لكن لن يستطيعوا إضافة جديدة حتى الترقية أو شراء وحدات إضافية (الوحدات الإضافية متاحة للخطط المدفوعة فقط — Free يجب أن يرقّي).
- المستخدمون على Starter القديمة (25 وحدة بـ $10): تتحول تلقائياً إلى **Personal** (10 وحدات بـ $7.99) عبر إعادة تسمية المنتج. **هذا يقلّل حدّهم من 25 إلى 10** — هل توافق؟ البديل: إنشاء منتج Personal جديد وترك Starter للقدامى grandfathered.
