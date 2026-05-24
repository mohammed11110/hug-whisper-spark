## المشكلة

عند حفظ الإيصال يتم تعديل حقول الوحدة:
- `opening_balance` يُنقص بمقدار ما دُفع من متأخرات سابقة
- `opening_balance_date` يُقدَّم إذا تمت تسوية الفترة بالكامل
- `last_paid_date` و `status` يتحدَّثان

عند الحذف الناعم (`deleted_at = now`) في `src/pages/Payments.tsx`، **لا يُعكس أيّ من هذه التعديلات**، فيبقى `opening_balance` منخفضًا و`opening_balance_date` متقدّمًا، بينما `getUnitArrears` يستبعد الإيصال المحذوف — والنتيجة: شارة المتأخرات تظهر رقمًا خاطئًا أقل من الواقع (وحالة "ياسر" تتكرر معكوسة بعد الحذف).

نفس المشكلة عند الاسترجاع من السلة في `src/pages/PaymentsTrash.tsx`.

## الحل الجذري

إعادة اشتقاق حالة الوحدة من مصدر واحد بعد كل عملية حذف/استرجاع، بدل محاولة "عكس" التعديل يدويًا.

### الخطوات

**1) دالة مساعدة جديدة** `src/lib/unitState.ts`
- `recomputeUnitStateFromPayments(unitId)` تقوم بـ:
  - جلب الوحدة + كل المدفوعات غير المحذوفة
  - حساب `last_paid_date` = أحدث `payment_date` (أو `null` إذا لا توجد)
  - حساب `status` عبر `getUnitArrears`: `paid` إذا `totalShortfall === 0`، وإلا `late` (أو `soon` حسب التاريخ مقابل `due_day`)
  - **عدم تعديل** `opening_balance` و `opening_balance_date` هنا (المنطق التالي يُلغي حاجة تعديلهما)
- تُكتب التحديثات بـ `update()` واحدة على `units`.

**2) إلغاء التعديل الجانبي على `opening_balance` عند الحفظ** في `AddPaymentDialog.tsx` (السطور 586-597)
- إزالة `upd.opening_balance = ...` و `upd.opening_balance_date = ...` تمامًا.
- `getUnitArrears` يطرح المدفوعات السابقة (sentinel cycle) من `opening_balance` ديناميكيًا، فالمتأخرات السابقة "تتقلّص" تلقائيًا عبر صفوف `payments` نفسها بدون لمس عمود الوحدة.
- الفائدة: عند حذف أي إيصال، يكفي حذف صف الدفع لتعود المتأخرات تلقائيًا — لا يوجد حقل ملوّث يحتاج عكسًا.
- نُبقي فقط `last_paid_date` و `status`.

**3) استدعاء `recomputeUnitStateFromPayments` بعد**:
- الحذف الناعم في `Payments.tsx → handleDelete` (بعد `update deleted_at`).
- الاسترجاع في `PaymentsTrash.tsx → restore` (بعد `update deleted_at = null`).
- الحذف النهائي في `PaymentsTrash.tsx → purge` (بعد `delete()`).
- الحفظ في `AddPaymentDialog.tsx` (يحلّ محل منطق `newStatus` المحلي ويضمن اتّساقًا واحدًا).

**4) اختبار الانحدار** في `src/test/balance-arrears.test.ts`:
- سيناريو ياسر: `opening_balance=405` → دفع 40 → الباقي 365 → حذف الإيصال → الباقي يعود 405.
- دفع كامل ثم حذف → `status` تعود من `paid` إلى `late`، و `last_paid_date` تُحدَّث للأحدث المتبقي.

### الملفات المتأثرة

- جديد: `src/lib/unitState.ts`
- تعديل: `src/components/AddPaymentDialog.tsx` (إزالة 586-597، استبدال 599 بالاستدعاء الموحّد)
- تعديل: `src/pages/Payments.tsx` (إضافة استدعاء في `handleDelete`)
- تعديل: `src/pages/PaymentsTrash.tsx` (إضافة استدعاء في `restore` و `purge`)
- تحديث: `src/test/balance-arrears.test.ts` (سيناريوهات الحذف/الاسترجاع)

### لماذا هذا "جذري"؟

نُلغي مصدر الحقيقة المزدوج: `opening_balance` المعدَّل + صفوف `payments`. بعد التغيير، **صفوف payments هي مصدر الحقيقة الوحيد** للمتأخرات التراكمية، و`opening_balance` يبقى ثابتًا كرصيد افتتاحي تاريخي. أي عملية CRUD على الدفعات تنعكس فورًا في شارة المتأخرات بلا حاجة لـ "عكس يدوي".
