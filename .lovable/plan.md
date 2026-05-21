
## المشكلة

المُشغّل (trigger) الذي يربط طلبات الصيانة المكتملة بالمصروفات يعمل بشكل صحيح للطلبات الجديدة، لكن **الطلبات القديمة التي اكتملت قبل إضافة المُشغّل لم تُسجَّل تلقائياً** في جدول المصروفات.

### ما وجدته في قاعدة البيانات
- 4 طلبات صيانة بحالة `done` ولها تكلفة (15، 40.1، 30، -9).
- 0 مصروفات مرتبطة بأي طلب صيانة.
- المُشغّل `trg_sync_maintenance_expense` موجود وسليم، لكنه يعمل فقط عند تغيير الحالة الآن.
- الاختبار اليدوي أكد أن الإدراج يعمل — السبب فعلاً أن البيانات القديمة سابقة للمُشغّل.

كما لاحظت طلباً واحداً بتكلفة سالبة (-9) لن يُسجَّل لأن المُشغّل يشترط `cost > 0`.

## الخطة

### 1. Migration لتعبئة البيانات القديمة (backfill)
إدراج مصروفات لكل طلب صيانة `done` بتكلفة موجبة وغير مرتبط بمصروف بعد:

```sql
INSERT INTO public.expenses (building_id, unit_id, category, amount, vendor, description, expense_date, maintenance_request_id)
SELECT
  m.building_id, m.unit_id, 'maintenance', m.cost, m.vendor,
  m.title || CASE WHEN m.vendor IS NOT NULL AND length(trim(m.vendor))>0 THEN ' — '||m.vendor ELSE '' END,
  COALESCE(m.resolved_at::date, CURRENT_DATE),
  m.id
FROM public.maintenance_requests m
LEFT JOIN public.expenses e ON e.maintenance_request_id = m.id
WHERE m.status='done' AND m.cost IS NOT NULL AND m.cost > 0 AND e.id IS NULL;
```

### 2. التحقق
- إعادة فتح صفحة الصيانة → يجب أن تظهر شارة "↗ مصروف مُسجّل" + معرف ووصف المصروف على البطاقات الأربع المكتملة.
- صفحة المصروفات تعرض السجلات الجديدة.

### ملاحظات
- لن أعدّل المُشغّل — يعمل بشكل صحيح للطلبات الجديدة.
- الطلب ذو التكلفة السالبة (-9) سيُتجاهَل كما هو مُصمَّم.
- لا تغييرات في كود الواجهة.
