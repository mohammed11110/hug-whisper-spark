# خطة: إصلاح ظهور R-01 على الأجهزة الجديدة

## الهدف
جعل عداد الإيصالات مرتبطاً بآخر إيصال فعلي صادر عن الحساب (من أي جهاز)، وإلغاء أي اعتماد على قيم محلية افتراضية تُظهر `R-01` للحسابات القديمة.

## التغييرات

### 1) Backend — دالة تهيئة موثوقة
Migration جديدة تضيف:
- `public.ensure_receipt_counter_seeded()` — SECURITY DEFINER، تُستدعى من العميل بعد تسجيل الدخول.
  - تحسب `max(actual_receipt_int)` من `payments` للحساب (`user_id = auth.uid()`، `deleted_at IS NULL`).
  - تستخرج الجزء الرقمي من `receipt_number` بغض النظر عن البادئة.
  - تُنشئ صف `receipt_counters` إذا لم يوجد، وتضبط `next_number = GREATEST(next_number, max_existing + 1)`.
  - ترجع الصف النهائي (`prefix`, `padding`, `next_number`).
- تُستدعى مرة واحدة عند بدء الجلسة وتعمل بشكل idempotent.

### 2) `src/lib/appSettings.tsx`
- إضافة حالة `receiptCounterReady: boolean` (افتراضياً `false`).
- عند توفر `session.user`:
  1. استدعاء `ensure_receipt_counter_seeded` ثم قراءة `receipt_counters`.
  2. عند النجاح فقط → `receiptCounterReady = true` وتحديث `settings.receipt`.
- إزالة أي fallback يضع `next_number = 1` محلياً قبل اكتمال الجلب.
- تصدير `receiptCounterReady` عبر الـ context.

### 3) `src/components/AddPaymentDialog.tsx`
- عدم ملء حقل رقم الإيصال أو حساب المعاينة قبل `receiptCounterReady === true`.
- أثناء التحميل: عرض skeleton/نص "جارٍ تجهيز الرقم…" بدل `R-01`.
- زر الحفظ معطّل حتى يجهز العداد.
- منطق "override يدوي": يُعتبر فقط إذا غيّر المستخدم القيمة بعد الجاهزية (مقارنة بـ snapshot للقيمة الأولية بعد التهيئة).

### 4) `src/pages/Settings.tsx`
- معاينة رقم الإيصال تستخدم `next_number` من الخادم فقط؛ قبل الجاهزية تعرض "…".
- نموذج تعديل البادئة/الحشو يبقى معطّلاً حتى الجاهزية.

### 5) أي نقاط عرض أخرى
مراجعة استخدامات `formatReceipt(settings.receipt…)` وربطها بـ `receiptCounterReady` لإخفاء أي رقم مؤقت.

## التحقق
- حساب قديم على جهاز/متصفح جديد → فتح حوار الدفع يُظهر الرقم التالي الحقيقي.
- فتح الحوار فوراً بعد تسجيل الدخول → لا يظهر `R-01` أبداً، بل مؤشر تحميل ثم الرقم الصحيح.
- التطابق بين: الحقل، المعاينة، الحفظ، PDF، واتساب.
- حساب جديد بلا إيصالات → يبدأ من `R-01` بشكل طبيعي.

## الملفات
- migration جديدة: `ensure_receipt_counter_seeded`
- `src/lib/appSettings.tsx`
- `src/components/AddPaymentDialog.tsx`
- `src/pages/Settings.tsx`
