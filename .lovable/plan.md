## Goal

Replace the current cream/print receipt with a **dark Midnight & Gold A5 receipt** rendered purely with jsPDF vector primitives (no html2canvas snapshot, no DOM). Small file size, instant open on iOS/Android share sheet. Add a calculated **"Remaining After Payment"** row and fix the `[object Object]` rendering bug.

## Scope (files touched)

- `src/lib/pdfDocs.ts` — rewrite `createReceiptPDFDirect` (and only it). Add a dark-palette block + a hardened `formatAmount` helper. `buildReceiptHTML` (legacy HTML preview) stays as is; `downloadReceiptPDFDirect` / `printReceiptPDFDirect` keep their current signatures.
- `src/pages/Payments.tsx` — small tweak in `buildReceiptData` to also pass `cycleTotalDue`/`cyclePaidToDate` already there (no API change). No call-site rename.

No DB migration. No schema change. Receipt numbering already comes from the central Supabase counter (`r.receipt_number`) — that path is untouched.

## Visual spec (matches "Design 3")

A5 portrait (148 × 210 mm), 12 mm margins.

```text
┌────────────────────────────────────────┐  page bg #0e1118
│ ┌────────────────────────────────────┐ │  card #1a1f2b, border #2a3142, r=6
│ │ [🔑 gold]  Payment Receipt         │ │  title gold #c9a44c
│ │            إيصال استلام             │ │
│ │  Amlaki · أملاكي    #RC-000123      │ │  receipt no. gold
│ │                       [● Paid in Full] │  green pill #2a7d52 bg, #7ed9a8 ink
│ └────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐   │  4 info cards in 2×2 grid
│  │ Tenant       │  │ Building/Unit│   │  card bg #1a1f2b
│  │ <name>       │  │ <bldg> · #12 │   │  label muted #8a93a3
│  └──────────────┘  └──────────────┘   │  value #e8eaed
│  ┌──────────────┐  ┌──────────────┐   │
│  │ Rental Period│  │ Payment Date │   │
│  └──────────────┘  └──────────────┘   │
│  ┌────────────────────────────────────┐ │  PAYMENT SUMMARY box
│  │ Due Before Payment       1.500.000│ │  neutral ink
│  │ Amount Paid             −1.000.000│ │  red/amber ink, with leading minus
│  │ ──────────────────────────────────│ │
│  │ Remaining After Payment   500.000 │ │  highlighted row
│  └────────────────────────────────────┘ │   bg gold-soft if >0 (amber ink)
│  ┌────────────────────────────────────┐ │   bg green-soft if =0 (green ink)
│  │  Amount Paid / المبلغ المدفوع       │ │  big gold gradient box
│  │             1,000.000 OMR          │ │  gradient #c9a44c → #a8853a
│  └────────────────────────────────────┘ │  text on midnight
│   Proof of payment · generated …       │  footer muted
└────────────────────────────────────────┘
```

### Color tokens (PDF-local, RGB tuples)

```ts
const RX = {
  bg:        [14, 17, 24],     // #0e1118
  card:      [26, 31, 43],     // #1a1f2b
  border:    [42, 49, 66],     // #2a3142
  ink:       [232, 234, 237],  // #e8eaed
  muted:     [138, 147, 163],  // #8a93a3
  goldBright:[201, 164, 76],   // #c9a44c
  goldDeep:  [168, 133, 58],   // #a8853a
  goldSoft:  [60, 47, 20],     // dark amber surface for amber highlight
  greenBg:   [42, 74, 58],     // #2a4a3a
  greenInk:  [126, 217, 168],  // #7ed9a8
  redInk:    [224, 154, 154],  // #e09a9a
  amberInk:  [232, 184, 100],
};
```

### Geometry

- Page: `format: "a5"`, unit `mm`.
- Margins: 12 mm.
- Header card: full width, height ≈ 36 mm.
- Info card grid: 2×2, gap 4 mm, card height 18 mm.
- Summary box: full width, 3 rows, padded 6 mm, divider line above the "Remaining" row.
- Hero amount box: full width, 24 mm tall, faux gradient via 30 thin horizontal bands interpolating goldBright → goldDeep (jsPDF has no native gradient).
- Footer: 1 muted line, centered.

## "[object Object]" bug fix

Root cause: somewhere a value reaches `pdf.text(...)` as a non-primitive (e.g. a React/Intl object, or `formatMoney` is called with the raw row object). Fix at two layers:

1. **New helper** at the top of the receipt renderer:
   ```ts
   const formatAmount = (v: unknown): string => {
     const n = typeof v === "number" ? v : Number((v as any)?.valueOf?.() ?? v);
     return Number.isFinite(n) ? n.toFixed(3) : "0.000";
   };
   const formatMoneySafe = (v: unknown, cur?: string | null) =>
     `${formatAmount(v)}${cur ? " " + cur : ""}`;
   ```
2. **All amount writes** in the new receipt path go through `formatMoneySafe(...)` — never pass `data.amount` (or any unknown object) directly into `drawTextBlock`. `drawTextBlock` already calls `normalizePdfText` (which `String(...)`s the input), so an object would render as `[object Object]`; routing every numeric field through `formatAmount` first guarantees a clean string.

## Computation

```ts
const amountPaid        = Number(data.amount) || 0;
const dueBeforePayment  = Number(
  data.cycleTotalDue ?? data.expectedAmount ?? amountPaid
) || amountPaid;
const remainingAfter    = Math.max(0, dueBeforePayment - amountPaid);
const statusKey         = remainingAfter <= 0.009 ? "paid" : "partial";
```

Highlight color for the Remaining row:
- `remainingAfter <= 0.009` → green ink on green-tinted band, label "Paid in Full / مسدد بالكامل".
- otherwise → amber ink on dark-gold band.

## Bilingual handling

- `rtl = data.lang !== "en"` (existing convention).
- Labels use the existing `L(ar, en)` helper.
- Amount alignment: RTL → numbers on the **left**, labels on the **right**. LTR → mirrored.
- Numbers always rendered with Western digits via `.toFixed(3)` (no `toLocaleString("ar-…")` — keeps the digits portable and font-safe inside jsPDF).
- Status pill text switches: "Paid in Full" / "مسدد بالكامل".
- Font registration unchanged — `registerLeasePdfFonts(pdf)` already loads NotoKufiArabic + Outfit.

## Receipt number

Already injected as `data.receiptNumber` from `Payments.tsx` (`r.receipt_number || r.id`), which is the value produced by the central Supabase sequential counter. The new layout renders it in gold in the header. No new fetch.

## File size / perf

- No html2canvas, no raster snapshot, no addImage calls except the optional brand logo (kept, same `urlToDataUrl` path, drawn at 14×14 mm).
- Expected PDF size: ~25–60 KB (vs. ~600 KB+ with html2canvas).
- A5 single page; `ensureSpace` retained as safety.

## Out of scope

- No change to `buildReceiptHTML` (the in-app HTML preview / sharable HTML stays light-cream — only the rendered PDF goes dark, matching what the user asked).
- No change to lease, statement, or report PDFs.
- No change to receipt numbering, DB, or any call site outside `Payments.tsx`.

## Verification

1. Generate a receipt in AR and EN from `Payments.tsx` (download + print).
2. Open the file; confirm:
   - Dark midnight background with gold accents.
   - Three-row summary with correct **Remaining After Payment** (try a partial-payment row, a fully-paid row, and a row where `expected_amount` is null).
   - No `[object Object]` anywhere; all amounts render as `1234.000` with the currency suffix.
   - File opens instantly on iOS share sheet (size < 100 KB).
3. Run the existing balance/arrears tests; no logic changed there but they exercise the same row shape.
