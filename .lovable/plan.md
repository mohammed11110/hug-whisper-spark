## الهدف
حل مشكلة عدم حفظ تعديل «الفترة المُغطّاة» في B2#06، وجعل الـ anchor يتحدّث تلقائياً عند تسجيل/تعديل الدفعات.

## التغييرات

### 1) `EditUnitDialog.tsx` — تحميل الفترة من بيانات الوحدة
استبدال `setPeriodFrom(undefined); setPeriodTo(undefined)` بدالة تستنتج الفترة من `opening_balance_date - 1 يوم`:
- `periodTo` = `opening_balance_date - 1`
- `periodFrom` = أول يوم في شهر `periodTo`
- إن لم يكن `opening_balance_date` موجوداً، نُبقي القيمتين `undefined`.

### 2) `NewTenancyDialog.tsx` — نفس التحميل (للاتساق)

### 3) `LastPaymentSection.tsx` — حارس الـ auto-fill
الـ `useEffect` على `[date, rentTiming, enabled]` لا يدوس على قيمة موجودة:
```ts
if (periodFrom || periodTo) return;
```

### 4) `AddPaymentDialog.tsx` — تحديث anchor تلقائياً بعد الإدراج
بعد نجاح `insert` على `payments`:
```ts
await supabase.from("units").update({
  last_paid_date: payment_date,
  opening_balance_date: periodEnd + 1 يوم,
  opening_balance: 0,
}).eq("id", unit_id);
```

### 5) `EditPaymentDialog.tsx` — إعادة حساب anchor بعد التعديل/الحذف
بعد التعديل، نُعيد جلب أحدث دفعة للوحدة (`ORDER BY period_end DESC LIMIT 1` ضمن غير المحذوفة) ونُحدّث الـ anchor منها. إن لم تتبقَّ دفعات، نمسح `opening_balance_date` و`last_paid_date`.

## الملفات المتأثّرة
- `src/components/EditUnitDialog.tsx`
- `src/components/NewTenancyDialog.tsx`
- `src/components/LastPaymentSection.tsx`
- `src/components/AddPaymentDialog.tsx`
- `src/components/EditPaymentDialog.tsx`
