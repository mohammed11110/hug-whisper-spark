إضافة عمود **"الشهر / Month"** في جدول الحركات داخل كشف حساب المستأجر.

### التعديلات
1. **`src/lib/pdfDocs.ts`**
   - `StatementRow`: إضافة حقل اختياري `month?: string` (صيغة `YYYY-MM`).
   - `buildTenantStatementHTML`: إضافة عمود رأس `Month / الشهر` وخلية `<td>${row.month || "—"}</td>` كأول عمود بعد التاريخ، وتحديث `colspan` للسطر الفارغ إلى 6.

2. **`src/pages/UnitDetail.tsx` → `exportStatement`**
   - عند بناء `entries`:
     - صف الرصيد الافتتاحي: `month = openingDate.slice(0,7)`.
     - صفوف الإيجار الشهري: `month = monthLbl` (موجود مسبقاً كـ `YYYY-MM`).
     - صفوف الدفعات: `month = (p.period_start || p.payment_date).slice(0,7)`.
   - تمرير `month` ضمن كل عنصر في `rows`.

### النتيجة
يظهر عمود "الشهر" في المعاينة والطباعة وحفظ الـPDF تلقائياً (نفس مسار العرض).

ملفان فقط، بدون تغييرات في قاعدة البيانات.