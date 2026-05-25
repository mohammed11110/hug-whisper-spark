
# مراجعة شاملة — تعارضات الموقع ومقترحات الحذف/التعديل

نتائج فحص الملفات الرئيسية (App.tsx, balance.ts, AddPaymentDialog, EditPaymentDialog, AddUnitDialog, NewTenancyDialog, EditUnitDialog, LastPaymentSection, UnitDetail, Tenants, Payments, Notifications, Reports, i18n.tsx, i18n2.tsx). موزَّعة على الأولويات الأربع.

---

## 1) كود ميت — يجب حذفه

| الملف | السبب | الإجراء |
|---|---|---|
| `src/pages/Placeholder.tsx` | غير مستورد في `App.tsx` ولا أي مكوّن | حذف الملف |
| `src/pages/Index.tsx` | يُعرَّف فيه `PlaceholderIndex` فقط ولا يُستورد من أي مكان (المسار `/` يستخدم `Dashboard`) | حذف الملف |
| `src/pages/Welcome.tsx` | مستورد لكن لا يبدو معروضاً (المسار `/welcome` موجود — تحقّق إن كان مستخدماً فعلاً قبل الحذف) | إبقاء — لا حذف |
| داخل `src/components/EditPaymentDialog.tsx` (سطور ≈27–55، 168–218) | `yearOptions()`, `paidMonthsKeys`, `setPaidMonthsKeys`, Select سنة/شهر يدوي — تعارض مع قرار «حذف الاختيار اليدوي للسنوات والأشهر» الذي طُبّق في `AddPaymentDialog` فقط | حذف منطق الاختيار اليدوي للسنة/الشهر واستبداله بعرض ثابت للدورة المرتبطة بالدفعة (مثل ما فعلنا في `AddPaymentDialog`) |
| `src/components/AddPaymentDialog.tsx` — مفاتيح `showArrearsList`, `setShowArrearsList`, زر «عرض/إخفاء التفاصيل» (سطور ≈832–850) | بدائي ومكرّر مع لوحة «توزيع الدفعة» الذكية الجديدة | حذف الزر وإبقاء قائمة المتأخرات مفتوحة افتراضياً عند وجود > 0 |
| تعليق ميت في `src/lib/balance.ts` (سطور 81–84) عن `computeBalance` الذي حُذف | تعليق لم يعد ضرورياً | حذف التعليق |
| `src/components/AddPaymentDialog.tsx` — جدول `Quick-fill chips` بزر «= متبقي الأقدم» (سطور ≈963–971) | يكرّر سلوك «اختيار يدوي» الذي يحدّد تلقائياً الأقدم ويملأ المبلغ | حذف هذا الزر فقط، والإبقاء على «كامل المتأخرات» و«إيجار شهر» |

---

## 2) تعارض منطق الأعمال

### 2.1 `EditPaymentDialog` ينتهك «المتأخرات = مصدر واحد»
- يسمح للمستخدم بتغيير `period_year`/`period_month` يدوياً لأي دفعة قديمة → يفصل الدفعة عن دورتها الأصلية ويُربك `getUnitArrears()` (الذي يربط الدفعات بـ `period_start` داخل نطاق الدورة).
- **الحل:** قفل حقل الفترة على القيمة الأصلية للدفعة. إن أراد المستخدم نقل الدفعة لدورة أخرى، يحذفها ويُسجّلها من جديد. السماح فقط بتعديل: المبلغ، التاريخ، الطريقة، رقم الإيصال، الملاحظات.

### 2.2 `Notifications.tsx` و `Payments.tsx` و `Reports.tsx` يعتمدون `unit.status === "late"`
- ما زال هناك حقل قاعدي `status = "late"` يُستخدم للفلترة، بينما المصدر الحقيقي للحقيقة الآن هو `getUnitArrears().totalShortfall > 0`.
- **الحل:** توحيد الفلترة على `overdueCyclesCount()/totalShortfall` من `balance.ts` (يُحسب من الدفعات لحظياً) بدل الاعتماد على عمود `status` الذي قد لا يكون متزامناً. الاحتفاظ بـ `status` كحقل عرض فقط (يُحدَّث تلقائياً من تريغر/جوب)، أو حذف الفلترة المعتمدة عليه واستبدالها بحساب لحظي.

### 2.3 `Reports.tsx` (سطر 321) يستخدم «متأخرات» كعنوان لعدّ الوحدات `status === "late"`
- مزج بين «عدد وحدات متأخرة» و«إجمالي مبلغ المتأخرات» — مفهومان مختلفان بنفس الاسم.
- **الحل:** تسميتان منفصلتان: «وحدات متأخرة» (عدد) و«إجمالي المتأخرات» (مبلغ، من `Σ totalShortfall`).

### 2.4 `EndTenancyDialog` يُصفّر `opening_balance = 0` و `opening_balance_date = null` (سطور 94–95)
- يُلغي تاريخ المرسى للوحدة عند إنهاء العقد → عند تسجيل مستأجر جديد سيُحسب من `contract_start_date` مع `opening_balance` جديد، وهذا سليم.
- **لكن:** إذا كان خيار «ترحيل المتأخرات» مفعّلاً، يُفقد سجل المبلغ المرحَّل. يجب نقل المبلغ إلى ملاحظة دائمة أو جدول `arrears_carried` قبل التصفير.

### 2.5 `EditUnitDialog` يكشف `opening_balance` في الـ interface (سطر 38) رغم منع تعديله من الواجهة
- ليس خطراً، لكن يضلّل قارئ الكود.
- **الحل:** إزالة الحقل من الـ interface ومن أي حقل نموذجي إن لم يُستخدم.

---

## 3) تكرار/تعارض المصطلحات في الواجهة

### 3.1 `i18n.tsx` و `i18n2.tsx` يحملان مفاتيح مكرَّرة لنفس المعنى
- `i18n.tsx:101 overdue` (متأخر) و `i18n2.tsx:123 late` (متأخر) — مفتاحان مختلفان بنفس الترجمة.
- `i18n2.tsx:175 days_overdue` و `i18n.tsx:overdue` — متشابهان.
- **الحل:** ترحيل كل مفاتيح المتأخرات إلى `i18n2.tsx` فقط، ثم تقليص `i18n.tsx` إلى مزوّد اللغة (`lang/dir/setLang`) دون قاموس مكرَّر. (تغيير كبير — نفّذ على مرحلتين: مرحلة 1 توحيد المفاتيح، مرحلة 2 حذف القاموس القديم.)

### 3.2 مفاتيح `settle_debt` / `carry_debt` في `i18n2.tsx` (سطور 33, 201–202)
- الاسم يحتوي على `debt` بينما القيمة المعروضة «المتأخرات» — تعارض بين اسم المفتاح والمحتوى.
- **الحل:** إعادة تسمية إلى `settle_arrears` / `carry_arrears` وتحديث `EndTenancyDialog`.

### 3.3 `outstanding_balance` (i18n2:159) و `arrears` (i18n2:154) و `total_due` (i18n2)
- ثلاث ترجمات قريبة المعنى تظهر في أماكن مختلفة.
- **الحل:** اعتماد «المتأخرات» مصطلحاً وحيداً للعرض، وحصر `outstanding_balance` في تقارير التدفق المالي فقط (حيث يعني فعلاً «الرصيد المستحق غير المُحصَّل»، وليس «المتأخرات»).

### 3.4 `Payments.tsx` يستخدم سلاسل عربية ثابتة (سطر 59) بدل `t2`
- `paid: "مدفوع", late: "متأخر"` — كسر لمنطق الترجمة.
- **الحل:** استبدالها بـ `t2("paid")` و `t2("late")`.

---

## 4) تعارض UX

### 4.1 ثلاثة طرق لتسجيل المتأخرات الافتتاحية
- (أ) `AddUnitDialog`: حقل «المتأخرات» مع توزيع تلقائي على الأشهر — **هذا هو المعتمد**.
- (ب) `NewTenancyDialog`: يستخدم `LastPaymentSection` (إدخال «آخر دفعة» يدوياً) — منطق مختلف.
- (ج) قاعدياً: عمودا `opening_balance` و `opening_balance_date` ما زالا يقبلان أي قيمة من أي مصدر.
- **الحل:** توحيد `NewTenancyDialog` ليستخدم نفس حقل «المتأخرات» + التوزيع التلقائي الذي في `AddUnitDialog`، وإزالة `LastPaymentSection` (يصبح كوداً ميتاً → حذف الملف).

### 4.2 زرّان لنفس الفعل في `AddPaymentDialog`
- «توزيع تلقائي» (سطر 819) يضع `amount = arrearsBefore` ثم يوزّعها = أمر صريح.
- زر سريع «= كامل المتأخرات» (سطر 948) يفعل نفس الشيء بصمت.
- **الحل:** حذف زر «= كامل المتأخرات» — يكفي زرّ الوضع.

### 4.3 ازدواج «تحصيل المتأخرات السابقة» مع «التوزيع التلقائي»
- خانة `collectPriorArrears` (سطر 1042) تظهر في الوضع اليدوي فقط، لكن التوزيع التلقائي يفعل نفس الشيء.
- **الحل:** الإبقاء على الخانة في الوضع اليدوي فقط (السلوك الحالي صحيح)، وإضافة سطر توضيحي صغير: «للتحصيل التلقائي بدّل إلى وضع التوزيع التلقائي».

### 4.4 `Tenants.tsx` فلتر «overdue» يستخدم `kpis.overdue` 
- جيد، لكن العدّاد يأتي من `unit.status === "late"` لا من `totalShortfall` — نفس مشكلة 2.2.

### 4.5 شريط الحالة في `UnitDetail` و `Payments` و `BuildingDetail` لا يميّز «جزئي» 
- وحدة دفعت 50% تظهر إما «متأخر» أو «مدفوع» — لا حالة وسط.
- **الحل:** إضافة حالة عرض ثالثة «قيد التحصيل» (partial) عندما تكون هناك دورة بـ `status === "partial"` في `arrears.cycles` (لون terracotta بدلاً من burgundy).

---

## خطة التنفيذ (4 جولات صغيرة)

### الجولة 1 — حذف الكود الميت (آمن، بلا أثر سلوكي)
1. حذف `src/pages/Placeholder.tsx` و `src/pages/Index.tsx`.
2. حذف زر «عرض/إخفاء التفاصيل» في `AddPaymentDialog` (والحالة `showArrearsList`).
3. حذف زر «= متبقي الأقدم» من Quick-fill chips في `AddPaymentDialog`.
4. حذف زر «= كامل المتأخرات» (مكرّر مع وضع التوزيع التلقائي).
5. حذف التعليق الميت في `balance.ts` سطر 81–84.
6. حذف الحقل غير المستخدم `opening_balance` من interface `EditUnitDialog`.

### الجولة 2 — إصلاح `EditPaymentDialog`
1. حذف `yearOptions`, `paidMonthsKeys`, Select سنة/شهر يدوي.
2. عرض فترة الدفعة كقراءة-فقط (label واحد).
3. السماح فقط بتعديل: المبلغ، التاريخ، الطريقة، رقم الإيصال، الملاحظات.

### الجولة 3 — توحيد المصطلحات
1. إعادة تسمية مفاتيح i18n: `settle_debt → settle_arrears`, `carry_debt → carry_arrears`. تحديث `EndTenancyDialog` و i18n2.
2. استبدال السلاسل العربية الثابتة في `Payments.tsx` بـ `t2`.
3. مراجعة `Reports.tsx` لتمييز «وحدات متأخرة» (عدد) عن «إجمالي المتأخرات» (مبلغ).

### الجولة 4 — توحيد إدخال المتأخرات وحالة العرض الجزئية
1. توحيد `NewTenancyDialog` ليستخدم نفس حقل «المتأخرات» + التوزيع التلقائي الذي في `AddUnitDialog`.
2. حذف `src/components/LastPaymentSection.tsx` (يصبح ميتاً).
3. اعتماد `getUnitArrears().totalShortfall` كمصدر وحيد للفلترة في `Notifications`/`Payments`/`Reports`/`Tenants` بدل `unit.status === "late"`.
4. إضافة حالة عرض «قيد التحصيل» (partial) في `UnitDetail` و `Payments` و `BuildingDetail`.

---

## مقترحات إضافية للتحسين

1. **تحويل `opening_balance`/`opening_balance_date` إلى قراءة-فقط على مستوى قاعدة البيانات** (سياسة RLS أو تريغر يمنع التعديل بعد التسجيل) — يضمن المصدر الواحد للحقيقة.
2. **سجل تدقيق (`audit_log`)** يلتقط أي تعديل على المتأخرات يدوياً (وقت التسجيل) — مفيد عند التحقّق مع المالك.
3. **مؤشّر «صحة الحساب»** في `UnitDetail`: تنبيه إذا اكتشف النظام عدم تطابق بين الدفعات و `opening_balance` (مثلاً دفعة بنطاق يوم واحد متطابقة مع بداية دورة شهرية).
4. **تصدير CSV موحَّد لكل دورة**: تاريخ، إيجار، مدفوع، نقص، حالة — يسهّل المراجعة الخارجية.
5. **ربط `EditPaymentDialog` بإعادة احتساب فورية لـ `getUnitArrears()`** بعد الحفظ لإغلاق أي فجوة بصرية.

---

## ملفات ستتأثَّر

**تُحذف:** `src/pages/Placeholder.tsx`, `src/pages/Index.tsx`, (لاحقاً) `src/components/LastPaymentSection.tsx`.

**تُعدَّل:** `src/components/AddPaymentDialog.tsx`, `src/components/EditPaymentDialog.tsx`, `src/components/EditUnitDialog.tsx`, `src/components/NewTenancyDialog.tsx`, `src/components/EndTenancyDialog.tsx`, `src/lib/balance.ts`, `src/lib/i18n2.tsx`, `src/pages/Payments.tsx`, `src/pages/Notifications.tsx`, `src/pages/Reports.tsx`, `src/pages/Tenants.tsx`, `src/pages/UnitDetail.tsx`.

---

**هل أبدأ بالجولة 1 (الحذف الآمن)، أم تريد تنفيذ كل الجولات الأربع دفعة واحدة؟ وأي من المقترحات الخمسة الإضافية تريد تضمينها؟**
