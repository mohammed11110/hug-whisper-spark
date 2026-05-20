## الهدف
عند إرسال أي إيميل مصادقة (تأكيد التسجيل، استعادة كلمة المرور، رابط سحري، دعوة، تغيير إيميل، تأكيد مزدوج)، يتم اختيار اللغة تلقائياً حسب لغة المستخدم بدلاً من الإنجليزية فقط.

## اللغات المدعومة (12)
ar · en · ur · fa · hi · zh · tr · ru · fr · es · de · pt
أي لغة أخرى → fallback إلى الإنجليزية.

## آلية العمل

```text
User signs up / requests email
        │
        ▼
  حفظ language في user_metadata.language
        │
        ▼
  Supabase Auth يطلق auth-email-hook
        │
        ▼
  hook يقرأ user_metadata.language
        │
        ▼
  يختار القالب المناسب من الترجمات
        │
        ▼
  يُرسَل الإيميل باللغة الصحيحة + RTL/LTR
```

## الخطوات

1. **حفظ اللغة في حساب المستخدم**
   - عند التسجيل: تمرير `options.data.language` في `supabase.auth.signUp`
   - عند تغيير اللغة لمستخدم مسجّل: استدعاء `supabase.auth.updateUser({ data: { language } })` تلقائياً من `i18n.tsx`
   - تحديث `handle_new_user` trigger لتخزين اللغة في `profiles` أيضاً (نسخة احتياطية)

2. **بنية الترجمات في القوالب**
   - إنشاء ملف `supabase/functions/_shared/email-templates/translations.ts` يحتوي قاموس لكل قالب × كل لغة (subject + heading + body + button + footer)
   - كل قالب من القوالب الستة يستقبل prop `lang` ويختار النصوص من القاموس
   - تطبيق `dir="rtl"` و `lang="xx"` على `<Html>` تلقائياً للغات RTL (ar, ur, fa, he, ku, ps)
   - استخدام الخط المناسب: Noto Kufi Arabic للـRTL، Outfit للبقية

3. **تعديل `auth-email-hook/index.ts`**
   - قراءة `user.user_metadata.language` من payload الـ webhook
   - تطبيع القيمة + fallback إلى `en` إذا غير مدعومة
   - تمرير `lang` إلى مكوّن React Email
   - تمرير subject المترجم إلى `enqueue_email`

4. **القوالب الستة المُحدَّثة**
   - signup.tsx · recovery.tsx · magic-link.tsx · invite.tsx · email-change.tsx · reauthentication.tsx
   - الحفاظ على الهوية البصرية (sage palette, white bg, brand spacing)

5. **النشر والاختبار**
   - `deploy_edge_functions(["auth-email-hook"])`
   - اختبار: تغيير اللغة في التطبيق → طلب استعادة كلمة المرور → التأكد من وصول الإيميل بنفس اللغة

## ملاحظات
- المستخدمون الحاليون بدون `language` في metadata سيحصلون على الإنجليزية افتراضياً حتى يغيّروا اللغة مرة واحدة في التطبيق
- لا حاجة لإعادة إعداد domain أو DNS — البنية التحتية للإيميل جاهزة
- الترجمات نصوص ثابتة (ليست AI) — صفر تكلفة، صفر زمن استجابة إضافي