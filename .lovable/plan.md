# إضافة حدود عدد أعضاء الفريق حسب الباقة

## الحدود المقترحة (لكل مالك حساب)

| الباقة | الحد الأقصى للأعضاء (بدون المالك) |
|---|---|
| Free | 0 |
| Personal | 1 |
| Pro | 3 |
| Business | 10 |
| Enterprise | غير محدود |
| Trial | غير محدود (مثل الوحدات) |

العدّ يشمل: أعضاء `building_members` النشطين + الدعوات `invitations` المعلّقة، عبر جميع مباني المالك، مجموعةً بـ `user_id`/`email` فريد لتفادي العدّ المزدوج لنفس الشخص في عدة مبانٍ.

## التغييرات

### 1) قاعدة البيانات (migration)
- دالة `public.get_plan_member_limit(_plan text)` تُرجع الحد.
- دالة `public.user_member_allowance(_user_id uuid)` تُرجع الحد للمالك حسب باقته الفعّالة (trial = ∞).
- دالة `public.user_member_count(_user_id uuid)` تحسب الأعضاء الفريدين + الدعوات المعلّقة عبر مباني المالك.
- Trigger `enforce_member_quota` على `building_members` (BEFORE INSERT) و`invitations` (BEFORE INSERT حين status='pending') يرفع خطأ `member_quota_exceeded` عند التجاوز.

### 2) الواجهة `src/pages/Team.tsx`
- جلب `user_member_allowance` و`user_member_count` عبر RPC وعرض شريط الاستخدام (مثال: «3 / 10 أعضاء»).
- تعطيل زر «إرسال الدعوة» عند بلوغ الحد مع رسالة: «وصلت لحد الباقة. رقّ الباقة لإضافة المزيد».
- التقاط خطأ `member_quota_exceeded` من Supabase وعرض toast واضح.

### 3) صفحة التسعير (اختياري — عرض فقط)
- إضافة سطر «الفريق» في بطاقات الباقات في `src/pages/Pricing.tsx` بالأرقام أعلاه.

## ملاحظات تقنية
- المالك نفسه غير محسوب ضمن الحد.
- الدعوات المعلّقة محسوبة حتى لا يُتجاوز الحد عبر دعوات متعددة.
- لا تعديل على RLS الحالية؛ التحقق يتم عبر triggers SECURITY DEFINER.
- لا تُمسّ بيانات موجودة؛ التحقق على الإدراج فقط.