## الهدف
1. إزالة كل ما يسبّب «اختفاء» المتأخرات أو تذبذبها بين القيم (٤٠٥ → ٣٢٥ …).
2. ربط حقل `due_day` الموجود في `units` فعليّاً بمحرّك المتأخرات، بحيث يُضاف إيجار الشهر تلقائياً إلى قائمة المتأخرات فور تجاوز يوم الاستحقاق دون دفع.

---

## ما الذي يسبّب التعارض اليوم؟

بعد فحص `balance.ts` و`AddPaymentDialog.tsx` و`unitState.ts`:

- ✅ تمّ سابقاً منع الازدواج (دفعة «متأخرات سابقة» لم تعد تُخصم من أول دورة).
- ✅ تمّ سابقاً وقف تعديل `opening_balance` عند الحفظ.
- ⚠️ ما زال **مصدران للحقيقة** متعايشَين:
  - `units.opening_balance` + `opening_balance_date` (تاريخي).
  - `units.last_paid_date` + `units.status` (مشتقّان من الدفعات لكن يُكتبان يدوياً من `recomputeUnitStateFromPayments` ومن trigger قاعدة البيانات `sync_unit_last_paid_date` في نفس الوقت → سباق وكتابة مزدوجة).
- ⚠️ `getUnitArrears` يستخدم `getAnchorDay()` المشتقّ من **يوم** `opening_balance_date`، ويتجاهل حقل `units.due_day` كليّاً. أي تغيير من المستخدم على «يوم الاستحقاق» لا أثر له.
- ⚠️ صفحات مهمَلة/مكرّرة: `MonthlyCollection.tsx` تعرض حسابات قديمة لا تستخدم `getUnitArrears`، وقد تُظهر أرقاماً مختلفة عن البطاقة والإيصال.

---

## الخطّة

### 1) مصدر واحد لحالة الوحدة
- حذف الاستدعاء اليدوي لـ `recomputeUnitStateFromPayments` من `AddPaymentDialog`، `Payments`، `PaymentsTrash`.
- استبدالها بـ **trigger قاعدة بيانات موحَّد** على `payments` (insert/update/delete) يحدّث `units.last_paid_date` و`units.status` (paid/late/soon) باستخدام نفس منطق `getUnitArrears` المنقول إلى دالة SQL مبسّطة:
  - `status = 'late'` إذا توجد دورة مستحقّة غير مدفوعة أو `opening_balance > Σ(دفعات بنطاق يوم واحد على المرسى)`.
  - `status = 'paid'` إذا كل الدورات حتى اليوم مدفوعة بالكامل.
  - `status = 'soon'` إذا لا دفعات بعد ولا متأخرات.
- إبقاء `opening_balance` و`opening_balance_date` **للقراءة فقط** بعد الإنشاء (لا تُحدَّث من أي مكان في الكود إلا من شاشة تعديل الوحدة صراحةً).

### 2) ربط `due_day` بمحرّك المتأخرات
- تعديل `getAnchorDay(unit)` ليُفضّل `unit.due_day` إن وُجد (1..28)، وإلا يرجع إلى يوم `opening_balance_date`/`contract_start_date`.
- `getCycleByStartMonth` يبقى كما هو، لكنه سيستخدم `due_day` كيوم بداية الدورة الشهرية.
- النتيجة: إذا كان `due_day = 5` ولم يُدفع إيجار الشهر بحلول 5/الشهر → يظهر تلقائياً في قائمة «المتأخرات» للوحدة وفي البطاقة الحمراء وفي الإيصال التالي (تلقائي/يدوي).

### 3) حذف/تنظيف ما لا يُستخدم وما يسبّب أرقاماً متعارضة
- **حذف**: `src/pages/MonthlyCollection.tsx` (حسابات قديمة موازية، تُظهر «٣٥٠» بينما البطاقة «٣٢٥») — والتأكد من إزالة الراوت من `App.tsx` والروابط من `AppSidebar`/`BottomNav` إن وُجدت.
- **حذف** `recomputeUnitStateFromPayments` و`src/lib/unitState.ts` بعد نقل المنطق إلى trigger.
- **حذف** أي تعديل لـ `opening_balance`/`opening_balance_date` متبقٍّ في `AddPaymentDialog` (تأكيد).
- **حذف** trigger `sync_unit_last_paid_date` الحالي واستبداله بالنسخة الجديدة الموحَّدة.

### 4) واجهة الوحدة
- في `EditUnitDialog`/`AddUnitDialog`: إظهار حقل «يوم الاستحقاق الشهري (1–28)» بوضوح مع شرح موجز «يُحتسب الإيجار متأخراً إن لم يُدفع بحلول هذا اليوم من الشهر».
- في `UnitDetail` بطاقة المتأخرات: إضافة سطر صغير «يوم الاستحقاق: ٥ من كل شهر».

### 5) اختبارات
- توسيع `balance-arrears.test.ts`:
  - `due_day = 5`، آخر دفعة 4/الشهر → في 6/الشهر تظهر دورة الشهر الحالي في المتأخرات.
  - تعديل `due_day` بأثر رجعي يعيد حساب الدورات.
  - حذف الإيصال → الـ trigger يعيد `status` و`last_paid_date` تلقائياً.

---

## الملفات المتأثّرة
- migration جديدة: trigger موحَّد على `payments` + دوال SQL مساعدة.
- `src/lib/balance.ts` — `getAnchorDay` يحترم `due_day`.
- `src/components/AddPaymentDialog.tsx` — إزالة `recomputeUnitStateFromPayments`.
- `src/pages/Payments.tsx`, `src/pages/PaymentsTrash.tsx` — إزالة الاستدعاء.
- حذف: `src/lib/unitState.ts`, `src/pages/MonthlyCollection.tsx` (+ تنظيف الراوت).
- `src/components/EditUnitDialog.tsx`, `AddUnitDialog.tsx` — إبراز `due_day`.
- `src/pages/UnitDetail.tsx` — عرض يوم الاستحقاق.
- `src/test/balance-arrears.test.ts` — اختبارات `due_day` و delete-revert.

---

## ملاحظات تقنية للمراجعة
- الـ trigger سيُكتب بـ `LANGUAGE plpgsql SECURITY DEFINER` ومسار `search_path = public`.
- لن نلمس `auth/storage/realtime/vault`.
- لا تغيير على `opening_balance`؛ يبقى رقماً تاريخيّاً ثابتاً.
