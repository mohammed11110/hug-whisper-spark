
# مراجعة تصميم الايباد — تقرير + خطة تحسينات

نطاق الفحص: iPad mini (768)، iPad (810)، iPad Air (820)، iPad Pro 11" (834)، iPad Pro 12.9" (1024) — عمودي وأفقي.
الصفحات: لوحة التحكم، المباني، المستأجرين، الدفعات، التقارير، الصيانة، الإيجارات اليومية، الإشعارات، الإعدادات، الفريق، النسخ الاحتياطي، المساعد الذكي.

---

## التقرير: المشاكل المُكتشفة

### 1) الشريط الجانبي يصطدم بالمحتوى على iPad Pro 12.9" (1024 عمودي)
`AppShell` يفتح السايدبار تلقائيًا عند `≥1024px` (256px عرض)، بينما `.mobile-shell` يقفز إلى `max-w-960px` عند `lg`. النتيجة:
256 (سايدبار) + 960 (المحتوى) = **1216px** على شاشة عرضها **1024px** → تجاوز أفقي ونصوص مقصوصة في الوضع العمودي للـ iPad Pro 12.9".

### 2) فجوات جانبية واضحة على iPad mini/Air/Pro 11"
بين `768–1023px` السايدبار مطوي (~48px) و`.mobile-shell` محدود بـ `max-w-720px` → يبقى فراغ ~50px على اليسار يجعل التصميم يبدو "مُحاذى للسايدبار" بدل أن يكون متمركزًا في المنطقة المتاحة. غير أنيق على iPad Air/Pro 11.

### 3) شريط سفلي مخفي لكن المساحة محجوزة (`pb-24`)
كل الصفحات تستخدم `pb-24` (96px) في حين أن `BottomNav` مخفي على `md+`. يعني فراغ سفلي 96px مهدور على كل أحجام الايباد.

### 4) شبكات البطاقات لا تستفيد من العرض على iPad الأفقي
`md:grid-cols-2 lg:grid-cols-3` في صفحات المباني/المستأجرين/الدفعات/الصيانة:
- iPad Pro 11" أفقي (1194): المحتوى داخل shell 960 = عمودين فقط مع وجود مساحة لـ 3.
- iPad Pro 12.9" أفقي (1366) - 256 سايدبار = 1110 متاح، لكن الشبكة 3 أعمدة فقط → لا يوجد breakpoint `xl:grid-cols-4`.

### 5) `TopBar` ازدواجية الهوية مع السايدبار
الـ TopBar يعرض الشعار + اسم التطبيق في الوسط، والسايدبار يعرضهما أيضًا → تكرار بصري على iPad حين يكون السايدبار ظاهرًا. كذلك التمركز يكسر على عرض أكبر.

### 6) الحوارات (Dialogs) صغيرة على الايباد
أغلب الـ Dialogs (`AddPaymentDialog`, `NewTenancyDialog`, إلخ) تستخدم العرض الافتراضي لـ shadcn (~425–512px). على iPad تبدو "ضائعة" في منتصف الشاشة ولا تستخدم المساحة المتاحة لتقليل التمرير الداخلي.

### 7) الـ FAB (زر إضافة دفعة سريع) يتداخل
`QuickAddPaymentFab` مصمَّم لعرض الموبايل (right-bottom) ولا يحسب وجود السايدبار في RTL — قد يلتصق بحافة شاشة الايباد بشكل غير متناسق.

### 8) المنطقة الآمنة لـ iPad
iPad Pro الحديث له home-indicator سفلي. لا يوجد `env(safe-area-inset-bottom)` في الـ headers/footers الداخلية للصفحات (موجود فقط في BottomNav).

### 9) Layout الإيجارات اليومية
`DailyLayout` يعتمد على BottomNav بنفس الأسلوب ولا يقدم تنقّلًا جانبيًا مخصصًا على iPad.

---

## خطة التحسينات (الكود فقط — لا تغيير في المنطق)

### أ. إصلاح تجاوز السايدبار على iPad Pro 12.9" عمودي
- في `AppShell`: تعديل `defaultOpen` ليفتح السايدبار عند `≥1280px` (xl) بدل `≥1024px`، بحيث يبقى مطويًا على iPad Pro 12.9 العمودي.
- بديل: إبقاء العتبة 1024 لكن جعل `.mobile-shell` على `lg` بـ `max-w` ديناميكي يأخذ عرض المتاح فعليًا (`lg:max-w-[calc(100vw-280px)]`).

### ب. ضبط عرض `.mobile-shell` لأحجام الايباد
في `src/index.css`:
- إضافة breakpoint عند `md` (768) → `max-w: 100%` مع `padding-inline` معتدل بدل تقييد 720px، حتى تختفي الفجوة الجانبية ويبقى المحتوى ممتلئًا داخل المنطقة بجانب السايدبار.
- على `lg` (1024) → `max-w: min(100%, 1100px)`.
- على `xl` (1280) → `max-w: 1280px`.

### ج. تقليل الفراغ السفلي على iPad/الديسكتوب
استبدال `pb-24` بـ `pb-24 md:pb-8` في كل الصفحات المعنية (Dashboard, Buildings, Tenants, Payments, Reports, Settings, Maintenance) — لأن `BottomNav` مخفي عند `md+`.

### د. توسيع شبكات البطاقات على iPad الأفقي
إضافة `xl:grid-cols-4` على شبكات Buildings/Tenants/Payments/Maintenance، وكذلك `lg:grid-cols-3` يبقى للـ iPad Pro 12.9 عمودي.

### هـ. تبسيط TopBar على الشاشات الكبيرة
على `md+` (السايدبار ظاهر): إخفاء بلوك "الشعار + اسم التطبيق" الأوسط من TopBar، وإبقاء الوقت يسارًا والإجراءات يمينًا (مع توسيع زر البحث ليكون شريط بحث ظاهر بدل أيقونة).

### و. تكبير الحوارات على الايباد
في كل `DialogContent` المهم: إضافة `md:max-w-2xl lg:max-w-3xl` بدل العرض الافتراضي، مع `max-h-[85vh]` ليتوافق مع نسبة iPad.
الحوارات المستهدفة: `AddPaymentDialog`, `EditPaymentDialog`, `NewTenancyDialog`, `AddBuildingDialog`, `AddUnitDialog`, `EditUnitDialog`, `AddMaintenanceDialog`, `EndTenancyDialog`, `AdjustBalanceDialog`, `SettingsPanel`.

### ز. ضبط `QuickAddPaymentFab` على iPad
- جعل موقعه يحترم عرض السايدبار: `right-6 md:right-10` في LTR، والمعكوس في RTL.
- زيادة `bottom-6` إلى `bottom-8 md:bottom-10` مع `env(safe-area-inset-bottom)`.

### ح. المنطقة الآمنة
إضافة `padding-bottom: env(safe-area-inset-bottom)` لمحتوى الصفحة عبر utility class `.safe-bottom`، وتطبيقه على wrappers الصفحات الرئيسية بدل الاعتماد على BottomNav فقط.

### ط. تحسين `DailyLayout` على iPad
إضافة شريط تبويبات أفقي علوي يظهر على `md+` بدل الاعتماد على BottomNav للتنقل بين Dashboard/Bookings/Calendar/Units/Pricing/Cleaning/Reports/Messages.

---

## الملفات المعدّلة المتوقعة

```
src/index.css                          (mobile-shell breakpoints + .safe-bottom)
src/components/AppShell.tsx            (عتبة فتح السايدبار)
src/components/TopBar.tsx              (إخفاء العنوان المركزي على md+)
src/components/QuickAddPaymentFab.tsx  (موضع iPad + RTL)
src/pages/Dashboard.tsx                (pb-24 md:pb-8)
src/pages/Buildings.tsx                (pb-24 md:pb-8 + xl:grid-cols-4)
src/pages/Tenants.tsx                  (نفس الشيء)
src/pages/Payments.tsx                 (نفس + توسيع الجدول)
src/pages/Reports.tsx                  (pb-24 md:pb-8)
src/pages/Settings.tsx                 (pb-24 md:pb-8)
src/pages/Maintenance.tsx              (pb-24 md:pb-8 + xl:grid-cols-4)
src/pages/daily/DailyLayout.tsx        (شريط تبويبات علوي md:+)
src/components/AddPaymentDialog.tsx    (md:max-w-2xl)
src/components/EditPaymentDialog.tsx   (md:max-w-2xl)
src/components/NewTenancyDialog.tsx    (md:max-w-2xl)
src/components/AddBuildingDialog.tsx   (md:max-w-2xl)
src/components/AddUnitDialog.tsx       (md:max-w-2xl)
src/components/EditUnitDialog.tsx      (md:max-w-2xl)
src/components/AddMaintenanceDialog.tsx (md:max-w-2xl)
src/components/EndTenancyDialog.tsx    (md:max-w-lg)
src/components/AdjustBalanceDialog.tsx (md:max-w-lg)
src/components/SettingsPanel.tsx       (md:max-w-2xl)
```

## النتيجة المتوقعة
- لا تجاوز أفقي على iPad Pro 12.9" عمودي.
- لا فجوات جانبية على iPad mini/Air/Pro 11".
- شبكات تستخدم العرض كاملًا على iPad أفقي (3–4 أعمدة).
- حوارات بحجم مريح يقلل التمرير الداخلي.
- شريط علوي نظيف بدون تكرار للهوية.
- احترام المنطقة الآمنة للـ home-indicator.
- لا تغييرات في منطق العمل، قاعدة البيانات، أو الـ APIs.
