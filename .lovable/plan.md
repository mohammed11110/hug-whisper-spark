## المشكلتان

### 1) المتأخرات تُقرَّب لأعلى عند الحفظ
عند إدخال `9798` ر.ع. مع إيجار شهري `450`، يحفظ النظام `9900`.

**السبب** في ملفَّين متطابقَين منطقياً:
- `src/components/NewTenancyDialog.tsx:163`
- `src/components/AddUnitDialog.tsx:111`

```ts
const months    = Math.max(1, Math.round(arrN / rentN));   // 9798/450 = 21.77 → 22
const remainder = Math.max(0, arrN - months * rentN);      // 9798 - 9900 = -102 → 0
```

نتيجة: 22 شهراً ناقصاً مع `remainder=0` ⇒ المجموع `22 × 450 = 9900`. فُقدت 102 ر.ع. بل ظهرت زيادة 102.

**الإصلاح:** نستخدم `Math.floor` ليكون `remainder` هو الباقي الحقيقي:
```ts
const months    = Math.floor(arrN / rentN);                // 21
const remainder = Math.max(0, arrN - months * rentN);      // 9798 - 9450 = 348
// إن كان arrN < rentN: months=0 و remainder=arrN  → دورة سابقة واحدة بالقيمة كما هي.
```

النتيجة: `21 × 450 + 348 = 9798` ✓ تماماً كما أُدخل.

حالات الحافة المغطّاة:
- `arrN === months*rentN` (مضاعَف تام): `remainder=0`، عدد أشهر كامل، لا تغيير ظاهري.
- `arrN < rentN` (مبلغ صغير): `months=0`، تُحفظ كاملةً في `opening_balance` بدون تحريك المرساة.
- نُبقي `monthsBack` كما هي لكن نحسبها من `months` الجديد، مع `Math.max(0, …)` كي لا يصبح سالباً عند `months=0`.

**أين يجب أن نعدّل أيضاً للاتساق؟**
- `EditUnitDialog` و`UnitDetail` (المعاينة): فحصت — لا يحتويان على هذا المنطق، يقرآن `opening_balance` و`opening_balance_date` كما هما من DB.
- `getUnitArrears` في `src/lib/balance.ts`: لا تغيير — هي تستهلك القيمتين كما هما.

> الحقول المخزّنة لا تحتاج migration؛ التصحيح للأمام فقط. السجلات السابقة التي حُفظت بمنطق الـ`round` تبقى بقيمها (إن أراد المستخدم تصحيحها يفتح الوحدة ويعيد إدخال الرقم الصحيح).

---

### 2) زر «دفعة +» في جميع الصفحات

**الواقع الحالي:** زر إضافة الدفعة موجود فقط داخل صفحتَي `Payments` و`UnitDetail`. لا يوجد في `Dashboard` / `Buildings` / `BuildingDetail` / `Tenants` / `Maintenance` / `Activity` / `Reports`.

**الحلّ المقترح: زر عائم عالمي (Global FAB)** بدل نسخ الزر في كل صفحة:

- مكوّن جديد `src/components/QuickAddPaymentFab.tsx`:
  - زر عائم دائري بقُطر 56px في الزاوية السفلية (LTR: يمين / RTL: يسار)، بـ `bottom-[88px]` ليرتفع فوق `BottomNav` على الموبايل وفوق المحتوى على الديسكتوب (`md:bottom-6`).
  - أيقونة `+` بخط Outfit/Kufi 28px، لون primary-foreground، خلفية `bg-gradient-sage`، ظل sage-tinted: `0 12px 32px -8px rgba(95,126,101,.45)`.
  - عند الضغط: يفتح `AddPaymentDialog` (مع `unitId` فارغ ليختار المستخدم الوحدة).
  - بعد الحفظ: ينطلق حدث `window.dispatchEvent(new CustomEvent('amlaki:payment-added'))` كي تُحدِّث الصفحات بياناتها (الصفحات الحالية التي تستمع تبقى كما هي؛ من لا يستمع لا يضرّه).
  - مخفي تلقائياً على صفحات لا معنى للزر فيها: `/auth`, `/welcome`, `/install`, `/forgot-password`, `/reset-password`, `/pricing`, `/admin`, وأي صفحة تحت `/daily/*` (الإيجار اليومي له تدفّق دفع مختلف).

- يُركَّب مرّة واحدة في `src/components/AppShell.tsx` بجانب `BottomNav`.

- إزالة التعارض: زر `+` الموجود حالياً في صفحة `Payments` (FAB محلي) **يُزال** لأن العالمي يحلّ محله. زر «إضافة دفعة» داخل بطاقة الوحدة في `UnitDetail` **يبقى** لأنه مرتبط بسياق الوحدة (يُمرَّر `unitId` تلقائياً) ولا يتعارض بصرياً مع العائم.

- التموضع لا يصطدم بـ:
  - أزرار الواتساب/المساعد إن وُجدت — نُبقي العائم في الجهة المعاكسة لِما هو موجود (افتراضياً start في RTL = يمين الشاشة الأيمن — نُراجع التصادمات بعد التركيب).

---

## الملفات المتأثرة

**تعديل:**
- `src/components/NewTenancyDialog.tsx` — استبدال `Math.round` بـ `Math.floor` + ضبط `monthsBack`.
- `src/components/AddUnitDialog.tsx` — نفس التعديل.
- `src/components/AppShell.tsx` — تركيب `QuickAddPaymentFab`.
- `src/pages/Payments.tsx` — إزالة زر `+` المحلي إن وُجد لتفادي التكرار.

**إنشاء:**
- `src/components/QuickAddPaymentFab.tsx` — الزر العائم + إدارة حالة الـDialog + إخفاء حسب المسار.

**خارج النطاق:**
- لا تغيير DB / RLS / منطق `getUnitArrears`.
- لا تصحيح بأثر رجعي للوحدات المخزَّنة سابقاً برقم مقرَّب.
- لا تغيير في صفحات الإيجار اليومي.

## نتيجة متوقّعة

1. إدخال 9798 ر.ع. متأخرات يُحفظ كـ 9798 بالضبط، ويظهر في الشارة كذلك.
2. زر `+` للدفعة متاح من أي صفحة رئيسية بنقرة واحدة، بدون نسخ كود.
