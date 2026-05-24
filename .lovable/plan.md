# إصلاح خلل احتساب المتأخرات

## السبب الجذري

بعد فحص بيانات B2/F4 و B2/F8 في القاعدة، اتضح أن:

- `opening_balance_date = 2026-04-01` و `opening_balance = 0` (صحيح — يعني "كل ما قبل أبريل مسوّى")
- `last_paid_date = 2026-03-05` (صحيح)
- **لكن** تم أيضاً إدراج صف في جدول `payments` بمبلغ 80 ر.ع. لشهر مارس (period_start=2026-03-01)

دالة `computeBalance` في `src/lib/balance.ts` تحتسب:
```
المتراكم = الإيجار × عدد الأشهر من opening_balance_date إلى اليوم
المتأخرات = (opening_balance + المتراكم) − مجموع كل المدفوعات
```

المشكلة: `مجموع كل المدفوعات` لا يفلتر حسب التاريخ، فالدفعة التاريخية لشهر مارس (80 ر.ع.) تُطرح من متراكم أبريل (80 ر.ع.) → الناتج صفر بدلاً من 80.

وفي B2/F8 تم حفظ التعديل 3 مرات → 3 دفعات وهمية = 240 ر.ع. تطرح من المتراكمات.

## الحل

`opening_balance_date` + `last_paid_date` يكفيان لتمثيل "كل ما قبل هذا التاريخ مسوّى" — لا حاجة لإدراج صف دفعة وهمي للشهر التاريخي.

### التعديلات

**1. `src/components/EditUnitDialog.tsx`** (السطور 119–145):
- حذف إنشاء `prevPayPayload` وإدراجه في جدول `payments`.
- الإبقاء فقط على تحديث `last_paid_date` و `opening_balance_date` و `opening_balance=0` على صف `units`.
- متغير `prevPayAmount` يبقى للعرض فقط (يساعد المستخدم في تأكيد المبلغ، لكن لا يُحفظ كدفعة).

**2. `src/components/NewTenancyDialog.tsx`** (السطور 155 وما حولها):
- نفس التغيير: لا إدراج دفعة تاريخية، فقط ضبط `opening_balance_date` على بداية الشهر التالي و `last_paid_date` على التاريخ المُختار.

**3. (اختياري) `src/components/LastPaymentSection.tsx`**:
- تعديل نص التلميح: "سيتم احتساب المتأخرات تلقائياً من بداية الشهر الذي يلي تاريخ الدفعة" — بدون ذكر "تسجيل دفعة".
- يمكن إزالة حقل المبلغ أو تركه كحقل اختياري للتأكيد البصري فقط.

**4. تنظيف البيانات الموجودة**:
سيتم تشغيل migration لتعليم الدفعات الوهمية الحالية كمحذوفة (soft delete) للوحدات المتأثرة:

```sql
UPDATE public.payments
SET deleted_at = now()
WHERE deleted_at IS NULL
  AND notes IN (
    'دفعة سابقة مُسجّلة من شاشة التعديل',
    'دفعة سابقة مُسجّلة عند إضافة المستأجر',
    'Prior payment recorded from edit screen',
    'Prior payment recorded at tenant creation'
  );
```

هذا سيُصلح فوراً B2/F4 و B2/F8 وأي وحدة أخرى أُدخل لها "آخر دفعة" عبر هذه الشاشات.

## النتيجة المتوقعة

بعد التطبيق، B2/F4 و B2/F8 (إيجار 80 ر.ع.، opening_balance_date=2026-04-01، اليوم 2026-05-24):
- متراكم أبريل = 80 ر.ع.
- متراكم مايو = 80 ر.ع. (لأن due_day=5 وقد مضى)
- المدفوعات بعد أبريل = 0
- **المتأخرات = 160 ر.ع.** ✓

## الملفات المعدّلة

- `src/components/EditUnitDialog.tsx`
- `src/components/NewTenancyDialog.tsx`
- `src/components/LastPaymentSection.tsx` (تعديل نصي طفيف)
- migration واحد لتنظيف الدفعات الوهمية
