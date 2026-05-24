## الهدف
تحسين تجربة إدخال الفترة المُغطّاة: بعد اختيار تاريخ "من"، يُفتح حقل "إلى" تلقائياً.

## التغييرات

### 1) `LastPaymentSection.tsx` — تحكم خارجي بـ Popover
```
الحالي:  DateField (inline component) → Popover غيْر مُتحكّم بـ open/close
المطلوب: DateField يستقبل { open, onOpenChange } لتتمكّن الأُم من التحكم
```
- تعديل `DateField` ليقبل `open?: boolean` و`onOpenChange?: (boolean) => void`.
- استبدال `<Popover>` بـ `<Popover open={open} onOpenChange={onOpenChange}>`.
- إضافة حالة `openPopover: 'from' | 'to' | null` في `LastPaymentSection`.
- عند تغيّر `periodFrom` (من `undefined` إلى قيمة) والمستخدم لم يلغِ العملية:
  - `setOpenPopover('to')` بعد تأخير 150ms (للسماح بإغلاق "من" أولاً).

### 2) منع القفز غير المرغوب
- إذا كان `periodTo` مملوء مسبقاً، لا تُفتح "إلى" تلقائياً (فقط عند أول إدخال).
- إذا أغلق المستخدم "من" بدون اختيار تاريخ (انقر خارج)، لا يتم القفز.

## الملف الوحيد المتأثر
- `src/components/LastPaymentSection.tsx`

## تفاصيل فنية
- `useEffect` يراقب `periodFrom`: إن تغيّر من `undefined` → `Date` و`!periodTo` → `setTimeout(() => setOpenPopover('to'), 150)`.
- يُنظَّف الـ timeout في `useEffect cleanup`.
- يُمرَّر `open={openPopover === 'from'}` للحقل الأول و`open={openPopover === 'to'}` للثاني.
