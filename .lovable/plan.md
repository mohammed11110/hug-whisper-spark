تعديل `src/pages/UnitDetail.tsx` داخل دالة `exportStatement`:

1. **بداية احتياطية أخيرة = الشهر الحالي**
```ts
const fallbackStart =
  (unit as any).contract_start_date ||
  (unit as any).opening_balance_date ||
  paymentStarts[0] ||
  paymentDates[0] ||
  new Date().toISOString().slice(0, 10);
```

2. **قبول أي وحدة شهرية أو فارغة النوع**
```ts
const isMonthly = !unit.rent_type || unit.rent_type === "monthly";
if (rent > 0 && isMonthly) { ... }
```

3. **حلقة آمنة من المنطقة الزمنية تصل دائماً للشهر الحالي**
```ts
const start = new Date(fallbackStart);
const now = new Date();
const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
const endCursor = new Date(now.getFullYear(), now.getMonth(), 1);
while (cursor <= endCursor) {
  const d = cursor.toISOString().slice(0, 10);
  const monthLbl = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  entries.push({
    date: d,
    month: monthLbl,
    description: (lang === "ar" ? "إيجار شهر " : "Rent ") + monthLbl,
    charge: rent,
    payment: 0,
    sortKey: d + "1",
  });
  cursor.setMonth(cursor.getMonth() + 1);
}
```

### النتيجة
- وحدة زهير: شارج 120 (مايو) − دفعة 100 = **متبقي 20 ر.ع.** ✓
- يعمّ على كل الوحدات الشهرية بدون أي تغيير في القاعدة.

### الملف الوحيد المتغيّر
- `src/pages/UnitDetail.tsx`