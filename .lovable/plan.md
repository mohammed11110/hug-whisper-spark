## التنفيذ: المرحلة 1 (الخيار ب)

النموذج المُعتمد في كل التطبيقات الاحترافية: **جدول عقود مستقل** مع ربط المدفوعات بالعقد.

---

### 1. تغييرات قاعدة البيانات (Migration)

**جدول جديد `tenancies`:**
- `id, building_id, unit_id`
- بيانات المستأجر: `tenant_name, tenant_phone, tenant_email, tenant_id_type, tenant_id_number, tenant_id_image_url`
- العقد: `contract_start_date, contract_end_date, contract_type`
- الإيجار: `rent_amount, rent_type, due_day`
- التأمين: `security_deposit, deposit_status, deposit_refund_amount, deposit_refunded_at`
- الإغلاق: `status` (`active` / `ended`), `ended_at`, `ended_reason`, `outstanding_at_end`, `notes`
- `opening_balance, opening_balance_date` (لترحيل الديون)

**RLS**: نفس نمط `units` — مالك العقار + أعضاء حسب الدور.

**Index جزئي**: عقد `active` واحد فقط لكل وحدة.

**تعديل `payments`**: إضافة عمود `tenancy_id uuid` (nullable للتوافق).

**ترحيل تلقائي**: لكل وحدة فيها `tenant_name` → إنشاء عقد `active` بنفس البيانات + ربط كل مدفوعاتها بهذا العقد.

---

### 2. واجهة المستخدم

**حوار جديد `EndTenancyDialog`** (زر "إخلاء المستأجر" في صفحة الوحدة):
- تاريخ الإخلاء + سبب
- عرض تلقائي للرصيد المحسوب
- اختيار مصير التأمين: مُعاد كاملاً / محتجز جزئي (مع مبلغ) / محتجز كامل
- اختيار: تسوية الدين (✓) أو ترحيله كرصيد على المستأجر السابق
- عند التأكيد: تحديث العقد لـ `ended` + تفريغ بيانات المستأجر من `units` + الوحدة شاغرة

**حوار جديد `NewTenancyDialog`** (زر "مستأجر جديد" يظهر للوحدة الشاغرة):
- بيانات المستأجر + بداية العقد + الإيجار + التأمين
- ينشئ عقداً `active` + يُحدّث mirror fields على `units`

**صفحة الوحدة `UnitDetail.tsx`**:
- إذا الوحدة شاغرة → بطاقة كبيرة "لا يوجد مستأجر حالياً" + زر "إضافة مستأجر"
- إذا فيها عقد نشط → نفس العرض الحالي + زر صغير "إخلاء" بجانب اسم المستأجر
- شريط ملخص أعلى الصفحة عند وجود عقود `ended` بمستحقات: "⚠️ مستأجر سابق عليه X ج.م"

**`AddPaymentDialog`**: عند فتحه من وحدة بها عقد نشط → يُربط تلقائياً بـ `tenancy_id`. يضاف خيار صغير "تسجيل دفعة لمستأجر سابق" → تظهر قائمة بالعقود المنتهية ذات الرصيد.

---

### 3. ملفات تتأثر
- ➕ `supabase/migrations/...` (جدول + RLS + ترحيل بيانات)
- ➕ `src/components/EndTenancyDialog.tsx`
- ➕ `src/components/NewTenancyDialog.tsx`
- ✏️ `src/pages/UnitDetail.tsx` (الأزرار + حالة الشاغر)
- ✏️ `src/components/AddPaymentDialog.tsx` (ربط `tenancy_id`)
- ✏️ `src/lib/i18n2.tsx` (مفاتيح ترجمة)

### خارج النطاق (مرحلة لاحقة)
- تبويب سجل العقود الكامل
- صفحة "المستحقات السابقة" المستقلة
- كشف حساب PDF للعقد المنتهي
- تحديث تقارير التحصيل الشهري

---

### ملاحظة مهمة
الترحيل التلقائي يحفظ كل البيانات الحالية بدون فقدان. سيُطلب منك الموافقة على Migration قبل تنفيذه.