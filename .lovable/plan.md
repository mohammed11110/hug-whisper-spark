# خطة إصلاح شهر/فترة الإيصال

## القاعدة الموحَّدة (تنطبق على كل الوحدات وكل المستأجرين)

اعتماداً على **يوم بداية العقد** (`contract_start_date`):

| الحالة | تسمية الإيصال | `period_start` المخزَّن | `period_end` المخزَّن |
|---|---|---|---|
| البداية = اليوم 1 من الشهر | "إيجار شهر M/YYYY" (شهر كامل) | YYYY-MM-01 | YYYY-MM-(آخر يوم) |
| البداية = أي يوم D ≠ 1 | "الإيجار من D/M/YYYY إلى (D-1)/(M+1)/YYYY" | YYYY-MM-D | (الشهر التالي)-(D-1) |

أمثلة:
- بداية 10/1/2026 → الدورة 1: `10/1/2026 → 9/2/2026`، الدورة 2: `10/2/2026 → 9/3/2026`، وهكذا.
- بداية 15/3/2026 → `15/3/2026 → 14/4/2026`، ثم `15/4/2026 → 14/5/2026`.
- بداية 1/6/2026 → `يونيو 2026` (شهر كامل بدون تجزئة).
- إذا كانت بداية الشهر التالي تتجاوز نهايته (مثل 31 يناير → 30 فبراير غير موجود)، نقصّ على آخر يوم في الشهر التالي.

## التغييرات

### 1) `src/lib/balance.ts` — مصدر الحقيقة الوحيد
- إضافة `parseLocalDate(iso)` لتفادي انزياح التوقيت (بدلاً من `new Date(ISO)` المباشر).
- إضافة `getCycleStartDay(unit)` يعيد يوم البداية من `contract_start_date` (إن غاب يستخدم `due_day` أو 1).
- إضافة `getNextDueCycle(unit, payments, activeTenancyId)` يعيد:
  ```ts
  { periodStart: string, periodEnd: string, label: { ar, en }, isFullMonth: boolean }
  ```
  يحسب الدورة التالية من `paid_up_to` أو من آخر `period_end` لدفعات العقد النشط، أو من `contract_start_date` لأول دورة.
- إضافة `getCycleForPeriodStart(unit, periodStartIso)` لإعادة بناء `period_end` و`label` لأي دورة محددة (للتنقّل يدوياً ولعرض الدفعات القديمة).
- إضافة `formatCycleLabel({periodStart, periodEnd, isFullMonth, lang})` المستخدم في كل الإيصالات والشاشات.

### 2) `src/components/AddPaymentDialog.tsx`
- عند الفتح: جلب العقد النشط ثم `getNextDueCycle(...)` لتعبئة الفترة الافتراضية (بدل `new Date()`).
- السماح بالتنقّل للأمام/الخلف عبر `getCycleForPeriodStart` بدورة كاملة (شهر) — وليس بتعديل السنة/الشهر يدوياً.
- منع اختيار دورة قبل `contract_start_date` أو قبل `paid_up_to`.
- عند الحفظ: تخزين `period_start` و`period_end` المحسوبَين من نفس الدالة (لا من اختيار سنة/شهر منفصل).
- معاينة الإيصال تستخدم `formatCycleLabel`.

### 3) `src/components/EditPaymentDialog.tsx`
- استبدال `new Date(periodStart)` بـ `parseLocalDate` ثم `formatCycleLabel({periodStart, periodEnd, isFullMonth: day===1, lang})`.
- لا تغيير على حقول الفترة (تبقى للقراءة فقط كما هي اليوم).

### 4) قوالب الإيصال والعرض
- مراجعة كل مكان يطبع شهر الإيجار (شاشة الدفعات، الإيصال PDF، الإشعارات) واستبداله بـ `formatCycleLabel` بناءً على `period_start`/`period_end` المخزَّن. لا يُشتق الشهر من `payment_date` أو `created_at` أبداً.

### 5) اختبارات تلقائية (`src/test/balance-arrears.test.ts`)
- بداية 10/1/2026 → الدورات الست الأولى صحيحة بنصّ "10/1 → 9/2"… إلخ.
- بداية 1/6/2026 → "يونيو 2026" (شهر كامل).
- بداية 15/3/2026 → "15/3 → 14/4".
- بداية 31/1/2026 → الدورة التالية تنتهي 28/2 (قصّ آمن).
- تسجيل اليوم 31/5/2026 لعقد 1/6/2026 → الافتراضي يونيو 2026 وليس مايو.

### 6) تعميم
- لا تعديل قاعدة بيانات.
- التغيير في طبقة الحساب + الـ Dialogs + الإيصال فقط، فينطبق فوراً على **كل الوحدات وكل المستأجرين وكل الأشهر والسنوات الماضية والمستقبلية**.
- مصدر واحد (`getNextDueCycle` + `formatCycleLabel`) يمنع تعارض الإيصال مع البيانات المحفوظة.

## ملفات ستُعدَّل
- `src/lib/balance.ts` (إضافات فقط، لا حذف للسلوك القديم)
- `src/components/AddPaymentDialog.tsx`
- `src/components/EditPaymentDialog.tsx`
- أي ملف يطبع شهر الإيصال (سيُحدَّد عند الفحص: قائمة `Payments.tsx`، `UnitDetail.tsx`، مولّد PDF إن وُجد)
- `src/test/balance-arrears.test.ts`
