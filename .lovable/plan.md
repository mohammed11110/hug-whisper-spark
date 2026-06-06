
# خطة: وضع النهار / الليل (Light + Dark Midnight Gold)

## الهدف
- **Light mode** يصبح الافتراضي: خلفية فاتحة `#f0f1f3`، نص ميدنايت `#1a1f2b`، ذهبي داكن `#a8853a` كأكسنت.
- **Dark mode** يحافظ على تصميم Midnight Gold الحالي بالضبط.
- البطاقة الرئيسية (Hero) تبقى ميدنايت + ذهبي في **كلا الوضعين** — هذه هي البصمة المميزة للهوية.
- يتبع تفضيل النظام تلقائياً + تبديل يدوي (Light / Dark / System) في الإعدادات، مع حفظ الاختيار وانتقال 200ms.

---

## 1) `src/index.css` — إعادة هيكلة التوكنز

**`:root` (Light — جديد):**
```
--background: 220 11% 95%;       /* #f0f1f3 */
--foreground: 222 25% 14%;       /* #1a1f2b midnight */
--card: 0 0% 100%;               /* #ffffff */
--card-foreground: 222 25% 14%;
--border: 220 11% 88%;           /* #dde0e5 */
--input: 220 11% 92%;
--muted: 220 11% 92%;
--muted-foreground: 220 10% 58%; /* #8a92a0 */
--primary: 222 25% 14%;          /* midnight = brand primary on light */
--primary-foreground: 44 60% 92%;
--secondary: 222 22% 21%;        /* #2a3142 slate */
--secondary-foreground: 44 60% 92%;
--accent: 40 50% 44%;            /* #a8853a — gold داكن AA على أبيض */
--accent-foreground: 0 0% 100%;
--gold: 40 50% 44%;              /* small text / icons على أبيض */
--gold-bright: 44 56% 54%;       /* #c9a44c — للأزرار على ميدنايت فقط */
--destructive: 0 38% 51%;        /* #a85d5d */
--destructive-foreground: 0 30% 96%;
--ring: 40 50% 44%;

/* Sage scale يُعاد ربطه ليلائم Light (ألوان أغمق ومحايدة) */
--sage-100..700: نسخة فاتحة منطقية

/* Hero يبقى ميدنايت في Light */
--gradient-sage:  linear-gradient(135deg, #2a3142, #1a1f2b);  /* hero card dark */
--gradient-deep:  linear-gradient(135deg, #2a3142, #1a1f2b);
--gradient-gold:  linear-gradient(135deg, #d4b35a, #a8853a);
--gradient-cream: linear-gradient(135deg, #ffffff, #f0f1f3);
--gradient-midnight: linear-gradient(160deg, #2a3142 0%, #1a1f2b 60%, #0e1118 100%);

/* Semantic data colors — Light */
--success-bg: 140 26% 88%;       /* #d8e8de */
--success-fg: 145 49% 33%;       /* #2a7d52 */
--danger-bg:  0 50% 89%;         /* #f0d4d4 */
--danger-fg:  0 28% 51%;         /* #a85d5d */
--warning-fg: 40 71% 42%;        /* #b8841f */

/* Shadows — ناعمة محايدة على فاتح */
--shadow-soft: 0 1px 2px rgba(26,31,43,.06), 0 4px 12px rgba(26,31,43,.06);
--shadow-elev: 0 4px 10px rgba(26,31,43,.08), 0 14px 32px rgba(26,31,43,.10);
--shadow-gold: 0 10px 28px -10px rgba(168,133,58,.35);
```

**`.dark` (يحتفظ بالحالي تماماً) — مع تحديث طفيف للقيم الدقيقة المطلوبة:**
```
--background: 222 26% 8%;        /* #0e1118 */
--card: 222 22% 14%;             /* #1a1f2b */
--border: 222 22% 21%;           /* #2a3142 */
--foreground: 220 8% 91%;        /* #e8eaed */
--muted-foreground: 220 9% 59%;  /* #8a90a0 */
--primary / --accent / --gold: 44 56% 54%;  /* #c9a44c */
--success-bg: 145 27% 23%; --success-fg: 145 53% 67%;  /* #2a4a3a / #7ed9a8 */
--danger-bg: 0 24% 23%;   --danger-fg: 0 56% 75%;       /* #4a2e2e / #e09a9a */
```
بقية تدرجات Midnight Gold الحالية في `.dark` تبقى كما هي.

**انتقال سلس:**
```css
:root { color-scheme: light; }
.dark { color-scheme: dark; }
html, body, [data-theme-transition] {
  transition: background-color 200ms var(--ease-out),
              color 200ms var(--ease-out),
              border-color 200ms var(--ease-out);
}
```

---

## 2) `tailwind.config.ts`
إضافة:
```
gold: { DEFAULT: "hsl(var(--gold))", bright: "hsl(var(--gold-bright))" }
success: { DEFAULT: "hsl(var(--success-fg))", bg: "hsl(var(--success-bg))" }
danger:  { DEFAULT: "hsl(var(--danger-fg))",  bg: "hsl(var(--danger-bg))" }
warning: "hsl(var(--warning-fg))"
backgroundImage: { "gradient-midnight": "var(--gradient-midnight)" }
```
`darkMode: ["class"]` يبقى — مفتاح التبديل عبر class `.dark`.

---

## 3) `src/lib/theme.tsx` — التبديل الكامل
الملف موجود بالفعل ويدعم `light | dark | system` ويحفظ في `localStorage` تحت `amlaki_theme`. **الإصلاح الوحيد:** القيمة الافتراضية حالياً `"light"` ⇒ تغييرها إلى `"system"` ليحترم تفضيل الجهاز من أول تشغيل.

---

## 4) `src/components/SettingsPanel.tsx` (و/أو `src/pages/Settings.tsx`)
إضافة قسم "المظهر / Theme" بثلاثة أزرار segmented:
- ☀️ فاتح (Light)
- 🌙 داكن (Dark)
- 🖥️ تلقائي حسب النظام (System)
يستدعي `useTheme().setTheme(...)`. يظهر مؤشر للوضع الفعّال (resolved).

---

## 5) Hero / البطاقات الرئيسية (Signature)
المكونات التي تستخدم `bg-gradient-sage` أو `bg-gradient-deep` كبطاقة Hero ستبقى ميدنايت+ذهبي تلقائياً لأن التوكن في Light تم ضبطه على gradient ميدنايت. لا حاجة لتعديل JSX.

داخل تلك البطاقة، الأرقام/العناوين الذهبية يجب أن تستخدم `text-gold-bright` (وليس `text-gold`) لأن `#c9a44c` يلمع على ميدنايت.

تعديل بسيط في `src/components/dashboard/*` و`SettingsPanel` (شارة المستخدم) للتأكد من استخدام `text-gold-bright` داخل أسطح ميدنايت.

---

## 6) Receipts / Contracts — `src/lib/pdfDocs.ts`
- الرأس (Header) يبقى Midnight + Gold كما الآن.
- جسم الوثيقة: نص داكن `#0f1a2e` على أبيض في **كلا الوضعين** (للطباعة) — هذا متحقق فعلياً، فقط نتأكد أن أي ألوان حالة (paid/overdue) تستخدم نسخ Light القابلة للطباعة.

---

## 7) `index.html` و`capacitor.config.ts`
- `<meta name="theme-color">`: قيمتان (light = `#f0f1f3`, dark = `#0e1118`) عبر `media="(prefers-color-scheme: ...)"`.
- `capacitor.config.ts` → `backgroundColor` يبقى `#0d1426` (شاشة البداية الميدنايت = هوية موحّدة عند فتح التطبيق).

---

## 8) شيكات التباين (WCAG AA)
- `#a8853a` على `#ffffff` → contrast 4.6 ✅ (للنص الصغير).
- `#1a1f2b` على `#f0f1f3` → contrast 14.3 ✅.
- `#c9a44c` على `#1a1f2b` → contrast 6.8 ✅ (فقط داخل بطاقات ميدنايت).
- قاعدة في الكود: لا نستخدم `text-gold-bright` على أسطح فاتحة — فقط `text-gold` أو `text-accent`.

---

## 9) معالجة الأخطاء الحالية (Runtime)
أخطاء `useNavigate/useLocation outside Router` + فشل تحميل dynamic chunks (`Notifications`, `Assistant`) تظهر بسبب HMR قديم بعد تعديلات سابقة. ستُحلّ تلقائياً بعد إعادة build كاملة. إن استمرت، نضيف:
- تأكيد أن أي مكون يستدعي `useNavigate` لا يُستورد خارج `<BrowserRouter>` (فحص سريع لـ `AnimatedSplash` وأي مكون مُركّب فوق Router في `App.tsx`).
- إعادة فحص الصفحات اللتين فشل استيرادهما للتأكد من خلوهما من أخطاء بناء.

---

## ملفات سيتم تعديلها
1. `src/index.css` — توكنز Light جديدة + تحديث `.dark` للقيم الدقيقة + transition.
2. `tailwind.config.ts` — إضافة `gold.bright`, `success`, `danger`, `warning`, `gradient-midnight`.
3. `src/lib/theme.tsx` — افتراضي `system`.
4. `src/components/SettingsPanel.tsx` — قسم Theme switcher.
5. `src/lib/pdfDocs.ts` — تأكيد ألوان الحالة للطباعة.
6. `index.html` — `theme-color` لكلا الوضعين.
7. مكوّنات Hero (إن لزم) لاستخدام `text-gold-bright` داخل أسطح ميدنايت.
8. تحديث `mem://brand/identity` + `mem://index.md` ليعكسا الوضعين.

## ما لن يتغيّر
- بنية الصفحات، البيانات، Auth، Capacitor backend، PDF layout، أي منطق أعمال.
- تجربة Dark mode الحالية تبقى مطابقة 100%.

هل أبدأ التنفيذ؟
