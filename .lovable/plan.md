
## الوضع الحالي

التطبيق مصمَّم موبايل-أولاً وكل الصفحات تستخدم `mobile-shell` بعرض ثابت **430px**. حتى على شاشات اللابتوب يظهر شريط ضيق في المنتصف.

ما هو موجود فعلاً:
- ✅ `AppShell` يعرض شريط جانبي (Sidebar) على md+.
- ✅ `BottomNav` مخفي تلقائياً على md+ (`md:hidden`).
- ❌ `.mobile-shell { max-width: 430px }` يخنق المحتوى على جميع الشاشات.
- ❌ الشبكات (cards) عمود واحد دائماً — لا تستفيد من العرض.
- ❌ الـ Dialogs و الـ TopBar مُصمَّمة لعرض 430px.

## الخطة

### 1. توسعة `mobile-shell` (`src/index.css`)
```css
.mobile-shell {
  @apply mx-auto bg-background min-h-screen relative;
  max-width: 430px;           /* phone */
}
@media (min-width: 768px) {   /* iPad portrait+ */
  .mobile-shell { max-width: 720px; box-shadow: none; }
}
@media (min-width: 1024px) {  /* iPad landscape / laptop */
  .mobile-shell { max-width: 960px; }
}
@media (min-width: 1280px) {  /* desktop */
  .mobile-shell { max-width: 1200px; }
}
```
+ زيادة الحشوات الجانبية (`md:px-8 lg:px-12`) في الصفحات الرئيسية.

### 2. شبكات متجاوبة في الصفحات الأساسية
في `Dashboard`, `Buildings`, `Tenants`, `Payments`, `Maintenance`, `BuildingExpenses`, `MonthlyCollection`, `Reports`, `Activity`, `Settings`:
- بطاقات: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`.
- صفوف KPI في Dashboard: `md:grid-cols-4` بدل عمودين.
- جداول/قوائم طويلة: عرض جدولي (`<table>`) على md+ بدلاً من بطاقات مكدّسة.

### 3. TopBar و Dialogs
- `TopBar`: padding أفقي يتسع على md+، إخفاء بعض الأيقونات المكرّرة مع وجود السايدبار.
- Dialogs (`AddBuilding`, `AddUnit`, `AddPayment`, `NewTenancy`, `AddMaintenance`…): رفع `max-w-md` إلى `md:max-w-lg lg:max-w-2xl`، عمودين للحقول على md+.

### 4. السايدبار والـ AppShell
- فتح السايدبار افتراضياً على lg+ (`defaultOpen={isLg}`).
- إضافة زر toggle ظاهر في TopBar على md+.
- إخفاء `mobile-shell` shadow عندما السايدبار مفتوح (يبدو غريباً).

### 5. صفحات خاصة
- `Welcome` / `Auth` / `Pricing`: تخطيط split-screen على lg+ (نموذج يمين، عرض تسويقي يسار).
- `BuildingDetail` / `UnitDetail`: عمودين على lg+ (تفاصيل + جانب جانبي للإجراءات).
- `Assistant`: تكبير منطقة الدردشة، رسائل بعرض أكبر.

### 6. الطباعة والـ PDF
لا تغيير — الـ PDFs تستخدم `pdfDocs.ts` المستقل.

### 7. اختبار
- تجربة على 4 مقاسات: 390px (iPhone)، 820px (iPad portrait)، 1180px (iPad landscape)، 1440px (laptop).
- التأكد من RTL على كل المقاسات.
- لقطات شاشة قبل/بعد للصفحات الأساسية.

## النطاق
هذا تحديث متوسط الحجم يلمس ~15-20 ملف. لن يغيّر أي منطق أعمال أو قاعدة بيانات.

## ترتيب التنفيذ المقترح
1. (5 دقائق) تحديث `mobile-shell` + `AppShell` — أكبر أثر بأقل تغيير.
2. Dashboard + Buildings + Tenants (الأكثر استخداماً).
3. Payments + Maintenance + Expenses + Collection.
4. Dialogs.
5. صفحات خاصة (Welcome/Auth/Pricing).

هل أبدأ بالخطوة 1 و 2 الآن، أم تريد تنفيذ كل المراحل دفعة واحدة؟
