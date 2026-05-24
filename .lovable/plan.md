
# جعل المتأخرات متوافقة مع التعديل الأخير

التعديل الأخير ربط الاستحقاق والإيصالات بـ **يوم بداية العقد + نمط الدفع (مقدّم/مؤخّر)** عبر `getNextDueInfo` و `periodsElapsed`. لكن لا تزال هناك أماكن تحسب «المتأخرات» باستخدام **الشهر الميلادي** أو **`due_day` فقط**، مما يعطي تنبيهات خاطئة (مثلاً عقد مؤخّر يبدأ 10/1 يظهر متأخراً في يناير قبل استحقاقه فعلياً في 10/2).

## التعديلات

### 1. `src/pages/MonthlyCollection.tsx` — تحصيل شهري
- `computeMonthRows`: بدل مقارنة `period_start` بالشهر الميلادي (start/end)، احسب **نافذة الدورة** لكل وحدة بالاعتماد على `getCycleByStartMonth(year, month, anchorDay)` للشهر المختار، وطابِق الدفعات على هذه النافذة.
- استبعد الوحدات التي لم تبدأ دورتها بعد في الشهر المختار (عقد مؤخّر بعقد يبدأ 10/الشهر-القادم لا يظهر متأخراً).
- `overdueMonthsFor`: استخدم `periodsElapsed(anchor, monthEnd, rentType)` ناقص الدورات المدفوعة وناقص 1 إذا `rent_timing='arrears'`، بدل فرق الشهور التقويمية.
- ملصق «متأخر N شهر» يبقى كما هو لكن مبني على الحساب الجديد.

### 2. `src/pages/Notifications.tsx` — تنبيهات
- استبدل `late` المعتمد على `u.status === 'late'` بـ: `late` عندما `outstanding > 0` **و** تاريخ الاستحقاق التالي (`getNextDueInfo`) قد مضى.
- استبدل حساب `upcoming` المعتمد على `due_day` التقويمي بـ `getNextDueInfo(u).nextDueDate` — أي للعقود المؤخّرة يكون الاستحقاق نهاية الدورة، وللمقدّمة بداية الدورة التالية.

### 3. `src/pages/BuildingDetail.tsx` — فرز الوحدات
- `dueDayDistance`: استخدم `getNextDueInfo(u).nextDueDate` بدل `due_day` المسطّح حتى تتفق بطاقات الوحدات مع منطق الاستحقاق الجديد.

### 4. `src/lib/balance.ts` — إضافة مساعد صغير
- إضافة `overdueCyclesCount(unit, payments)` يُرجع عدد الدورات المستحقة وغير المدفوعة (مع خصم دورة لـ arrears)، لاستخدامه في MonthlyCollection و Notifications بدل التكرار.

## ملفات تُعدَّل
- `src/lib/balance.ts`
- `src/pages/MonthlyCollection.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/BuildingDetail.tsx`

لا حاجة لتعديل قاعدة البيانات، ولا تعديل على `computeBalance` نفسه (يحسب صحيحاً بالفعل).
