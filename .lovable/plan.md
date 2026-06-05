## شاشة بدء متحركة (Animated Splash)

### التسلسل النهائي عند فتح التطبيق
```text
Native iOS/Android Splash (ثابتة ~0.5s)
        ↓ SplashScreen.hide()
Animated React Splash (~1.8s) ← الحركة الجديدة
        ↓ fade-out 300ms
التطبيق (Dashboard / Auth)
```

### المكوّن الجديد
- ملف: `src/components/AnimatedSplash.tsx`
- Overlay بكامل الشاشة فوق كل شيء (`fixed inset-0 z-[100]`).
- خلفية: تدرج sage `#5f7e65 → #2c3a2e` + تطبيق نفس النقش الخفيف من launch screen (نسخة SVG خفيفة من الموجود في `BotanicalDecor`).
- المحتوى الموسّط:
  1. شعار المفتاح (نفس `Logo` الحالي بحجم 96px داخل بطاقة sage شفافة بزوايا 22px).
  2. اسم العلامة: "Amlaki" + سطر "أملاكي".
  3. التاجلاين: "PROPERTY MANAGEMENT".

### الحركة (Emil Kowalski style)
كلها CSS keyframes — transform + opacity فقط، easing `cubic-bezier(0.32, 0.72, 0, 1)`.

| العنصر | المدة | التأخير | الحركة |
|---|---|---|---|
| الخلفية | 200ms | 0 | opacity 0→1 |
| الشعار | 400ms | 100ms | scale 0.7→1 + opacity 0→1 |
| نبض الشعار | 3.2s loop | يبدأ بعد دخول الشعار | scale 1→1.05→1 |
| الاسم | 300ms | 550ms | translateY 12px→0 + opacity 0→1 |
| التاجلاين | 300ms | 750ms | opacity 0→1 |
| خروج كامل | 300ms | بعد ≥1.8s | opacity 1→0 + scale خفيف |

دعم `prefers-reduced-motion`:
- تخطّي حركات الدخول وعرض الحالة النهائية فوراً.
- تقليل وقت العرض الكلي إلى ~600ms قبل الخروج.

### منطق العرض والإخفاء
- يُركَّب على مستوى الجذر داخل `src/main.tsx` أو `src/App.tsx` (سأختار `App.tsx` ليأتي بعد الـ providers مباشرة).
- يدير حالته بنفسه عبر `useState` + `useEffect`:
  - عند `mount`: استدعاء `SplashScreen.hide()` من `@capacitor/splash-screen` (موجودة فعلاً في المشروع) — حتى تنتقل الـ native splash بسلاسة إلى المتحركة.
  - `setTimeout` لمدة 1800ms (أو 600ms عند reduced-motion) ثم تشغيل خروج 300ms ثم unmount.
- لا يحجب الكليكات بعد بدء الـ fade-out (`pointer-events: none`).
- لا يُعرض على web preview داخل Lovable iframe (لتفادي وميض غير مرغوب أثناء التطوير) — يظهر فقط:
  - في native Capacitor (`isNative()`).
  - أو في PWA المنشور (standalone display-mode).
- خيار: متغيّر `sessionStorage` لتجنّب إعادة الظهور عند التنقّل الداخلي — يظهر مرة واحدة لكل جلسة.

### تفاصيل تقنية
- Keyframes جديدة في `src/index.css`: `splash-bg-in`, `splash-logo-in`, `splash-pulse`, `splash-name-in`, `splash-fade-out`.
- استخدام التوكنات الحالية (sage/cream) لا hex مباشر داخل JSX — التدرج فقط في الـ keyframes/utility class.
- استخدام `Logo` المتوفر في `src/components/Logo.tsx` للحفاظ على تطابق العلامة.
- بدون مكتبات جديدة — `framer-motion` غير مطلوبة لهذه الحركة.

### الملفات المتأثرة
- جديد: `src/components/AnimatedSplash.tsx`
- تعديل: `src/App.tsx` (أو `main.tsx`) — تركيب الـ overlay.
- تعديل: `src/index.css` — keyframes فقط، بدون لمس التصميم القائم.

### التحقق بعد التنفيذ
- مراجعة المعاينة في الـ sandbox للتأكد من الحركة (مع ملاحظة أنها تظهر فقط في native/standalone وفق ما سبق — يمكن تفعيل وضع "اختبار" مؤقت إن أردت رؤيتها داخل المعاينة).
- خطوات سريعة للتجربة على iPhone/iPad بعد `npx cap sync`.

هل توافق على عرضها داخل المعاينة (web) أيضاً، أم تكفي native + PWA standalone فقط كما هو مقترح؟