# تقرير فحص التعارضات — أملاكي

فحصت الكود الأمامي (`src/`) ومايجرشنات قاعدة البيانات (`supabase/migrations/`). فيما يلي التعارضات الحقيقية التي قد تؤثر على الاستخدام، مرتبة من الأخطر للأقل.

---

## 🔴 تعارضات تؤثر على المستخدم

### 1. كتابة `units.status` يدوياً يتعارض مع الـ trigger
**الموقع:**
- `src/components/AddUnitDialog.tsx:107` → يكتب `status: occupied ? "soon" : "vacant"`
- `src/components/AddBuildingDialog.tsx:60` → يكتب `status: "vacant"`
- `src/components/NewTenancyDialog.tsx:174,197` → يكتب `"active"`/`"soon"`
- `src/components/EndTenancyDialog.tsx:89,154` → يكتب `"ended"`/`"vacant"`

**التعارض:** في قاعدة البيانات هناك دالة `recompute_unit_state` + trigger `sync_unit_state_from_payments` يحسبان الـ`status` تلقائياً من الدفعات والعقد. أي قيمة يرسلها الواجهة تُستبدل لحظة إدخال أول دفعة. المستخدم يرى الحالة تتغير دون سبب واضح بعد ثوانٍ من الإضافة.

**الحل:** حذف حقل `status` من كل عمليات الـinsert/update في الكود — اترك القاعدة تحسبه. (الكود حتى يحتوي تعليق `// Status is derived... never write it` في `AddUnitDialog:151` لكنه يكتبه فعلياً في السطر 107).

---

### 2. `useSubscription` لا يستبعد صفوف الإضافات
**الموقع:** `src/hooks/useSubscription.ts:96-104`

**التعارض:** الاستعلام يأخذ أحدث صف من `subscriptions` ثم يحوّل `product_id` إلى خطة. لكن دالة القاعدة `user_active_plan` تستبعد المنتجات التي تنتهي بـ `_addon`. النتيجة: إن اشترى المستخدم إضافة وحدات بعد اشتراك Pro، الواجهة قد تعرض `free` لأن صف الإضافة هو الأحدث، بينما RLS وحدود الوحدات في القاعدة تعتبره Pro. تضارب مباشر بين ما يراه المستخدم وما تسمح به القاعدة.

**الحل:** إضافة `.not("product_id", "like", "%_addon")` للاستعلام، أو الاعتماد على RPC `user_active_plan` بدلاً من حساب الخطة في الواجهة.

---

### 3. قنوات Realtime ثابتة الاسم — تتعارض عند فتح تبويبين
**الموقع:**
- `src/components/ActivityNotifier.tsx:20` → `"activity_log_global"`
- `src/components/dashboard/RecentActivityCard.tsx:57` → `"activity_log_dash"`
- `src/pages/Activity.tsx:58` → `"activity_log_page"`

**التعارض:** Supabase Realtime لا يسمح بقناتين بنفس الاسم من نفس العميل. فتح صفحة Dashboard في تبويبين، أو فتح Dashboard وActivity معاً، يجعل الاشتراك الثاني يفشل صامتاً ولا تصل الإشعارات الفورية.

**الحل:** ضمّ معرف فريد للقناة: `` `activity_log_dash:${user.id}:${crypto.randomUUID()}` `` (أو فقط `user.id` إن أردت قناة لكل مستخدم).

---

### 4. `profiles.subscription_plan` مصدر مكرر للحقيقة
**التعارض:** بعد إصلاحات الجلسة السابقة أصبحنا نزامن `profiles.subscription_plan` من `subscriptions`. لكنه يبقى عموداً مكرراً قد يخرج عن المزامنة في أي وقت (مثلاً webhook فشل، أو ترقية يدوية). أي صفحة تقرأ `profiles.subscription_plan` مباشرة بدلاً من `useSubscription` قد تعرض خطة قديمة.

**الحل:** اعتماد `useSubscription` فقط في الواجهة، واعتماد `user_active_plan(uid)` فقط في القاعدة، وعدم القراءة المباشرة من `profiles.subscription_plan`.

---

## 🟠 مشاكل تقنية تستحق الإصلاح

### 5. ١٨٠ استخدام لـ `as any`
أبرز المواقع الخطرة:
- `src/hooks/useSubscription.ts:130-131,149,154` → `(sub as any).canceled_at`, `.data_delete_at`, `.addon_units` — هذه أعمدة موجودة في الـtypes تلقائياً، الـcast غير ضروري وقد يخفي تغييرات سكيمة.
- `src/pages/UnitDetail.tsx:882` → `.update({ [col]: val } as any)` — يسمح بتحديث أي عمود بأي قيمة دون فحص النوع. خطر تشغيلي حقيقي.

### 6. `protect_profile_system_fields` — نسختان في المايجريشنات
موجودة في `20260520164407` وفي `20260601134307`. الثانية هي الأخيرة وتسود، لكن وجود نسختين يجعل قراءة التاريخ مربكة. (هذا تنظيمي فقط، لا يؤثر تشغيلياً لأن `CREATE OR REPLACE`.)

### 7. لا يوجد foreign key بين `profiles.id` و `auth.users.id`
حذف مستخدم من نظام المصادقة يترك صفاً يتيماً في `profiles`. لا يكسر شيئاً الآن لكن قد يسبب صفوفاً قديمة.

---

## 🟢 ما هو سليم

- لا توجد جداول بدون RLS.
- لا توجد سياسات `USING (true)` على بيانات حساسة.
- إصلاحات الجلسة السابقة (مزامنة الخطة، trigger، حذف الترويجي القديم) منفذة في القاعدة بنجاح.
- قنوات `notif:${user.id}` و `subs:${user.id}` صحيحة (موسومة بالمستخدم).
- لا يوجد `limit(1000)` ظاهرة في الكود.

---

## خطة الإصلاح المقترحة (عند الانتقال للوضع التنفيذي)

1. حذف حقل `status` من 4 ملفات (`AddUnitDialog`, `AddBuildingDialog`, `NewTenancyDialog`, `EndTenancyDialog`) — قد يستدعي استدعاء `recompute_unit_state` بعد كل insert ليتحدث فوراً.
2. إصلاح `useSubscription`: استبعاد صفوف `_addon` + استخدام `addon_units` فقط من صف الخطة الفعلية.
3. تثبيت أسماء قنوات Realtime الثلاث المتعلقة بـ `activity_log` بإضافة `user.id`.
4. (اختياري) استبدال `as any` في `useSubscription.ts` و `UnitDetail.tsx:882` بأنواع `Database["public"]["Tables"]…`.

أخبرني أي بنود تريدني أن أنفذها عند تفعيل وضع البناء (Build mode).
