# خطة: زر "إدارة الاشتراك" في الإعدادات

## الهدف
إضافة زر داخل قسم "الحساب" في `src/pages/Settings.tsx` يفتح Customer Portal الخاص بـ Paddle للمستخدم الحالي، مع التعامل المناسب عندما لا يكون للمستخدم اشتراك نشط (Free فقط أو لم يشترك بعد).

## السلوك
- يظهر الزر دائماً ضمن قسم الحساب، أسفل "الخطط والأسعار" ومباشرة قبل "تسجيل الخروج".
- عند الضغط:
  1. إن كان `useSubscription` لا يزال يحمّل → الزر معطّل مع spinner صغير.
  2. إن لم يكن هناك اشتراك (`paddleSubscriptionId === null` أو `plan === "free"` بدون صف اشتراك) → نعرض toast إعلامي:
     - عربي: «لا يوجد اشتراك مدفوع بعد. اختر خطة للبدء.»
     - إنجليزي: "No paid subscription yet. Choose a plan to get started."
     - مع زر/تحويل إلى `/pricing`.
  3. إن كان هناك اشتراك → نستدعي edge function `customer-portal` مع `environment` المشتقّ من `getPaddleEnvironment()`، نستقبل `url`، ونفتحه في تبويب جديد `window.open(url, "_blank", "noopener,noreferrer")`.
  4. في حال الخطأ:
     - `404 no_subscription` من الـ function → نفس مسار "لا يوجد اشتراك".
     - أي خطأ آخر → toast خطأ بنص عربي/إنجليزي عام.

## الواجهة
- زر بنفس نمط عناصر قسم الحساب (`px-4 py-3`, hover sage-50, أيقونة `CreditCard` من lucide بلون `text-sage-600`، سهم `ArrowRight` على اليمين مع `rtl:rotate-180`).
- النصوص: «إدارة الاشتراك» / "Manage subscription"، مع سطر فرعي صغير:
  - عند الاشتراك النشط: اسم الخطة الحالية (Starter/Pro/...).
  - عند عدم الاشتراك: «أنت على الخطة المجانية» / "You're on the Free plan".
- حالة التحميل: استبدال السهم بـ `Loader2` يدور، الزر معطّل.

## التغييرات التقنية
1. **`src/pages/Settings.tsx`** فقط:
   - استيراد `useSubscription` من `@/hooks/useSubscription`، `getPaddleEnvironment` من `@/lib/paddle`، `supabase` من `@/integrations/supabase/client`، الأيقونتين `CreditCard` و`Loader2`.
   - حالة محلية `const [portalLoading, setPortalLoading] = useState(false)`.
   - دالة `openPortal()` تستدعي `supabase.functions.invoke("customer-portal", { body: { environment: getPaddleEnvironment() } })` وتفتح الـ URL.
   - إدراج الزر داخل نفس البطاقة `divide-y` للحساب بين رابط `/pricing` وزر تسجيل الخروج.

## ما لا يتغيّر
- لا تعديل على الـ edge function `customer-portal` (تعمل بالفعل، تُعيد `404 no_subscription` عند الحاجة).
- لا تغييرات في قاعدة البيانات أو المخطط.
- لا تعديل في `SettingsPanel.tsx` (الـ Sheet السفلي) ضمن هذه الخطوة — التركيز على صفحة `/settings` فقط كما طلب المستخدم.
