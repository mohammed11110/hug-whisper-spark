
## الخطة

### 0) اسم المؤجر لكل حساب (إعداد مشترك)
- إضافة حقل `landlord_name` (اختياري) في إعدادات العلامة التجارية `AppSettings.brand` (يظهر في الإيصالات والكشوف والعقود وتذكيرات الواتساب).
- إضافة حقل اختياري على مستوى كل **بناية** (`landlord_name`) لدعم حالات تعدد المؤجرين: عمود جديد في جدول `buildings` + تعديل `AddBuildingDialog` و `BuildingDetail`.
- منطق العرض: إن وُجد اسم مؤجر للبناية يُستخدم، وإلا يُستخدم اسم المؤجر العام من الإعدادات.

### 1) تذكيرات تلقائية + إيصال PDF بعد كل دفعة
**أ. إيصال PDF فوري بعد إضافة دفعة**
- إضافة `buildReceiptHTML()` في `src/lib/pdfDocs.ts` (ثنائي اللغة، بألوان الهوية، شعار أملاكي، اسم المؤجر، رقم الإيصال من `formatReceipt`).
- بعد نجاح `AddPaymentDialog` يظهر زر "تنزيل الإيصال" + خيار مشاركة عبر واتساب للمستأجر.
- زر "إعادة طباعة الإيصال" في صفحة `Payments` و `UnitDetail` لكل دفعة سابقة.

**ب. التذكيرات التلقائية**
- جدول جديد `reminder_schedules` (يخزّن وقت آخر إرسال لكل وحدة/مستأجر ونوع التذكير: قبل الاستحقاق / متأخر).
- Edge Function جديدة `send-rent-reminders` تعمل يومياً عبر pg_cron:
  - تحسب الوحدات التي يستحق إيجارها خلال `upcomingDays` (من الإعدادات).
  - تحسب الوحدات المتأخرة.
  - تُنشئ روابط واتساب جاهزة (wa.me) باستخدام القوالب الحالية `templates.reminder` / `templates.late`.
  - تسجّل في `reminder_schedules` لتفادي التكرار.
- صفحة "التذكيرات" تعرض القائمة اليومية مع زر "إرسال" واحد لكل سطر.

### 2) كشف حساب لكل مستأجر + دفعات جزئية
**أ. الدفعات الجزئية**
- جدول `payments` فيه `expected_amount` و `amount` بالفعل ➜ نضيف منطق "الرصيد المتبقي" في `src/lib/balance.ts`.
- `AddPaymentDialog`: إظهار المبلغ المتوقع و"المتبقي" تلقائياً، السماح بدفع جزئي مع تنبيه واضح.
- شارة "دفع جزئي" في قوائم الدفعات.

**ب. كشف حساب المستأجر (Tenant Statement)**
- دالة `buildTenantStatementHTML()` في `pdfDocs.ts` تعرض:
  - بيانات المستأجر + الوحدة + اسم المؤجر + فترة العقد.
  - جدول زمني: مستحقات شهرية، مدفوعات، رصيد متراكم.
  - الرصيد الافتتاحي + التأمين + المتأخرات النهائية.
- زر "كشف حساب PDF" في `UnitDetail` و صفحة `Tenants`.
- تصدير CSV مقابل.

### 3) طلبات الصيانة
**أ. قاعدة البيانات** (migration)
- جدول `maintenance_requests`:
  - `building_id`, `unit_id`, `tenant_name`, `title`, `description`, `priority` (low/normal/high/urgent), `status` (open/in_progress/done/cancelled), `photos jsonb`, `cost`, `vendor`, `created_at`, `resolved_at`.
- RLS: نفس نمط `expenses` (owner + members).
- ربط اختياري بإنشاء `expense` تلقائي عند الإغلاق بتكلفة.

**ب. الواجهة**
- صفحة جديدة `/maintenance` (قائمة + فلترة حسب الحالة/الأولوية/البناية).
- زر إضافة طلب (مع رفع صور إلى bucket جديد `maintenance-photos`).
- صفحة تفاصيل الطلب (timeline + تحديث الحالة + إضافة تكلفة).
- إدخال في `BottomNav` و `AppSidebar`.
- شارة على لوحة التحكم تعرض عدد الطلبات المفتوحة.

---

### التفاصيل التقنية
- ملفات جديدة: `supabase/functions/send-rent-reminders/index.ts`, `src/pages/Maintenance.tsx`, `src/pages/MaintenanceDetail.tsx`, `src/components/AddMaintenanceDialog.tsx`, `src/components/ReceiptActions.tsx`.
- migrations:
  1. `ALTER TABLE buildings ADD COLUMN landlord_name text;`
  2. CREATE TABLE `reminder_schedules` + RLS + pg_cron job.
  3. CREATE TABLE `maintenance_requests` + RLS + bucket `maintenance-photos`.
- تحديث `pdfDocs.ts`: `buildReceiptHTML`, `buildTenantStatementHTML` (ثنائيي اللغة بألوان الهوية).
- تحديث `AppSettings.brand` بإضافة `landlordName`.
- تحديث `i18n.tsx` بالمفاتيح الجديدة (AR/EN).

### الترتيب الموصى به للتنفيذ
1. اسم المؤجر (الأساس لباقي المخرجات).
2. إيصال PDF + كشف حساب المستأجر (تأثير فوري).
3. الدفعات الجزئية.
4. التذكيرات التلقائية.
5. طلبات الصيانة.

هل أبدأ بالتنفيذ بهذا الترتيب؟
