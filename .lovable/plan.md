## السبب الجذري (مراجعة شاملة)

بعد فحص `src/lib/pdfDocs.ts` و`src/pages/UnitDetail.tsx` و`src/components/FilePreviewDialog.tsx`:

كل HTML تبنيه `pageShell` (المعاينة + الطباعة + التنزيل عبر `downloadHTMLAsPDF`) يحتوي على عنصر فارغ:

```html
<style id="pdf-fonts">/* fonts injected at render time */</style>
```

أي أن HTML المعروض **لا يحتوي على `@font-face` لـ Noto Kufi Arabic إطلاقاً**. الـ `@font-face` يُحقن لاحقاً فقط داخل `renderInIframe` (مسار التنزيل الاحتياطي). أما:

- **المعاينة** (`<iframe srcDoc>`): لا يوجد `@font-face`، فيسقط المتصفح إلى خط افتراضي لا يصل الحروف. وحدها إضافة `<base>` لا تكفي لأن الـ HTML لا يطلب الخط أصلاً.
- **الطباعة** (`window.open` + `document.write`): نفس المشكلة — لا `@font-face`.
- **التنزيل** عبر `renderInMainDocument` (المسار المفضّل): يعتمد على خطوط `index.css` في التطبيق الرئيسي. يعمل عادةً، لكن أحياناً تُلتقط الحروف منفصلة عندما يكون `html2canvas` أسرع من جاهزية الخط، أو عندما يتجاوز التطبيق إلى مسار آخر.
- **`downloadLeasePDF`** (jsPDF المباشر): يستخدم خطوطاً مضمَّنة في الملف نفسه — صحيح ولا يحتاج تعديلاً.

## الإصلاح الموحّد

ملف واحد رئيسي: **`src/lib/pdfDocs.ts`** — وإلغاء `withBase` غير الفعّال في `FilePreviewDialog.tsx`.

### 1) إضافة دالة `inlinePdfFonts(html)` في `src/lib/pdfDocs.ts`

تجلب خطوط Noto Kufi Arabic + Outfit كـ data URLs (الكاش موجود مسبقاً عبر `getFontDataUrls`) وتملأ عنصر `<style id="pdf-fonts">` بـ `@font-face` كامل. إن لم يوجد العنصر، تُحقن `<style>` جديد داخل `<head>`. تُصدَّر للاستخدام في أماكن أخرى.

```ts
export async function inlinePdfFonts(html: string): Promise<string> {
  const urls = await getFontDataUrls();
  const css = buildFontFaceCss(urls);
  if (/<style[^>]*id=["']pdf-fonts["'][^>]*>[\s\S]*?<\/style>/i.test(html)) {
    return html.replace(
      /<style([^>]*)id=["']pdf-fonts["']([^>]*)>[\s\S]*?<\/style>/i,
      `<style$1id="pdf-fonts"$2>${css}</style>`
    );
  }
  const styleTag = `<style id="pdf-fonts">${css}</style>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${styleTag}`);
  return `<!doctype html><html dir="rtl" lang="ar"><head>${styleTag}</head><body>${html}</body></html>`;
}
```

### 2) `printHTML` يصبح async ويحقن الخطوط قبل الكتابة

```ts
export async function printHTML(html: string) {
  const finalHtml = await inlinePdfFonts(html);
  const win = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!win) throw new Error("Could not open print window");
  win.document.open();
  win.document.write(finalHtml);
  win.document.close();
  win.focus();
  // انتظار جاهزية الخطوط ثم الطباعة
  const runPrint = async () => {
    try { await (win.document as any).fonts?.ready; } catch {}
    setTimeout(() => win.print(), 250);
  };
  if (win.document.readyState === "complete") runPrint();
  else win.onload = () => runPrint();
}
```

### 3) `downloadHTMLAsPDF` يحقن الخطوط قبل أي مسار رسم

```ts
export async function downloadHTMLAsPDF(html: string, filename: string, settings?: PdfSettings) {
  const finalHtml = await inlinePdfFonts(html);
  // ... باقي المنطق يستخدم finalHtml بدل html
}
```

هذا يضمن أن مسار `renderInIframe` ومسار `renderInMainDocument` كلاهما يرى `@font-face` بـ data URLs ضمن HTML مباشرة (لا يعتمد على مسارات نسبية).

### 4) `FilePreviewDialog.tsx`: حقن الخطوط داخل المعاينة

استبدال `withBase` الحالي (لا يحلّ المشكلة) بـ `useEffect` يستدعي `inlinePdfFonts` ويخزن النتيجة في state، ويُمرَّر إلى `iframe.srcDoc`. أثناء التحميل تُعرض رسالة "جاري التحضير…".

```tsx
const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
useEffect(() => {
  if (payload?.type !== "pdf") return;
  let cancelled = false;
  setRenderedHtml(null);
  inlinePdfFonts(payload.html).then((h) => { if (!cancelled) setRenderedHtml(h); });
  return () => { cancelled = true; };
}, [payload]);
```

و:

```tsx
<iframe srcDoc={renderedHtml ?? ""} ... />
```

مع شاشة تحميل بسيطة عندما `renderedHtml === null`.

## نطاق التعديل

- `src/lib/pdfDocs.ts`:
  - إضافة وتصدير `inlinePdfFonts`.
  - تعديل `printHTML` → async + حقن + `fonts.ready`.
  - تعديل `downloadHTMLAsPDF` → حقن قبل الرسم.
- `src/components/FilePreviewDialog.tsx`:
  - حذف `withBase` واستخدام `inlinePdfFonts` عبر `useEffect`.
  - إظهار حالة تحميل بسيطة.

## خارج النطاق

- لا تغيير في بنّاء العقود (`buildLeaseHTML`, `buildOmaniLeaseHTML`, `buildTenantStatementHTML`, `pageShell`).
- لا تغيير في `downloadLeasePDF` (يعمل عبر jsPDF بخطوط مضمَّنة).
- لا تغيير في `src/pages/UnitDetail.tsx` (`printHTML` لا تزال تُستدعى بنفس التوقيع — JS يتجاهل عدم الـ await).

## التحقق

- معاينة عقد عُماني وعقد عام → الأحرف موصولة.
- معاينة كشف حساب المستأجر → الأحرف موصولة.
- زر **طباعة** يفتح نافذة جديدة بنفس الخط الموصول.
- زر **حفظ** ينتج PDF بأحرف موصولة في كلا المسارين (main-document + iframe fallback).
- معاينة CSV غير متأثرة.
