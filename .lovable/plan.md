# تعديل وإلغاء طلبات الصيانة

إضافة نفس خاصية **التعديل** و**الإلغاء/الاسترجاع** التي أُضيفت للمصروفات، لكن لطلبات الصيانة في صفحة `Maintenance.tsx`.

## ما سيُضاف

1. **زر تعديل (✏️)** بجانب كل طلب صيانة — يفتح Dialog لتعديل:
   - العنوان، الوصف، الأولوية، المورد، التكلفة
2. **زر إلغاء/استرجاع (🚫/↺)** — يُميّز الطلب كـ "ملغى" دون حذفه:
   - الطلب يبقى ظاهراً في القائمة مع شطب وتعتيم
   - حالة `cancelled` موجودة أصلاً في `STATUSES` لكن سنضيف حقل `cancelled_at` للتمييز الزمني والاسترجاع
3. **الحذف الحالي** يبقى كما هو (إن وُجد).

## التغييرات التقنية

### قاعدة البيانات (migration)
```sql
ALTER TABLE public.maintenance_requests
  ADD COLUMN cancelled_at timestamptz NULL;
```

### الكود
- `src/pages/Maintenance.tsx`:
  - إضافة `Pencil` + `Ban`/`RotateCcw` بجانب أزرار تغيير الحالة
  - `toggleCancel(r)` يُحدّث `cancelled_at` + `status='cancelled'` أو يُرجع للحالة السابقة
  - تصميم الطلب الملغى: `line-through`, `opacity-60`
  - `logActivity` لكل من: updated, cancelled, restored
- `src/components/EditMaintenanceDialog.tsx` (جديد):
  - مبني على نمط `AddMaintenanceDialog`
  - يستقبل الطلب الحالي ويُحدّث الحقول عبر `supabase.from("maintenance_requests").update()`

## الملفات
- جديد: `supabase/migrations/<timestamp>_add_cancelled_at_to_maintenance.sql`
- جديد: `src/components/EditMaintenanceDialog.tsx`
- تعديل: `src/pages/Maintenance.tsx`
