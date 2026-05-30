
## الفكرة
الجدول المطلوب موجود فعلاً باسم `tenancies` (= "lease")، وعمود `payments.tenancy_id` موجود كذلك. المشكلة أنّ الحسابات تفلتر بـ `unit_id` فقط، فيرث المستأجر الجديد إيصالات المستأجر السابق. سنُحوّل **مصدر الحقيقة للرصيد** من «الوحدة» إلى «العقد النشط»، مع الحفاظ الكامل على كل الإيصالات القديمة في أرشيف العقد المنتهي.

(سنبقي اسم `tenancies` بدل إنشاء جدول `leases` جديد — نفس البنية المطلوبة تماماً، وتغيير الاسم سيكسر بيانات وكوداً قائماً دون فائدة.)

## التغييرات

### 1) قاعدة البيانات — migration واحدة
- **Backfill حاسم**: لكل وحدة، تعيين `payments.tenancy_id` للإيصالات التي ليس لها `tenancy_id` بناءً على تاريخ الدفع داخل نطاق `tenancies.contract_start_date → ended_at/contract_end_date`. الإيصالات التي لا تطابق أي عقد تبقى بـ `tenancy_id = NULL` (إيصالات يتيمة، تُعرض في «أرشيف عام»).
- **Trigger جديد** `payments_set_tenancy_id`: عند `INSERT/UPDATE` إذا كان `tenancy_id` فارغاً، يُملأ تلقائياً من العقد النشط للوحدة (أو المطابق للتاريخ). يضمن عدم تسرّب أي إيصال جديد بلا عقد.
- **تحديث `recompute_unit_state(_uid)`**: حذف معيار التاريخ السابق (cutoff)، واستبداله بفلترة على `tenancy_id = <active tenancy of unit>`. الإيصالات بلا `tenancy_id` لا تُحسب ضمن العقد النشط.
- **Index**: `CREATE INDEX IF NOT EXISTS idx_payments_tenancy_id ON public.payments(tenancy_id)`.
- إعادة احتساب كل الوحدات في نهاية الـ migration.

### 2) منطق الحساب — `src/lib/balance.ts`
- إضافة معاملات `activeTenancyId` و`contractStartDate` (موجودة فعلاً عبر `unit.contract_start_date`).
- استبدال فلتر التاريخ الحالي بفلتر صريح: يُحسب الإيصال فقط إذا `payment.tenancy_id === activeTenancyId`. للإيصالات القديمة بلا `tenancy_id` (قبل الـ backfill): استخدام التاريخ كـ fallback فقط للوحدة الحالية.
- التوقيع متوافق رجعياً (لو لم يُمرَّر `activeTenancyId`، يُستنتج من بيانات الوحدة).

### 3) دورة حياة العقد
- **«إخلاء الوحدة» (`EndTenancyDialog`)** — موجود فعلاً:
  - يضع `tenancies.status='ended'`, `ended_at=today`.
  - يُفرّغ بيانات المستأجر من `units` ويضع `status='vacant'`.
  - **الإيصالات لا تُمسّ** — تبقى مربوطة بـ `tenancy_id` للعقد المنتهي.
- **«تسجيل مستأجر جديد» (`NewTenancyDialog`)** — موجود فعلاً:
  - يُنشئ صفّاً جديداً في `tenancies` بـ `status='active'` و`tenancy_id` جديد.
  - أي إيصال جديد يربط بهذا الـ id (عبر `AddPaymentDialog` + الـ trigger).
  - الرصيد يبدأ من الصفر (أو من `opening_balance` للعقد الجديد فقط).

### 4) تمرير العقد النشط للمستدعين
في الملفات التالية: تحميل `active tenancy_id` للوحدة (استعلام واحد بسيط على `tenancies` بحالة `active`)، وتمريره لـ `getUnitArrears`:
- `src/components/ArrearsBadge.tsx`
- `src/components/EndTenancyDialog.tsx`
- `src/components/EditPaymentDialog.tsx`
- `src/components/AddPaymentDialog.tsx`
- `src/pages/UnitDetail.tsx`
- `src/pages/Tenants.tsx`
- `src/pages/Payments.tsx`
- `src/pages/Reports.tsx`
- `src/pages/Notifications.tsx`

في الصفحات التي تعرض عدة وحدات، نضيف join واحد (`tenancies` where `status='active'`) ونبني خريطة `unitId → activeTenancyId`.

### 5) قسم «سجل العقود / Lease History» على صفحة الوحدة
في `src/pages/UnitDetail.tsx`:
- تبويب «المدفوعات» يعرض إيصالات العقد النشط فقط افتراضياً.
- قسم جديد «سجل المستأجرين السابقين»: جدول بسيط من `tenancies` بحالة `ended` للوحدة:
  - اسم المستأجر، الفترة (`contract_start_date → ended_at`)، إجمالي المدفوع، الرصيد عند الإنهاء (`outstanding_at_end`)، حالة الوديعة.
  - زر «عرض الإيصالات» يفتح Drawer بإيصالات ذلك العقد (للقراءة فقط).
- في `src/pages/Payments.tsx`: شارة صغيرة «مستأجر سابق» بجانب الإيصالات المرتبطة بعقد `ended` حتى لا تختلط بصرياً.

### 6) اختبارات قبول
- إنهاء عقد لوحدة فيها مدفوعات → الإيصالات تبقى مرئية ضمن «سجل العقود» ولا تظهر في رصيد المستأجر الجديد.
- إضافة مستأجر جديد → المتأخرات/الرصيد يبدآن من الصفر (أو من `opening_balance` الذي يُدخله المستخدم).
- شارة `ArrearsBadge` تعكس العقد النشط فقط.
- اختبار `vitest` جديد: `lease-isolation.test.ts` يُغطي السيناريو الكامل.

## ما لا يتغير
- لا حذف ولا تعديل لأي إيصال قديم.
- جدول `tenancies` و`payments.tenancy_id` كما هما (نُفعّلهما فقط بشكل صحيح).
- صلاحيات RLS وسياسات الـ grace كما هي.
