## الهدف

تبسيط ضبط ترقيم الإيصالات في الإعدادات، وإرسال إيميل تأكيد للمالك في كل مرة يتغيّر فيها أي حقل من حقول الترقيم (البادئة / الخانات / رقم البداية).

---

## 1) تبسيط واجهة الضبط (Settings.tsx — تبويب Print)

استبدال البطاقة الحالية المزدحمة (بادئات سريعة + بادئة مخصصة + سلايدر خانات + زر Reset + معاينة) ببطاقة موحّدة "ويزارد سريع" أبسط:

- **حقل واحد كبير "أول رقم سيظهر على إيصالاتك"** يكتب فيه المالك مثلاً `R-01001` ونحن نفصله تلقائياً إلى:
  - بادئة = `R-`
  - رقم البداية = `1001`
  - الخانات = `4` (تُستنتج من طول الجزء الرقمي)
- معاينة حيّة كبيرة أسفل الحقل (الرقم التالي، نفس الـ token سيج المستخدم اليوم).
- **زر واحد فقط "حفظ التغيير"** يظهر فقط عند وجود تعديل غير محفوظ (بدلاً من الحفظ الفوري في كل ضغطة).
- إزالة شريط الـ presets المنفصل + السلايدر + الحقل المخصص + زر Reset من الواجهة الأمامية (يبقى منطق الـ reset متاحاً من Server لكن مخفي خلف "خيارات متقدمة" قابلة للطي).
- شارة صغيرة تحت الحقل: "سيصلك إيميل تأكيد على بريد حسابك في كل تغيير".

---

## 2) إيميل تأكيد التغيير

عند ضغط "حفظ التغيير" بنجاح:

- يُستدعى `send-transactional-email` من الواجهة مع:
  - `templateName: 'receipt-numbering-changed'`
  - `recipientEmail`: بريد الحساب (`user.email`)
  - `idempotencyKey`: `receipt-num-change-${userId}-${timestamp}`
  - `templateData`: `{ name, oldPrefix, oldStart, oldPadding, newPrefix, newStart, newPadding, nextPreview, changedAt }`
- التوست في الواجهة يخبر المستخدم: "تم الحفظ ✓ — أرسلنا تأكيداً إلى بريدك".
- لا يُرسل إيميل إذا لم تتغيّر أي قيمة فعلياً (مقارنة قبل/بعد).

---

## 3) قالب الإيميل الجديد

ملف React Email جديد:
`supabase/functions/_shared/transactional-email-templates/receipt-numbering-changed.tsx`

- التزام بالهوية البصرية للتطبيق (سيج/كريم، Outfit + Noto Kufi Arabic، حواف 12-16px، خلفية بيضاء للـ Body).
- بنية: عنوان "تم تحديث ترقيم الإيصالات" + جدول صغير مقارن (قبل ← بعد) + سطر "الرقم التالي سيكون: R-01002" + تذنيب "إن لم يكن هذا أنت، راجع الإعدادات فوراً".
- subject: `'تم تحديث ترقيم الإيصالات في حسابك على أملاكي'` (دالة تختار AR/EN حسب lang إن أمكن).
- تسجيله في `_shared/transactional-email-templates/registry.ts`.

---

## 4) المتطلبات قبل البث

- التحقق من حالة نطاق البريد عبر `email_domain--check_email_domain_status`.
- إن لم تكن البنية التحتية للإيميل جاهزة → `email_domain--setup_email_infra` ثم `email_domain--scaffold_transactional_email` (لأول مرة فقط — لاحقاً فقط إضافة القالب الجديد ونشره).
- نشر الـ Edge Functions بعد إضافة القالب: `deploy_edge_functions(['send-transactional-email'])`.
- لا تغيير على قاعدة البيانات إطلاقاً (نستخدم `update_receipt_settings` الموجود حالياً).

---

## ملفات ستتغيّر

- `src/pages/Settings.tsx` — استبدال بطاقة ترقيم الإيصالات بواجهة الويزارد المبسّطة + استدعاء إيميل التأكيد.
- `supabase/functions/_shared/transactional-email-templates/receipt-numbering-changed.tsx` — قالب جديد.
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — تسجيل القالب.
- (احتمال) `email_domain--setup_email_infra` + `scaffold_transactional_email` إذا لم تكن البنية موجودة بعد.

لا تغيير على: `appSettings.tsx`, `receiptNumbering.ts`, قاعدة البيانات، RLS، أو منطق إنشاء الدفعات.
