# فحص قسم الإيجارات اليومية — المشاكل المكتشفة

## المشاكل الحرجة

### 1) الـ Triggers غير مُفعّلة في قاعدة البيانات (حرج)
الدوال `check_daily_booking_overlap()` و `auto_create_cleaning_task()` موجودة، لكن **لم تُربط كـ triggers** على جدول `daily_bookings`. النتائج:
- **لا حماية من الحجوزات المتداخلة**: يمكن حجز نفس الوحدة لضيفَين في نفس التواريخ بدون أي خطأ.
- **مهام التنظيف لا تُنشأ تلقائياً** عند تسجيل مغادرة الضيف (قسم التنظيف سيظل فارغاً دائماً).

**الإصلاح** (migration):
```sql
CREATE TRIGGER trg_daily_booking_overlap
  BEFORE INSERT OR UPDATE ON public.daily_bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_daily_booking_overlap();

CREATE TRIGGER trg_daily_auto_cleaning
  AFTER UPDATE ON public.daily_bookings
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_cleaning_task();

CREATE TRIGGER trg_daily_units_updated
  BEFORE UPDATE ON public.daily_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ونفسه للجداول الأخرى التي بها updated_at
```

### 2) "اليوم" يُحسب بتوقيت UTC لا بالتوقيت المحلي (متوسط)
في `DailyBookings.tsx` و `DailyDashboard.tsx` و `DailyCalendar.tsx` يُستخدم:
```ts
new Date().toISOString().slice(0,10)
```
هذا يعطي تاريخ UTC. مستخدم في سلطنة عُمان (UTC+4) بعد الساعة 8 مساءً سيرى "اليوم" = الغد. يؤثر على:
- بطاقات الدخول/المغادرة اليوم في لوحة المعلومات.
- التاريخ الافتراضي لحجز جديد.
- تظليل عمود "اليوم" في التقويم.

**الإصلاح**: استخدام دالة محلية:
```ts
const localYMD = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
```
وتطبيقها في الملفات الثلاثة.

## مشاكل ثانوية (اختيارية)

3. تحذير React: `DialogContent` بدون `DialogDescription` — إضافة `<DialogDescription>` (أو `aria-describedby={undefined}`) في حوارات الحجز/الوحدة/التسعير.
4. `DailyMessages` يستخدم `insert` للقالب الجديد؛ لو وُجد ضمنياً سيفشل — تحويلها لـ `upsert` على `(building_id, key)`.

## الملفات المتأثرة
- **Migration جديد** للـ triggers (يتطلب موافقتك).
- `src/pages/daily/DailyBookings.tsx`, `DailyDashboard.tsx`, `DailyCalendar.tsx` — استبدال حساب "اليوم".
- (اختياري) `DailyMessages.tsx` + ثلاث حوارات لإضافة Description.

## ما تم التحقق منه وهو سليم
- مسارات `/daily/*` مسجّلة في `App.tsx`.
- جميع الجداول الستة موجودة في قاعدة البيانات.
- محرّك التسعير (`pricing.ts`) منطقه صحيح: قاعدة موسمية > نهاية أسبوع > الأساسي.
- زر "حجز جديد" يعمل، وحساب الإجمالي تلقائي، ورسالة الواتساب جاهزة.

هل تريدني أن أنفّذ هذه الإصلاحات؟
