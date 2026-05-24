# إصلاح احتساب المتأخرات (off-by-one في وضعَي المقدّم والمؤخّر)

## المشكلة المُثبتة
الدالة `periodsElapsed` في `src/lib/balance.ts` تُرجع عدد "الذكريات المنقضية" منذ المرساة، وهذا لا يطابق "عدد الدورات المستحقة الدفع":

- **مقدّم (advance)**: دورة 1 تبدأ عند المرساة نفسها وإيجارها مستحق فور `now ≥ anchor`. الكود الحالي يَعُدّ 0 عند المرساة → نقص دورة واحدة دائماً.
- **مؤخّر (arrears)**: دورة 1 تنتهي بعد شهر وإيجارها مستحق عند نهايتها. الكود يَطرح 1 إضافية → نقص دورة واحدة دائماً.

تحقّق على B2/#4 و B2/#8 (anchor 1/4/2026، إيجار 80، مؤخّر، لا مدفوعات): النظام يُظهر **0** والصحيح **80** بتاريخ 24/5/2026.

## الإصلاح

### `src/lib/balance.ts`
إضافة دالة جديدة `cyclesDue(unit, asOf)` تُرجع عدد الدورات المستحقة فعلياً:

```ts
function cyclesDue(unit, asOf): number {
  const anchor = getAnchorDate(unit); if (!anchor || asOf < anchor) return 0;
  const elapsed = periodsElapsed(anchor, asOf, unit.rent_type || "monthly");
  const timing = (unit.rent_timing || "advance") === "arrears" ? "arrears" : "advance";
  // advance: دورة المرساة + كل ذكرى منقضية بعدها = elapsed + 1
  // arrears: كل دورة كاملة منقضية = elapsed
  return timing === "advance" ? elapsed + 1 : elapsed;
}
```

ثم تعديل كل من:
- `computeBalance` → `periods = cyclesDue(unit, now)` بدل المنطق الحالي.
- `overdueCyclesCount` → نفس الشيء.
- `getNextDueInfo` → `dueIdx = max(paidCycles, cyclesDue(unit, now))` (مع تبسيط منطق advance/arrears لأن الإزاحة باتت داخل `cyclesDue`).

### عدم الكسر في باقي الشاشات
الملفات التي تستهلك هذه الدوال (`UnitDetail`, `BuildingDetail`, `MonthlyCollection`, `Payments`, `Notifications`, `Tenants`, `EndTenancyDialog`, `AddPaymentDialog`) لا تحتاج تعديل — تستدعي الدوال نفسها وستتلقّى القيم الصحيحة تلقائياً.

### حالة حدّية: `last_paid_date` و opening
لا تغيير على دلالة `opening_balance_date` (يبقى "مُسوّى حتى هذا التاريخ"). البيانات الموجودة لا تتأثر — فقط حساب المتأخرات يُصحَّح.

## التحقّق المتوقّع بعد الإصلاح (24/5/2026)

| الوحدة | النمط | anchor | متوقّع |
|---|---|---|---|
| B2/#4 | مؤخّر | 1/4/2026 | **80 ر.ع** (دورة أبريل) |
| B2/#8 | مؤخّر | 1/4/2026 | **80 ر.ع** (دورة أبريل) |

لا تغيير في قاعدة البيانات.
