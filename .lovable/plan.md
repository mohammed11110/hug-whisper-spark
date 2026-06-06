# إصلاح ألوان الصفحات على iOS (والويب)

## السبب الجذري

التحديث `c502fd1` ضبط ملف `src/index.css` و tokens النظام (Midnight + Gold). لكن صفحات وعناصر كثيرة لا تزال تستخدم **أسماء ألوان قديمة مباشرة من الباليت السابق** (`bg-white`, `bg-sage-*`, `bg-slate-*`, `text-white`, `bg-emerald-*`, `bg-burgundy`…). هذه الأسماء **لا تتفاعل مع التبديل بين Light/Dark** ولا مع هوية Midnight Gold، فتظهر باهتة/خاطئة داخل iOS WebView.

## الملفات المتأثرة (≈18 ملف)

**مجموعة "Daily" (الباقة اليومية) — الأكثر تأثراً:**
- `src/pages/daily/DailyDashboard.tsx`
- `src/pages/daily/DailyUnits.tsx`
- `src/pages/daily/DailyBookings.tsx`
- `src/pages/daily/DailyPricing.tsx`
- `src/pages/daily/DailyReports.tsx`
- `src/pages/daily/DailyMessages.tsx`
- `src/pages/daily/DailyCalendar.tsx`
- `src/pages/daily/DailyCleaning.tsx`
- `src/pages/daily/DailyLayout.tsx`

**الصفحات الأساسية:**
- `src/pages/Settings.tsx` (بطاقات subscription + brand)
- `src/pages/Maintenance.tsx` (badges حالة)
- `src/pages/Notifications.tsx`
- `src/pages/Activity.tsx`
- `src/pages/PaymentsTrash.tsx`
- `src/pages/Unsubscribe.tsx`
- `src/pages/UnitDetail.tsx` (badges)

**مكوّنات:**
- `src/components/NotificationBell.tsx`
- `src/components/GraceBanner.tsx`
- `src/components/EndTrialDialog.tsx`
- `src/components/BusinessWhatsAppSection.tsx`
- `src/components/AddPaymentDialog.tsx`
- `src/components/AddMaintenanceDialog.tsx`
- `src/components/FilePreviewDialog.tsx`
- `src/components/UnitHealthBadge.tsx`
- `src/components/dashboard/RecentActivityCard.tsx`

## خريطة الاستبدال

| القديم | الجديد (semantic token) |
|---|---|
| `bg-white` | `bg-card` |
| `bg-sage-50/60`, `bg-sage-100` | `bg-muted` |
| `border-sage-200/*`, `border-sage-300` | `border-border` |
| `text-sage-600`, `text-sage-700` | `text-muted-foreground` / `text-foreground` |
| `bg-sage-400/500/600/700` (أزرار) | `bg-primary text-primary-foreground` |
| `bg-emerald-600/700` | `bg-primary` (أو `bg-success` للحالات الإيجابية) |
| `bg-slate-100/200/300` (badges) | `bg-muted text-muted-foreground` |
| `bg-burgundy text-white` | `bg-destructive text-destructive-foreground` |
| `bg-gold text-white` | `bg-accent text-accent-foreground` |
| `bg-white/15`, `bg-white/25` (داخل بطاقات midnight) | تبقى كما هي — صحيحة فوق سطح midnight |

## ما يبقى كما هو (مقصود)

- **PDF** في `src/lib/pdfDocs.ts` — يبقى بخلفية كريمية + ذهبي داكن + Midnight ink (مطلوب للطباعة).
- **بطاقات Hero/Signature** على سطح midnight (Settings header, Dashboard hero) — `text-white` و `bg-white/15` صحيحان لأنهما فوق midnight ثابت.
- **مكوّنات shadcn/ui** في `src/components/ui/` — لا تُعدّل.

## الخطوات

1. استبدال الكلاسات القديمة بـ semantic tokens في الملفات أعلاه (مرور موحّد).
2. الإبقاء على `text-white` و `bg-white/*` **فقط** داخل أسطح midnight الدائمة (التحقّق سياقياً).
3. تشغيل المعاينة والتأكد بصرياً من:
   - الباقة اليومية بكامل صفحاتها في وضعَي Light/Dark
   - badges الصيانة + التفاصيل
   - الإشعارات + Activity
4. بعد القبول، يقوم المستخدم بـ:
   ```bash
   git pull && npx cap sync ios
   ```
   ثم إعادة بناء التطبيق من Xcode.

## ما لن يتغيّر في هذه المهمة

- الأيقونة الأصلية و LaunchScreen (تتطلّب صور jpg/png تُولَّد بشكل منفصل في طلب آخر).
- منطق الأعمال أو هيكلة قاعدة البيانات.
