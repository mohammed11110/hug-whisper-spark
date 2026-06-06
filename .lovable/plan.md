## التشخيص — لماذا التنقل بطيء

بعد فحص `vite.config.ts` و `App.tsx` و `queryClient.ts` والصفحات، الأسباب الجذرية للبطء عند التنقل بين الأقسام:

### 1) `pdfDocs.ts` ضخم ومستورد بشكل ثابت (الأثقل)
الملف ~2700 سطر + ملفات خطوط Base64 مدمجة (Noto Kufi + Outfit ≈ مئات الكيلوبايتات)، ومستورد statically من:
- `src/pages/Payments.tsx`
- `src/pages/UnitDetail.tsx`
- `src/pages/Reports.tsx`
- `src/pages/PrintView.tsx`
- `src/components/AddPaymentDialog.tsx`
- `src/components/FilePreviewDialog.tsx`

نتيجة: كل صفحة من هذه يتم تحميل وتفسير `pdfDocs` + `jspdf` + `html2canvas` قبل ظهور الواجهة → تأخير ملموس على iPad/الجوال عند فتح أي قسم منها.

### 2) لا يوجد React Query في الصفحات
`useQuery` غير مستخدم في الصفحات — كل صفحة تستدعي Supabase داخل `useEffect` يدوياً. عند الرجوع لنفس القسم يُعاد جلب كل البيانات من الصفر بدل استخدام cache → شاشة تحميل في كل مرة.

### 3) لا يوجد تقسيم vendor (manual chunks)
كل المكتبات الكبيرة (`recharts`, `jspdf`, `html2canvas`, `embla-carousel`, `cmdk`, جميع `@radix-ui/*`, `react-day-picker`, `react-markdown`, `driver.js`, `@sentry/react`) تذهب لـ chunk واحد ضخم يُحمَّل على أول navigation ثم يُحلَّل (parse) من جديد.

### 4) عدم prefetch للقسم التالي المتوقع
عند لمس عنصر في القائمة، يبدأ تنزيل الـ chunk من الصفر. على شبكات بطيئة هذا يضيف 200–800ms ظاهرة كـ "تجمّد".

### 5) Splash/Loading يظهر بشكل متكرر
`<Suspense fallback={<LoadingScreen />}>` على مستوى التطبيق → كل قسم lazy يُظهر شاشة تحميل كاملة بدل انتقال سلس.

### 6) Providers تعيد التصيير أكثر من اللازم
`I18nProvider` و `CurrencyProvider` و `AppSettingsProvider` و `ThemeProvider` بدون `useMemo` للقيمة → أي تغيير حالة (مثل عدّاد الإيصالات) يُعيد تصيير كامل شجرة الصفحات.

---

## الاقتراحات المرتّبة بالأولوية

### A. مكاسب فورية وضخمة (تنفيذ سريع)

**A1. تحويل `pdfDocs` إلى استيراد ديناميكي عند الحاجة فقط**
بدل `import { ... } from "@/lib/pdfDocs"` على رأس الملف:
```ts
const handlePrint = async () => {
  const { downloadReceiptPDFDirect } = await import("@/lib/pdfDocs");
  await downloadReceiptPDFDirect(data, filename);
};
```
يطبَّق على Payments، UnitDetail، Reports، AddPaymentDialog، FilePreviewDialog، PrintView.
**أثر متوقع: −300KB إلى −800KB من الـ chunks الأولية لكل قسم → ظهور الواجهة فوراً.**

**A2. تقسيم خطوط الـ PDF كملف منفصل lazy**
ملفات الخطوط (`getFontBase64Map`) في chunk خاص يُحمَّل فقط عند توليد PDF فعلي. هذا وحده قد يوفّر >400KB من أوّل تحميل.

**A3. Manual chunks في `vite.config.ts`**
إضافة `build.rollupOptions.output.manualChunks`:
- `react-vendor` → react, react-dom, react-router-dom
- `ui-vendor` → جميع `@radix-ui/*`, `lucide-react`, `cmdk`
- `pdf-vendor` → jspdf, html2canvas (مع A1 لن تُحمَّل أصلاً حتى الحاجة)
- `charts` → recharts
- `query` → @tanstack/react-query, @supabase/supabase-js
يقلّل حجم الـ entry ويُمكّن المتصفح من cache الـ vendor عبر النشرات.

**A4. تمكين compression و target حديث**
- `build.target: "es2020"` (أصغر وأسرع parsing).
- `build.cssCodeSplit: true` (افتراضي لكن نتأكد).
- `esbuild.legalComments: "none"`.

### B. مكاسب كبيرة على إعادة الزيارة (تنفيذ متوسط)

**B1. تفعيل React Query في الصفحات الثقيلة**
تحويل جلب البيانات في Dashboard، Buildings، Payments، Reports، Tenants، UnitDetail إلى `useQuery` مع:
```ts
defaultOptions: {
  queries: {
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  }
}
```
**أثر: الرجوع لصفحة سبق فتحها يصبح فورياً (بيانات من cache + تحديث في الخلفية).**

**B2. Suspense fallback أخف داخل AppShell**
نقل الـ Suspense إلى داخل الـ `<Outlet/>` فقط (لا حول التطبيق كله)، مع fallback صغير (شريط تقدّم رفيع علوي بدل LoadingScreen كاملة) → انتقال يبدو سلساً.

**B3. Prefetch ذكي عند hover/touchstart على روابط القائمة**
في `AppSidebar`/`BottomNav`، عند `onMouseEnter`/`onTouchStart` لرابط، استدعاء `import("./pages/X")` لتحميل الـ chunk مسبقاً.

### C. تحسينات بنيوية إضافية

**C1. تذكير `useMemo` لقيم الـ context**
في `AppSettingsProvider` و `I18nProvider` و `CurrencyProvider` و `AuthProvider`: لفّ `value={...}` بـ `useMemo` حتى لا يعيد كل المشتركين التصيير عند أي تحديث غير ذي صلة.

**C2. تقسيم `UnitDetail.tsx` (1484 سطر) و `Settings.tsx` (922 سطر)**
استخراج الأقسام الفرعية (تبويبات/ديالوقات) إلى ملفات منفصلة `lazy()` لتقليل الـ chunk الأولي للقسم.

**C3. إزالة `html2canvas` من الـ bundle نهائياً إن أمكن**
بعد الانتقال للمسار المباشر للإيصال + الكشف، تحقَّق هل ما زال `html2canvas` لازماً لأي مسار. إن لا، احذف الاستيراد والـ dependency.

**C4. Sentry lazy**
`@sentry/react` يضيف ~50KB. تحميله ديناميكياً بعد `requestIdleCallback`.

**C5. تأجيل `OnboardingTour` و `AnimatedSplash`**
كلاهما يحمّل `driver.js` و framer-motion. اجعلهم `lazy()` خلف Suspense منفصل.

### D. قياس فعلي (قبل/بعد)
بعد A1 + A3:
- شغّل `npm run build` ولاحظ حجم `dist/assets/*.js`.
- استخدم Chrome DevTools → Performance لتسجيل navigation من Dashboard → Payments → Reports وقارن.
- الهدف: chunk أوّلي للقسم < 80KB gzipped، و TTI عند التنقل < 200ms.

---

## ملخّص الخطوات الفعلية المقترَحة (يمكن تنفيذها بترتيب)

1. **A1** — جعل كل استدعاءات `pdfDocs` ديناميكية (6 ملفات).
2. **A3** — `manualChunks` في `vite.config.ts`.
3. **B2** — Suspense داخلي خفيف.
4. **B3** — Prefetch on hover للقوائم.
5. **B1** — React Query تدريجياً (Dashboard أولاً ثم Payments).
6. **C1** — `useMemo` للـ contexts.
7. **C2** — تقسيم UnitDetail / Settings.
8. **C4–C5** — تأجيل Sentry و OnboardingTour.

---

## أي مجموعة تريد تطبيقها الآن؟

- **حزمة سريعة (1–3)**: أكبر تحسين بأقل تغيير — يستهدف زمن ظهور الواجهة عند التنقل.
- **الحزمة الكاملة (1–8)**: حل جذري شامل، أطول لكن النتيجة احترافية.
- **مخصص**: اذكر أرقام النقاط التي تريدها.