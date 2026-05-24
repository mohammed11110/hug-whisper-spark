## السبب الجذري

الـ anchor (`opening_balance_date=2026-05-01`) ودوال `balance.ts` كلّها صحيحة وتعطي outstanding = 0 للوحدة B2 #06. لكن صفحتين تستخدمان منطقاً مستقلاً يقارن «شهر التقويم الحالي» بفترة الدفعات دون احترام `rent_timing=arrears` ولا الـ anchor، فيظهر «متبقي إيجار الشهر» وهمي.

## الإصلاحات

### 1) `src/pages/BuildingDetail.tsx` — حساب `monthRemaining`
استبدال المنطق الحالي (سطر 258-270) باستخدام `getNextDueInfo` من `balance.ts`:
- جلب `nextDueDate` و`periodStartIso`/`periodEndIso` للدورة المستحقّة التالية للوحدة.
- حساب `cyclePaid` = مجموع الدفعات التي `period_start` ضمن نافذة الدورة.
- إظهار «متبقي إيجار…» فقط إذا:
  - `today >= nextDueDate` (يعني الدورة فعلاً مستحقّة الآن — للـ arrears لا تظهر قبل نهاية الشهر، وللـ advance تظهر من بدايته)
  - و`cycleRent - cyclePaid > 0`.
- تغيير نصّ السطر ليعكس الدورة الحقيقية: «متبقي من إيجار شهر مايو 2026» بدل «هذا الشهر».

### 2) `src/pages/MonthlyCollection.tsx` — `computeMonthRows`
احترام `rent_timing` و«اليوم الحالي» عند تحديد ما إذا كان الشهر مستحقّاً فعلاً:
- لكل وحدة: حساب `dueDate` للدورة (للـ advance = `cycle.start`، للـ arrears = `cycle.end`).
- إذا `today < dueDate` → لا تُحسب كـ «late»؛ تُعرض كـ «قادمة/upcoming» (status = `upcoming` بدل `unpaid`) أو تُستبعد من قائمة المتأخرين.
- إضافة `upcoming` كحالة جديدة بسيطة في الـ status union، ومنع إدراجها ضمن `lateRowsRaw`.

### 3) `src/components/LastPaymentSection.tsx` — معاينة المتأخرات
التأكّد أنّ الـ preview يستخدم `cyclesDue` (الذي يحترم arrears) — لا يحتاج تعديلاً غالباً، فقط فحص.

### 4) لا تغييرات في `balance.ts`
الدوال صحيحة بالفعل وتُرجع 0 لهذه الحالة. التعديل فقط في طبقة العرض.

## الملفات المتأثّرة
- `src/pages/BuildingDetail.tsx`
- `src/pages/MonthlyCollection.tsx`
- (فحص) `src/components/LastPaymentSection.tsx`

## نتيجة متوقّعة للـ B2 #06 بعد الإصلاح
- صفحة البناية: لا «متبقي إيجار…».
- صفحة التحصيل الشهري لمايو: تظهر كـ «قادمة» (لم تُستحقّ بعد لأنّ المؤخّر يُستحقّ 31/5)، لا كـ متأخّر.
- بقيّة الصفحات (Tenants/Notifications/UnitDetail): تعمل صحيحاً سلفاً (outstanding=0).
