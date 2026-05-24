## المشكلة

في وحدات B2 #4، B2 #8 (و B2 #06) — نمط الدفع **مؤخّر**، آخر دفعة بتاريخ 5/4/2026 تخصّ شهر 3/2026، ومع ذلك لا تظهر متأخرات شهر أبريل رغم أننا في 24/5.

السبب: في `EditUnitDialog.tsx` و`NewTenancyDialog.tsx` عند إدخال «تاريخ آخر دفعة» يتم تعيين:
```
opening_balance_date = nextMonthStart(prevPayDate)
```
هذا صحيح فقط لنمط **مُقدّم** (الدفعة تغطي الشهر الذي وقعت فيه)، لكن في **المؤخّر** الدفعة تغطي الشهر **السابق** لها، فينتج عن ذلك تخطّي شهر كامل وعدم احتساب متأخراته.

نتيجة على B2 #4: anchor مضبوط على 1/5/2026 → `cyclesDue` للمؤخّر في 24/5 = 0 → لا متأخرات. الصحيح: anchor = 1/4/2026 → cyclesDue = 1 (دورة أبريل انتهت 30/4 وغير مدفوعة).

## الحل

### 1) إصلاح منطق الحفظ (التلقائي للمستقبل)
في كل من `EditUnitDialog.tsx` (سطر ~138-144) و`NewTenancyDialog.tsx` (سطر ~160-167):
- إذا `rent_timing === 'arrears'` ⇒ `opening_balance_date = bounds.start` (أول يوم في شهر تاريخ الدفعة).
- إذا `rent_timing === 'advance'` ⇒ يبقى `bounds.nextMonthStart` كما هو.

### 2) تحديث نصّ التلميح
في `LastPaymentSection.tsx` (سطر 122-126) جعل عبارة «المتأخرات تُحسب من …» تستخدم `bounds.start` لنمط المؤخّر، و`bounds.nextMonthStart` لنمط المُقدّم. يتطلب تمرير `rentTiming` كـ prop اختياري إلى المكوّن، أو حساب التسمية في الأماكن المستدعية.

### 3) ترحيل البيانات (migration) لإصلاح الوحدات الحالية
لكل وحدة:
- `rent_timing = 'arrears'`
- `opening_balance_date IS NOT NULL`
- `last_paid_date IS NOT NULL`
- `opening_balance_date = date_trunc('month', last_paid_date) + interval '1 month'` (أي أن النظام طبّق قاعدة «مُقدّم» عليها سابقاً)

نُرجِع `opening_balance_date` شهراً واحداً للخلف:
```sql
UPDATE units
   SET opening_balance_date = date_trunc('month', last_paid_date)::date
 WHERE rent_timing = 'arrears'
   AND last_paid_date IS NOT NULL
   AND opening_balance_date IS NOT NULL
   AND opening_balance_date = (date_trunc('month', last_paid_date) + interval '1 month')::date;
```
ينطبق نفس الإصلاح على `tenancies` إن وُجد فيها نفس النمط (يحتاج فحص).

### 4) اختبار إضافي في `balance.test.ts`
سيناريو: وحدة مؤخّر، تاريخ آخر دفعة 5/4/2026، بعد الإصلاح `opening_balance_date = 2026-04-01`، وفي 24/5/2026 → `cyclesDue = 1` و`outstanding = rent_amount`.

## ملاحظات فنّية
- لا يحتاج تعديل `balance.ts` نفسه؛ المنطق صحيح، الخلل في **مَن يكتب** anchor.
- بعد الإصلاح ستظهر متأخرات أبريل على B2 #4 و#8 و#06 فوراً.
