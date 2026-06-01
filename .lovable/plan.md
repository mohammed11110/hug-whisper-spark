## السبب الجذري
`nextNumber` و`prefix` و`padding` تُحفظ حالياً في `localStorage` لكل جهاز. كل جهاز يحمل نسخته الخاصة، فعند الدخول من جهاز ثانٍ يبدأ من رقمه المحلي القديم → تكرار أو قفز في تسلسل الإيصالات.

## الحل
نقل عدّاد الإيصالات إلى قاعدة البيانات على مستوى المستخدم، مع دالة RPC ذرّية لحجز رقم (أو عدّة أرقام دفعة واحدة عند إنشاء عدّة دفعات في نفس العملية).

## 1) مخطط قاعدة البيانات (Migration)

جدول جديد `public.receipt_counters` (مفتاحه `user_id`):
- `user_id uuid PK references auth.users(id) on delete cascade`
- `prefix text not null default 'R-'`
- `padding int not null default 0`
- `start_number int not null default 1`
- `next_number int not null default 1`
- `updated_at timestamptz default now()`

GRANTs:
```sql
GRANT SELECT, INSERT, UPDATE ON public.receipt_counters TO authenticated;
GRANT ALL ON public.receipt_counters TO service_role;
```

RLS: المستخدم يقرأ/يعدّل صفّه فقط (`user_id = auth.uid()`).

دالة ذرّية:
```sql
create or replace function public.allocate_receipt_numbers(_delta int default 1)
returns table(start_number int, prefix text, padding int)
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _row receipt_counters%rowtype; _start int;
begin
  if _uid is null then raise exception 'not_authenticated'; end if;
  if _delta < 1 then _delta := 1; end if;

  insert into receipt_counters(user_id) values (_uid)
    on conflict (user_id) do nothing;

  -- قفل صفّ المستخدم فقط — لا يحجب باقي المستخدمين
  select * into _row from receipt_counters where user_id = _uid for update;
  _start := _row.next_number;
  update receipt_counters
     set next_number = _row.next_number + _delta, updated_at = now()
   where user_id = _uid;
  return query select _start, _row.prefix, _row.padding;
end $$;

grant execute on function public.allocate_receipt_numbers(int) to authenticated;
```

دالة مساعدة لتحديث الإعدادات (prefix/padding/start_number):
```sql
create or replace function public.update_receipt_settings(
  _prefix text, _padding int, _start_number int, _reset boolean default false
) returns receipt_counters
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _row receipt_counters%rowtype;
begin
  if _uid is null then raise exception 'not_authenticated'; end if;
  insert into receipt_counters(user_id) values (_uid) on conflict do nothing;
  update receipt_counters
     set prefix = coalesce(_prefix, prefix),
         padding = coalesce(_padding, padding),
         start_number = coalesce(_start_number, start_number),
         next_number = case when _reset then coalesce(_start_number, start_number)
                            else next_number end,
         updated_at = now()
   where user_id = _uid
   returning * into _row;
  return _row;
end $$;
grant execute on function public.update_receipt_settings(text,int,int,boolean) to authenticated;
```

## 2) تغييرات الكود

### `src/lib/appSettings.tsx`
- إبقاء `receipt` في `AppSettings` كمرآة (cache) للقيم القادمة من السيرفر فقط (لا مصدر حقيقة).
- استبدال `bumpReceiptNumber`/`resetReceiptNumber` بنسخ async تستدعي RPC `update_receipt_settings`.
- عند تشغيل المزوّد: قراءة `receipt_counters` للمستخدم الحالي ومزامنتها في الـstate.

### `src/lib/receiptNumbering.ts` (ملف جديد بجانب الموجود)
دالة `allocateReceiptNumbers(delta)`:
```ts
const { data } = await supabase.rpc('allocate_receipt_numbers', { _delta: delta });
// data = [{ start_number, prefix, padding }]
```
ترجع `{ startNumber, prefix, padding }`. ومن ثَمّ نولّد الأرقام محلياً: `start_number, start_number+1, ...` باستخدام نفس منطق التنسيق الحالي.

### `src/components/AddPaymentDialog.tsx`
- بدل قراءة `settings.receipt.nextNumber` محلياً ثم استدعاء `bumpReceiptNumber(delta)` بعد النجاح:
  1. حساب `newNumbersNeeded` (نفس المنطق الحالي للحالات A/B في `computeReceiptNumber`).
  2. **قبل** الإدراج: استدعاء `allocateReceiptNumbers(newNumbersNeeded)` لحجز الأرقام ذرّياً.
  3. تمرير المصفوفة المحجوزة إلى `computeReceiptNumber` بدلاً من العدّاد المحلي.
  4. إزالة `bumpReceiptNumber` من نهاية الحفظ.
- إذا فشل الإدراج بعد الحجز: الأرقام تُعتبر مستهلكة (مقبول — مثل ترقيم الفواتير في أي ERP، لا نُعيد استخدامها لتجنّب الالتباس). تنبيه toast بسيط فقط.

### `src/pages/Settings.tsx`
- استبدال التعديلات المحلية على `receipt.prefix/padding/startNumber` باستدعاء `update_receipt_settings` ثم تحديث الـstate من النتيجة.
- زر "إعادة تعيين" يستدعي نفس الدالة مع `_reset = true`.

## 3) الهجرة من البيانات الحالية
عند أول تحميل لأي مستخدم بعد التحديث:
- إذا لم يكن له صفّ في `receipt_counters` → تنفيذ سكربت محلي مرة واحدة:
  - استعلام أعلى رقم إيصال مستخدَم لهذا المستخدم من جدول `payments` (أعلى جزء عددي قبل `/`).
  - `update_receipt_settings(prefix=موجود محلياً, padding, start_number=1, _reset=false)` ثم `update next_number = max+1` عبر RPC منفصلة `seed_receipt_counter(_seed int)`.

سأضيف RPC:
```sql
create or replace function public.seed_receipt_counter(_seed int)
returns void language plpgsql security definer set search_path=public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'not_authenticated'; end if;
  insert into receipt_counters(user_id, next_number) values (_uid, greatest(_seed,1))
    on conflict (user_id) do update
      set next_number = greatest(receipt_counters.next_number, excluded.next_number),
          updated_at = now();
end $$;
grant execute on function public.seed_receipt_counter(int) to authenticated;
```
المنطق في `AppSettingsProvider` عند الإقلاع:
1. جلب الصفّ. إذا `next_number = 1` ولم يكن للمستخدم سجل سابق → نمسح أعلى رقم من `payments` للمستخدم ونستدعي `seed_receipt_counter`.

## 4) خارج النطاق
- لا تغيير على `EditPaymentDialog` ولا على منطق `/1`, `/D`.
- لا تغيير على الإيصالات المطبوعة سابقاً.
- `localStorage` يبقى للأشياء غير الترقيمية (ألوان الحالة، الفلاتر، إلخ).

## النتيجة
- مصدر حقيقة وحيد على السيرفر، لا تعارض بين الأجهزة.
- التخصيص ذرّي حتى لو أُنشئت دفعتان من جهازين في نفس الثانية.
- الأرقام المحجوزة لا تُعاد (سلوك ERP قياسي).
