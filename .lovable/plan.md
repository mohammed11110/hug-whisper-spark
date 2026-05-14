# خطة: تصميم آيباد كامل لتطبيق أملاكي

## الهدف
الاستفادة من شاشة الآيباد الكاملة بتخطيط جانبي (Sidebar + محتوى رئيسي) بدلاً من عرض الأيفون الضيق، مع الحفاظ على التصميم الحالي للأيفون كما هو.

## المبدأ العام

```
الأيفون (< 768px)         الآيباد (≥ 768px)
┌──────────────┐          ┌──────┬──────────────────┐
│   TopBar     │          │      │     TopBar       │
├──────────────┤          │ Side ├──────────────────┤
│              │          │ bar  │                  │
│   Content    │          │      │    Content       │
│              │          │ Nav  │    (wider)       │
├──────────────┤          │      │                  │
│  BottomNav   │          │      │                  │
└──────────────┘          └──────┴──────────────────┘
```

- نقطة التحول: `md` (768px) — يطابق iPad mini وأكبر
- على الآيباد: إخفاء `BottomNav`، إظهار `Sidebar` قابل للطي
- على الأيفون: لا تغيير (BottomNav كما هو)

## الخطوات

### 1. إنشاء `AppSidebar` جديد
- ملف: `src/components/AppSidebar.tsx`
- استخدام shadcn `Sidebar` مع `collapsible="icon"`
- نفس روابط `BottomNav` الحالية + روابط إضافية (الإعدادات، النسخ الاحتياطي، الفريق، التقارير، المساعد الذكي)
- تجميعها في مجموعات: الرئيسية، الإدارة، الأدوات
- إبراز المسار النشط عبر `NavLink` + `useLocation`
- دعم RTL/LTR (الشريط على اليمين في العربية)

### 2. تعديل `App.tsx` لتغليف التطبيق بـ `SidebarProvider`
- إضافة `SidebarProvider` حول التخطيط
- عرض `AppSidebar` فقط على `md+` عبر `hidden md:block`
- `SidebarTrigger` في `TopBar` يظهر فقط على `md+`

### 3. تعديل `BottomNav.tsx`
- إخفاء على `md+` عبر `md:hidden`
- لا تغيير في السلوك على الأيفون

### 4. تعديل `TopBar.tsx`
- إضافة `SidebarTrigger` (يظهر `md:flex` فقط)
- تعديل padding/الـ container للاستفادة من العرض الكامل على الآيباد

### 5. تحسينات تخطيط الصفحات الرئيسية للآيباد
الصفحات التي تستفيد فعلياً من العرض الواسع:

- **Dashboard** — شبكة بطاقات: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Buildings** — شبكة بطاقات المباني `md:grid-cols-2 lg:grid-cols-3`
- **Tenants / Payments / MonthlyCollection** — جداول بعرض كامل + أعمدة إضافية مرئية على الآيباد
- **BuildingDetail / UnitDetail** — تخطيط عمودين: تفاصيل + قائمة الوحدات/المدفوعات جنباً إلى جنب
- **Reports** — رسوم بيانية أكبر، شبكة `md:grid-cols-2`
- **Settings** — `md:grid-cols-2` لأقسام الإعدادات

الصفحات الأخرى (Auth, ForgotPassword, Welcome, Pricing, Privacy, Terms…): تبقى بحاوية مركزة محدودة العرض (لا تحتاج تعديل).

### 6. تعديل `capacitor.config.ts` و iOS settings
- ضبط `Device Orientation` لدعم `Portrait + Landscape` على الآيباد
- التأكد من `Requires Full Screen = false` للسماح بـ Split View
- إضافة `Status bar` إعدادات مناسبة للآيباد

### 7. اختبار responsive
- التحقق من نقاط التحول 768px / 1024px / 1366px
- التأكد من RTL يعمل بشكل صحيح (Sidebar على اليمين)
- التحقق من عدم انكسار الـ Dialogs والـ Sheets

## التفاصيل التقنية

- مكتبة Sidebar: `@/components/ui/sidebar` (موجودة بالفعل)
- نقطة التحول الأساسية: Tailwind `md:` (768px)
- جميع الصفحات تستخدم `<TopBar />` و `<BottomNav />` حالياً، لذا التغيير مركزي
- الحفاظ على جميع semantic tokens من `index.css` (لا ألوان مباشرة)
- لا تغييرات على Backend / Database / Auth / business logic

## ما لن يتغير
- الأيفون: تجربة المستخدم تبقى 100% كما هي
- Backend, RLS, edge functions, الترجمات، حسابات الإيجار
- مكونات الـ Dialogs الحالية

## الناتج النهائي
- على iPhone: نفس التطبيق الحالي تماماً
- على iPad (Portrait + Landscape): شريط جانبي + محتوى يستغل كامل الشاشة + شبكات أوسع + جداول أكثر معلومات
