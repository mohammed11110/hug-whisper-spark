## المشكلة

سجل النشاطات الأخيرة لا يلتقط عمليات مهمة مثل تسجيل عقد جديد، تعديل بيانات الوحدة/المستأجر، وحذف/استرجاع إيصال الاستلام. السبب أن دالة `logActivity` مستدعاة فقط في 5 أماكن (إضافة مبنى، إضافة وحدة، إضافة دفعة، صيانة، مصاريف)، بينما باقي عمليات الكتابة على قاعدة البيانات لا تسجّل أي نشاط.

## الإصلاح

إضافة استدعاءات `logActivity` في جميع نقاط التعديل المفقودة، مع نصوص عربية/إنجليزية واضحة وربطها بـ `building_id` و `entity_id` و `entity_label` لتظهر مباشرة في بطاقة "آخر النشاطات" وصفحة `/activity` عبر الـ realtime channel الموجود.

### النقاط التي ستُضاف فيها سجلات النشاط

| الملف | العملية | الإجراء (action) | الكيان (entity) |
|---|---|---|---|
| `src/components/NewTenancyDialog.tsx` | تسجيل عقد إيجار جديد | `created` | `tenant` |
| `src/components/EndTenancyDialog.tsx` | إنهاء عقد إيجار | `ended` | `tenant` |
| `src/components/EditUnitDialog.tsx` | تعديل بيانات الوحدة/المستأجر | `updated` | `unit` |
| `src/pages/UnitDetail.tsx` — `saveArrears` | تعديل المتأخرات الافتتاحية | `updated` | `unit` |
| `src/pages/UnitDetail.tsx` — رفع/تغيير عقد PDF | تحديث ملف العقد | `updated` | `unit` |
| `src/pages/UnitDetail.tsx` — رفع/تغيير صورة هوية المستأجر | تحديث الهوية | `updated` | `tenant` |
| `src/pages/UnitDetail.tsx` — حذف الوحدة | حذف وحدة | `deleted` | `unit` |
| `src/pages/UnitDetail.tsx` — تحديث الخدمات (utilities) والحالة القانونية | تحديث | `updated` | `unit` |
| `src/pages/Payments.tsx` — حذف إيصال (soft delete) | حذف إيصال الاستلام | `deleted` | `payment` |
| `src/pages/PaymentsTrash.tsx` — استرجاع إيصال | استرجاع | `restored` | `payment` |
| `src/pages/PaymentsTrash.tsx` — حذف نهائي | حذف نهائي | `deleted` | `payment` |

### نصوص الأوصاف (أمثلة)

- تسجيل عقد: `descriptionAr: "تسجيل عقد إيجار جديد للمستأجر {name} — وحدة {unit_number}"`
- تعديل مستأجر: `descriptionAr: "تعديل بيانات المستأجر {name} — وحدة {unit_number}"`
- حذف إيصال: `descriptionAr: "حذف إيصال استلام بقيمة {amount} — {tenant}"`
- استرجاع إيصال: `descriptionAr: "استرجاع إيصال استلام بقيمة {amount}"`
- إنهاء عقد: `descriptionAr: "إنهاء عقد المستأجر {name}"`

### ملاحظات تقنية

- `logActivity` لا تكسر العملية الأصلية (تبتلع الأخطاء)، فقط نستدعيها بعد نجاح العملية (`if (!error)`).
- نمرّر `buildingId` دائمًا حتى يستفيد منه الـ RLS ويتمكن أعضاء المبنى من رؤية النشاط.
- لا حاجة لأي تغيير في قاعدة البيانات أو الـ RLS؛ جدول `activity_log` والـ realtime subscription موجودان ويعملان.
- لا تعديل على بطاقة "آخر النشاطات" نفسها؛ ستظهر التحديثات تلقائيًا بمجرد إدراج الصف.

## النتيجة

كل العمليات الحساسة (عقود، تعديلات، حذف إيصالات) ستظهر فورًا في "آخر النشاطات" على لوحة التحكم وفي صفحة سجل النشاط الكامل.