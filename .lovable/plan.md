## سجل النشاطات (Activity Log) في الصفحة الرئيسية

إضافة سجل شامل يوثّق كل تغيير يحدث في النظام بالتاريخ والوقت الدقيق (يوم/شهر/سنة - ساعة:دقيقة:ثانية)، يظهر في بطاقة على لوحة التحكم.

### 1) قاعدة البيانات
جدول جديد `activity_log`:
- `id`, `user_id`, `building_id` (للفلترة حسب الصلاحيات)
- `entity_type` (tenant, payment, unit, building, expense, maintenance, settings…)
- `entity_id`, `entity_label` (اسم مقروء: "شقة 3 - أحمد")
- `action` (created, updated, deleted, restored)
- `changes` jsonb (الحقول المتغيرة: قبل/بعد)
- `description` (نص جاهز بالعربية والإنجليزية)
- `created_at` (timestamptz بدقة الميلي ثانية)

**RLS:** قراءة لأعضاء البناية، كتابة لمن لديه صلاحية على البناية.
**فهرس** على `(building_id, created_at desc)` للأداء.

### 2) طبقة التسجيل (Logger)
ملف جديد `src/lib/activityLogger.ts`:
- دالة `logActivity({ entityType, entityId, action, label, changes, buildingId })`
- استدعاؤها بعد كل عملية ناجحة في:
  - `AddTenantDialog` / تعديل المستأجر / إنهاء العقد
  - `AddPaymentDialog` / حذف دفعة / تعديل دفعة
  - `AddBuildingDialog` / `BuildingDetail` (تعديل/حذف)
  - `AddUnitDialog` / تعديل الوحدة / حذف
  - `AddExpenseDialog` / حذف مصروف
  - `AddMaintenanceDialog` / تغيير حالة الصيانة
  - `Settings` (تغيير اسم المؤجر، الشعار، إلخ)

### 3) واجهة العرض
**في `Dashboard.tsx`:**
بطاقة "آخر النشاطات / Recent Activity" تعرض آخر 10 سجلات مع:
- أيقونة حسب نوع الإجراء (➕ إضافة، ✏️ تعديل، 🗑 حذف، 💰 دفعة)
- النص الوصفي (مثل: "تم تحصيل 250 ر.ع من أحمد - شقة 3")
- الوقت بصيغة: `18 مايو 2026 - 14:32:07`
- زر "عرض الكل" → صفحة كاملة

**صفحة جديدة `/activity`:**
- قائمة كاملة قابلة للفلترة (نوع الإجراء، البناية، الفترة الزمنية)
- بحث نصي
- تصدير CSV/PDF
- ترقيم صفحات (50 لكل صفحة)

### 4) i18n
مفاتيح ترجمة جديدة لكل نوع إجراء ووصف بالعربية والإنجليزية، مع دوال تنسيق التاريخ المحلية.

### الملفات
**جديدة:**
- migration: `activity_log` + RLS
- `src/lib/activityLogger.ts`
- `src/pages/Activity.tsx`
- `src/components/dashboard/RecentActivityCard.tsx`

**معدّلة:**
- جميع الـ Dialogs أعلاه + `Dashboard.tsx` + `App.tsx` (route) + `AppSidebar.tsx` + `i18n2.tsx` + `types.ts` (تلقائي)

### ملاحظات
- لن تُسجَّل بأثر رجعي — السجل يبدأ من لحظة التفعيل.
- التخزين خفيف؛ لكن يمكن لاحقاً إضافة تنظيف تلقائي للسجلات الأقدم من سنة.
- بديل تقني: triggers على مستوى Postgres تُسجّل تلقائياً. أكثر متانة لكن أصعب في إنتاج نص وصفي ثنائي اللغة. الاقتراح الحالي يستخدم تسجيل من جانب التطبيق لسهولة الترجمة والوصف.

هل تريد البدء بالتنفيذ؟