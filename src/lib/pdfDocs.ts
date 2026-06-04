import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { AppSettings, BusinessBrand, Margins, PageSize } from "@/lib/appSettings";

// ---- Embedded fonts (loaded once, cached as data URLs) ----
// Loading fonts as data URLs guarantees they are available the instant
// html2canvas snapshots the iframe via foreignObjectRendering — which is
// required for correct Arabic letter shaping (joining).
const FONT_FILES = {
  notoKufiRegular: "/fonts/NotoKufiArabic-Regular.ttf",
  notoKufiMedium:  "/fonts/NotoKufiArabic-Medium.ttf",
  notoKufiBold:    "/fonts/NotoKufiArabic-Bold.ttf",
  outfitRegular:   "/fonts/Outfit-Regular.ttf",
  outfitMedium:    "/fonts/Outfit-Medium.ttf",
  outfitBold:      "/fonts/Outfit-Bold.ttf",
} as const;

type FontKey = keyof typeof FONT_FILES;
let fontDataUrlCache: Partial<Record<FontKey, string>> | null = null;

async function fetchFontAsDataUrl(path: string): Promise<string> {
  const res = await fetch(path, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to fetch font ${path}`);
  const buf = await res.arrayBuffer();
  // base64 encode
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return `data:font/ttf;base64,${btoa(binary)}`;
}

async function getFontDataUrls(): Promise<Record<FontKey, string>> {
  if (fontDataUrlCache && Object.keys(fontDataUrlCache).length === Object.keys(FONT_FILES).length) {
    return fontDataUrlCache as Record<FontKey, string>;
  }
  const entries = await Promise.all(
    (Object.entries(FONT_FILES) as [FontKey, string][]).map(async ([k, p]) => {
      try { return [k, await fetchFontAsDataUrl(p)] as const; }
      catch { return [k, ""] as const; }
    })
  );
  fontDataUrlCache = Object.fromEntries(entries) as Record<FontKey, string>;
  return fontDataUrlCache as Record<FontKey, string>;
}

async function getFontBase64Map(): Promise<Record<FontKey, string>> {
  const dataUrls = await getFontDataUrls();
  return Object.fromEntries(
    Object.entries(dataUrls).map(([key, value]) => [key, value.split(",")[1] || ""])
  ) as Record<FontKey, string>;
}

function buildFontFaceCss(urls: Record<FontKey, string>): string {
  const face = (family: string, weight: string, url: string) =>
    url ? `@font-face{font-family:'${family}';src:url('${url}') format('truetype');font-weight:${weight};font-style:normal;font-display:block;}` : "";
  return [
    face("Outfit", "400", urls.outfitRegular),
    face("Outfit", "500", urls.outfitMedium),
    face("Outfit", "700 900", urls.outfitBold),
    face("Noto Kufi Arabic", "400", urls.notoKufiRegular),
    face("Noto Kufi Arabic", "500", urls.notoKufiMedium),
    face("Noto Kufi Arabic", "700 900", urls.notoKufiBold),
  ].join("\n");
}

async function registerFontsInDocument(doc: Document, urls: Record<FontKey, string>) {
  const anyDoc = doc as any;
  if (!anyDoc.fonts || typeof FontFace === "undefined") return;
  const defs: Array<[string, string, string]> = [
    ["Noto Kufi Arabic", "400", urls.notoKufiRegular],
    ["Noto Kufi Arabic", "500", urls.notoKufiMedium],
    ["Noto Kufi Arabic", "700", urls.notoKufiBold],
    ["Outfit", "400", urls.outfitRegular],
    ["Outfit", "500", urls.outfitMedium],
    ["Outfit", "700", urls.outfitBold],
  ];
  await Promise.all(defs.map(async ([family, weight, url]) => {
    if (!url) return;
    try {
      const ff = new (doc.defaultView as any).FontFace(family, `url(${url}) format('truetype')`, { weight, style: "normal", display: "block" });
      const loaded = await ff.load();
      anyDoc.fonts.add(loaded);
    } catch { /* noop */ }
  }));
  try { await anyDoc.fonts.ready; } catch { /* noop */ }
}

const PDF_COLORS = {
  ink: [34, 49, 39] as const,
  muted: [106, 120, 107] as const,
  line: [217, 226, 213] as const,
  soft: [246, 243, 236] as const,
  sage: [95, 126, 101] as const,
  gold: [168, 148, 86] as const,
};

const MM_PER_POINT = 0.352778;
const ARABIC_TEXT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

function normalizePdfText(value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || "—";
}

function hasArabicText(value: string) {
  return ARABIC_TEXT_RE.test(value);
}

function getPdfLineHeight(fontSize: number, factor = 1.45) {
  return fontSize * MM_PER_POINT * factor;
}

function normalizePdfLines(value: string | string[] | string[][]): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => Array.isArray(item) ? item.join(" ") : item);
  }
  return [value];
}

function preparePdfText(pdf: jsPDF, value: unknown, bold = false) {
  const text = normalizePdfText(value);
  const arabic = hasArabicText(text);
  pdf.setFont(arabic ? "NotoKufiArabic" : "Outfit", bold ? "bold" : "normal");
  pdf.setR2L(false);
  return {
    arabic,
    text,
  };
}

function splitPdfText(pdf: jsPDF, value: unknown, maxWidth: number, fontSize: number, bold = false) {
  pdf.setFontSize(fontSize);
  const prepared = preparePdfText(pdf, value, bold);
  const lines = normalizePdfLines(pdf.splitTextToSize(prepared.text, maxWidth));
  return { ...prepared, lines };
}

async function registerLeasePdfFonts(pdf: jsPDF) {
  const fonts = await getFontBase64Map();
  if (!fonts.notoKufiRegular || !fonts.notoKufiBold || !fonts.outfitRegular || !fonts.outfitBold) {
    throw new Error("تعذّر تحميل الخطوط المحلية اللازمة لإنشاء العقد PDF.");
  }

  pdf.addFileToVFS("NotoKufiArabic-Regular.ttf", fonts.notoKufiRegular);
  pdf.addFont("NotoKufiArabic-Regular.ttf", "NotoKufiArabic", "normal");
  pdf.addFileToVFS("NotoKufiArabic-Bold.ttf", fonts.notoKufiBold);
  pdf.addFont("NotoKufiArabic-Bold.ttf", "NotoKufiArabic", "bold");

  pdf.addFileToVFS("Outfit-Regular.ttf", fonts.outfitRegular);
  pdf.addFont("Outfit-Regular.ttf", "Outfit", "normal");
  pdf.addFileToVFS("Outfit-Bold.ttf", fonts.outfitBold);
  pdf.addFont("Outfit-Bold.ttf", "Outfit", "bold");
}

export interface BrandInfo {
  name: string;
  logo: string | null;
  phone: string;
  address: string;
  landlordName?: string;
  landlordNameEn?: string;
}

export interface ReceiptData {
  brand: BrandInfo;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  expectedAmount?: number | null;
  method?: string | null;
  periodLabel?: string | null;
  building?: string | null;
  unitNumber?: string | null;
  tenantName?: string | null;
  notes?: string | null;
  currency?: string | null;
  lang?: "ar" | "en";
  unpaidMonths?: Array<{ label: string; remaining: number }>;
  unpaidTotal?: number | null;
  unpaidUpToLabel?: string | null;
  settlementNote?: string | null;
  collectedArrears?: Array<{ label: string; amount: number }>;
  grandTotal?: number | null;
}

export interface Lease {
  brand: BrandInfo;
  building_name: string;
  unit_number: string;
  unit_type?: string | null;
  floor?: number | null;
  tenant_name: string;
  tenant_name_en?: string | null;
  tenant_phone?: string | null;
  tenant_id_number?: string | null;
  rent_amount: number;
  rent_type?: string | null;
  contract_type?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  due_day?: number | null;
  security_deposit?: number | null;
  currency?: string | null;
  lang?: "ar" | "en";
  // Optional Omani / municipality fields
  contract_number?: string | null;
  governorate?: string | null;       // المحافظة (e.g. ظفار)
  municipality?: string | null;      // البلدية (e.g. بلدية ظفار)
  wilayat?: string | null;           // الولاية
  block?: string | null;             // المربع
  plot_no?: string | null;           // رقم القطعة
  street?: string | null;            // الشارع
  building_no?: string | null;       // رقم المبنى
  flat_no?: string | null;           // رقم الشقة
  use_type?: string | null;          // نوع الاستعمال (سكني/تجاري...)
  activities?: string | null;        // الأنشطة
  landlord_id?: string | null;       // رقم البطاقة/الجواز للمؤجر
  landlord_nationality?: string | null;
  tenant_nationality?: string | null;
  electricity_account?: string | null;
}


export interface StatementRow {
  date: string;
  month?: string;
  description: string;
  charge: number;
  payment: number;
  balance: number;
}

export interface TenantStatementData {
  brand: BrandInfo;
  currency?: string | null;
  generatedAt?: string | null;
  tenantName: string;
  tenantNameEn?: string | null;
  tenantPhone?: string | null;
  building?: string | null;
  unitNumber?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  rentAmount?: number | null;
  rentType?: string | null;
  rows: StatementRow[];
  totals: {
    totalCharges: number;
    totalPaid: number;
    outstanding: number;
    openingBalance?: number;
    securityDeposit?: number;
  };
}

export interface ReportData {
  brand: BrandInfo;
  currency: string;
  rangeMonths: number;
  generatedAt: string;
  totals: {
    income: number;
    expenses: number;
    net: number;
    buildings: number;
    units: number;
    rented: number;
    vacant: number;
    late: number;
    occupancy: number;
    collectionRate: number;
  };
  monthly: Array<{
    label: string;
    income: number;
    expenses: number;
    net: number;
  }>;
  buildings: Array<{
    name: string;
    units: number;
    rented: number;
    vacant: number;
    expectedMonthly: number;
    income: number;
    expenses: number;
  }>;
}

export interface CollectionRow {
  tenant: string;
  building: string;
  unit: string;
  rent: number;
  paid: number;
  remaining: number;
  status: "paid" | "partial" | "unpaid";
  overdueMonths?: number;
  lastDate?: string;
}
export interface CollectionPdfData {
  brand: BrandInfo;
  currency: string;
  lang?: "ar" | "en";
  monthLabel: string;
  generatedAt: string;
  totals: {
    expected: number;
    collected: number;
    remaining: number;
    rate: number;
    paidCount: number;
    lateCount: number;
  };
  vsLastMonth?: { rateDelta: number; collectedDelta: number } | null;
  late: CollectionRow[];
  paid: CollectionRow[];
}

type PdfSettings = Pick<AppSettings, "pageSize" | "margins"> | { pageSize?: PageSize; margins?: Margins };

const DEFAULT_MARGINS: Margins = { top: 16, right: 16, bottom: 16, left: 16 };
const DEFAULT_PAGE_SIZE: PageSize = "A4";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (value: number | null | undefined, currency?: string | null) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;
};

const formatDate = (value?: string | null, rtl = false) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);
  // Use Western digits in both locales for clarity in contracts
  return d.toLocaleDateString(rtl ? "ar-OM-u-nu-latn" : "en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const RENT_TYPE_AR: Record<string, string> = { monthly: "شهري", yearly: "سنوي", daily: "يومي", weekly: "أسبوعي" };
const CONTRACT_TYPE_AR: Record<string, string> = { yearly: "سنوي", monthly: "شهري", "open-ended": "غير محدد المدة", openended: "غير محدد المدة" };
const UNIT_TYPE_AR: Record<string, string> = {
  apartment: "شقة", studio: "استوديو", shop: "محل تجاري", office: "مكتب",
  villa: "فيلا", warehouse: "مستودع", room: "غرفة", land: "أرض",
};
const arOr = (map: Record<string, string>, v?: string | null) => (v ? (map[v.toLowerCase()] || v) : "—");

const amountInArabicWords = (_n: number) => ""; // placeholder; kept for future use

const pageShell = (title: string, body: string, options?: { rtl?: boolean }) => `<!doctype html>
<html lang="${options?.rtl ? "ar" : "en"}" dir="${options?.rtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style id="pdf-fonts">/* fonts injected at render time */</style>
    <style>
      :root {
        color-scheme: light;
        --ink: #223127;
        --muted: #6a786b;
        --line: #d9e2d5;
        --soft: #f6f3ec;
        --card: #ffffff;
        --primary: #5f7e65;
        --accent: #a89456;
        --danger: #a85d5d;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #eef2eb; }
      body {
        font-family: ${options?.rtl ? `"Noto Kufi Arabic", "Noto Naskh Arabic", "Segoe UI", Tahoma, Arial, sans-serif` : `"Outfit", "Inter", "Segoe UI", Tahoma, Arial, sans-serif`};
        color: var(--ink);
        padding: 24px;
        font-feature-settings: "kern", "liga", "calt";
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      :lang(ar), [lang="ar"], [dir="rtl"] {
        font-family: "Noto Kufi Arabic", "Noto Naskh Arabic", "Segoe UI", Tahoma, Arial, sans-serif;
        font-feature-settings: "kern", "liga", "calt";
      }
      .page {
        width: 794px;
        margin: 0 auto;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 18px 50px rgba(95, 126, 101, 0.12);
      }
      .header {
        padding: 28px 32px 20px;
        background: linear-gradient(180deg, #f7f3ea 0%, #ffffff 100%);
        border-bottom: 1px solid var(--line);
        display: flex;
        gap: 20px;
        align-items: center;
        justify-content: space-between;
      }
      .brand {
        display: flex;
        gap: 16px;
        align-items: center;
      }
      .brand img {
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: white;
      }
      .logo-fallback {
        width: 60px;
        height: 60px;
        border-radius: 16px;
        display: grid;
        place-items: center;
        background: #eef3eb;
        color: var(--primary);
        border: 1px solid var(--line);
        font-weight: 800;
        font-size: 18px;
      }
      h1, h2, h3, p { margin: 0; }
      .title { font-size: 28px; font-weight: 800; }
      .subtitle { margin-top: 6px; color: var(--muted); font-size: 13px; }
      .meta {
        text-align: ${options?.rtl ? "left" : "right"};
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }
      .content { padding: 28px 32px 32px; }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .card {
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px;
      }
      .label {
        color: var(--muted);
        font-size: 12px;
        margin-bottom: 6px;
      }
      .value {
        font-size: 16px;
        font-weight: 700;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }
      .section-title {
        font-size: 17px;
        font-weight: 800;
        margin: 26px 0 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        background: white;
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }
      th, td {
        padding: 12px 10px;
        border-bottom: 1px solid var(--line);
        text-align: ${options?.rtl ? "right" : "left"};
        vertical-align: top;
      }
      th {
        background: #f4f7f2;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }
      tr:last-child td { border-bottom: 0; }
      .summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 16px;
      }
      .summary .card { background: white; }
      .amount-positive { color: var(--primary); font-weight: 800; }
      .amount-negative { color: var(--danger); font-weight: 800; }
      .footer {
        padding: 18px 32px 26px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 12px;
      }
      .note {
        margin-top: 14px;
        padding: 14px 16px;
        border-radius: 16px;
        background: #fffaf0;
        border: 1px solid #eadfbe;
        font-size: 13px;
        line-height: 1.7;
      }
      .pill {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(168, 148, 86, 0.12);
        color: #7b6931;
        font-size: 12px;
        font-weight: 700;
      }
      @media print {
        body { background: white; padding: 0; }
        .page { width: auto; margin: 0; box-shadow: none; border-radius: 0; border: 0; }
      }
    </style>
  </head>
  <body>
    <div class="page">${body}</div>
  </body>
</html>`;

const brandBlock = (brand: BrandInfo, title: string, subtitle?: string | null, meta?: string) => `
  <div class="header">
    <div class="brand">
      ${brand.logo ? `<img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(brand.name)} logo" />` : `<div class="logo-fallback">${escapeHtml((brand.name || "A").trim().slice(0, 1))}</div>`}
      <div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle || brand.name || "")}</p>
      </div>
    </div>
    <div class="meta">
      ${meta || ""}
    </div>
  </div>
`;

export function buildReceiptHTML(data: ReceiptData): string {
  const rtl = data.lang === "ar";
  const partial = data.expectedAmount && data.amount < data.expectedAmount;
  const L = (ar: string, en: string) => (rtl ? ar : en);
  const unpaidRows = (data.unpaidMonths || [])
    .map(
      (m) => `<tr><td>${escapeHtml(m.label)}</td><td>${escapeHtml(formatMoney(m.remaining, data.currency))}</td></tr>`
    )
    .join("");
  const amountStr = formatMoney(data.amount, data.currency);
  const dateStr = formatDate(data.paymentDate, rtl);
  const periodHtml = `<bdi>${escapeHtml(data.periodLabel || "—")}</bdi>`;
  const intro = L(
    `استلمنا من السيد/ة <strong>${escapeHtml(data.tenantName || "—")}</strong> مبلغاً وقدره <strong>${escapeHtml(amountStr)}</strong> وذلك بدل إيجار الوحدة رقم <strong>${escapeHtml(data.unitNumber || "—")}</strong> بمبنى <strong>${escapeHtml(data.building || "—")}</strong> عن فترة <strong>${periodHtml}</strong> بتاريخ <strong>${escapeHtml(dateStr)}</strong>.`,
    `Received from <strong>${escapeHtml(data.tenantName || "—")}</strong> the sum of <strong>${escapeHtml(amountStr)}</strong> as rent for unit <strong>${escapeHtml(data.unitNumber || "—")}</strong> at <strong>${escapeHtml(data.building || "—")}</strong>, for the period <strong>${periodHtml}</strong>, on <strong>${escapeHtml(dateStr)}</strong>.`
  );
  const body = `
    ${brandBlock(
      data.brand,
      L("سند استلام إيجار", "Rent Receipt"),
      data.brand.name,
      `<div>${L("رقم السند", "Receipt no.")}: ${escapeHtml(data.receiptNumber)}</div><div>${L("التاريخ", "Date")}: ${escapeHtml(dateStr)}</div>`
    )}
    <div class="content">
      <p style="font-size:13px; line-height:2; margin-bottom:18px; color:var(--ink);">${intro}</p>
      <div class="grid">
        <div class="card"><div class="label">${L("المبنى", "Building")}</div><div class="value">${escapeHtml(data.building || "—")}</div></div>
        <div class="card"><div class="label">${L("رقم الوحدة", "Unit")}</div><div class="value">${escapeHtml(data.unitNumber || "—")}</div></div>
        <div class="card"><div class="label">${L("اسم المستأجر", "Tenant")}</div><div class="value">${escapeHtml(data.tenantName || "—")}</div></div>
        <div class="card"><div class="label">${L("طريقة السداد", "Method")}</div><div class="value">${escapeHtml(data.method || "—")}</div></div>
        <div class="card"><div class="label">${L("المبلغ المستلم", "Amount paid")}</div><div class="value amount-positive">${escapeHtml(amountStr)}</div></div>
        <div class="card"><div class="label">${L("عن فترة الإيجار", "Rent period")}</div><div class="value">${periodHtml}</div></div>
      </div>
      ${data.settlementNote ? `<div class="note" style="background:#eef5ec;border-color:#cfe0ce;color:#2c5a36;"><strong>${L("إشعار سداد", "Settlement notice")}:</strong> ${escapeHtml(data.settlementNote)}</div>` : ""}
      ${(data.collectedArrears && data.collectedArrears.length) ? `
        <div class="section-title">${L("تفاصيل التحصيل", "Collection breakdown")}</div>
        <table>
          <thead><tr><th>${L("البند", "Item")}</th><th>${L("المبلغ", "Amount")}</th></tr></thead>
          <tbody>
            <tr><td>${L("إيجار", "Rent")} — ${periodHtml}</td><td>${escapeHtml(formatMoney(data.amount - (data.collectedArrears.reduce((s,a)=>s+a.amount,0)), data.currency))}</td></tr>
            ${data.collectedArrears.map(a => `<tr><td>${L("متأخرات", "Arrears")} — ${escapeHtml(a.label)}</td><td>${escapeHtml(formatMoney(a.amount, data.currency))}</td></tr>`).join("")}
            <tr style="font-weight:800;background:#f5f0e0;"><td>${L("الإجمالي المحصَّل", "Total collected")}</td><td class="amount-positive">${escapeHtml(formatMoney(data.grandTotal ?? data.amount, data.currency))}</td></tr>
          </tbody>
        </table>
      ` : ""}
      ${!data.settlementNote && data.expectedAmount ? `<div class="note">${L("الإيجار المتوقع للفترة", "Expected rent")}: <strong>${escapeHtml(formatMoney(data.expectedAmount, data.currency))}</strong>${partial ? ` — <span class="pill">${L("دفعة جزئية", "Partial payment")}</span>` : ""}</div>` : ""}
      ${unpaidRows ? `
        <div class="section-title">${L("الأشهر غير المسدّدة على المستأجر", "Remaining unpaid months")}</div>
        <table>
          <thead><tr><th>${L("الشهر", "Month")}</th><th>${L("المبلغ المتبقي", "Remaining amount")}</th></tr></thead>
          <tbody>${unpaidRows}</tbody>
        </table>
        ${data.unpaidTotal != null ? `<div class="note"><strong>${L("إجمالي المتأخرات", "Total outstanding")}${data.unpaidUpToLabel ? ` ${L("حتى نهاية", "through")} ${escapeHtml(data.unpaidUpToLabel)}` : ""}:</strong> <span class="amount-negative">${escapeHtml(formatMoney(data.unpaidTotal, data.currency))}</span></div>` : ""}
      ` : (data.unpaidTotal != null && !data.settlementNote ? `<div class="note"><strong>${L("إجمالي المتأخرات", "Total outstanding")}${data.unpaidUpToLabel ? ` ${L("حتى نهاية", "through")} ${escapeHtml(data.unpaidUpToLabel)}` : ""}:</strong> <span class="amount-positive">${escapeHtml(formatMoney(data.unpaidTotal, data.currency))}</span></div>` : "")}
      ${data.notes ? `<div class="section-title">${L("ملاحظات", "Notes")}</div><div class="card"><div class="value">${escapeHtml(data.notes)}</div></div>` : ""}

      <div style="margin-top:32px; display:flex; justify-content:space-between; gap:24px;">
        <div style="flex:1;">
          <div style="border-top:1px dashed var(--line); padding-top:8px; text-align:center; color:var(--muted); font-size:12px;">${L("توقيع المستلم", "Recipient signature")}</div>
        </div>
        <div style="flex:1;">
          <div style="border-top:1px dashed var(--line); padding-top:8px; text-align:center; color:var(--muted); font-size:12px;">${L("ختم المؤسسة", "Company stamp")}</div>
        </div>
      </div>
    </div>
    <div class="footer">
      <div>${escapeHtml(data.brand.phone || "")}</div>
      <div>${escapeHtml(data.brand.address || "")}</div>
      <div style="margin-top:6px; font-style:italic;">${L("يُعدّ هذا السند إثباتاً لاستلام المبلغ المذكور أعلاه.", "This receipt confirms the amount received above.")}</div>
    </div>
  `;

  return pageShell(L("سند استلام إيجار", "Rent Receipt"), body, { rtl });
}

export function buildLeaseHTML(data: Lease): string {
  const rtl = data.lang === "ar";
  const L = (ar: string, en: string) => (rtl ? ar : en);
  const landlordLine = [data.brand.landlordName, data.brand.landlordNameEn].filter(Boolean).join(" / ") || data.brand.name;
  const rentTypeLabel = rtl ? arOr(RENT_TYPE_AR, data.rent_type) : (data.rent_type || "—");
  const contractTypeLabel = rtl ? arOr(CONTRACT_TYPE_AR, data.contract_type) : (data.contract_type || "—");
  const unitTypeLabel = rtl ? arOr(UNIT_TYPE_AR, data.unit_type) : (data.unit_type || "—");
  const rentMoney = formatMoney(data.rent_amount, data.currency);
  const depositMoney = formatMoney(data.security_deposit || 0, data.currency);
  const startDate = formatDate(data.contract_start_date, rtl);
  const endDate = formatDate(data.contract_end_date, rtl);
  const dueDay = data.due_day != null ? String(data.due_day) : "—";

  const clausesAr = `
    <ol style="padding-inline-start:22px; line-height:2; margin:0;">
      <li>أقرّ الطرف الثاني (المستأجر) باستلامه الوحدة المؤجَّرة بحالةٍ جيدةٍ صالحةٍ للاستعمال المتفق عليه.</li>
      <li>قيمة الإيجار <strong>${escapeHtml(rentMoney)}</strong> تُسدَّد <strong>${escapeHtml(rentTypeLabel)}</strong> في موعدٍ أقصاه يوم <strong>${escapeHtml(dueDay)}</strong> من كل دورة استحقاق.</li>
      <li>مدّة العقد من <strong>${escapeHtml(startDate)}</strong> وحتى <strong>${escapeHtml(endDate)}</strong>، وهو من نوع <strong>${escapeHtml(contractTypeLabel)}</strong>.</li>
      <li>قام المستأجر بدفع وديعة تأمين قدرها <strong>${escapeHtml(depositMoney)}</strong> تُردّ عند انتهاء العقد بعد التحقق من سلامة الوحدة وسداد جميع المستحقات.</li>
      <li>يلتزم المستأجر باستخدام الوحدة للغرض المتفق عليه فقط، والمحافظة عليها، وعدم إجراء أي تعديلاتٍ إنشائيةٍ دون إذنٍ خطيٍّ من المؤجِّر.</li>
      <li>يتحمّل المستأجر فواتير الخدمات (الكهرباء، المياه، الإنترنت، الغاز) ما لم يُتَّفق على خلاف ذلك كتابةً.</li>
      <li>لا يحقّ للمستأجر تأجير الوحدة من الباطن أو التنازل عن العقد للغير إلا بموافقةٍ خطيةٍ مسبقةٍ من المؤجِّر.</li>
      <li>في حال التأخّر عن السداد لأكثر من <strong>15</strong> يوماً من تاريخ الاستحقاق، يحقّ للمؤجِّر اتخاذ الإجراءات النظامية المقررة.</li>
      <li>عند رغبة أحد الطرفين في إنهاء العقد قبل انتهاء مدّته، يجب إشعار الطرف الآخر كتابةً قبل <strong>30</strong> يوماً على الأقل.</li>
      <li>يخضع هذا العقد لأحكام قانون إيجار المباني المعمول به، وتختص المحاكم المختصة بالنظر في أي نزاعٍ ينشأ عن تفسيره أو تنفيذه.</li>
      <li>حُرِّر هذا العقد من نسختين أصليّتين، بيد كلِّ طرفٍ نسخةٌ للعمل بموجبها عند الحاجة.</li>
    </ol>`;

  const clausesEn = `
    <ol style="padding-inline-start:22px; line-height:2; margin:0;">
      <li>The Tenant acknowledges receipt of the leased unit in good condition, fit for the agreed use.</li>
      <li>Rent of <strong>${escapeHtml(rentMoney)}</strong> is payable <strong>${escapeHtml(rentTypeLabel)}</strong>, no later than day <strong>${escapeHtml(dueDay)}</strong> of each due cycle.</li>
      <li>Lease term runs from <strong>${escapeHtml(startDate)}</strong> to <strong>${escapeHtml(endDate)}</strong> (<strong>${escapeHtml(contractTypeLabel)}</strong>).</li>
      <li>A security deposit of <strong>${escapeHtml(depositMoney)}</strong> has been paid and is refundable at lease end, subject to inspection and settlement of dues.</li>
      <li>The Tenant shall use the unit solely for the agreed purpose, maintain it, and shall make no structural alterations without the Landlord's written consent.</li>
      <li>Utilities (electricity, water, internet, gas) are payable by the Tenant unless otherwise agreed in writing.</li>
      <li>The Tenant may not sublet or assign this lease without prior written approval of the Landlord.</li>
      <li>Failure to pay rent for more than <strong>15</strong> days past the due date entitles the Landlord to pursue available legal remedies.</li>
      <li>Either party wishing to terminate before the end of the term must give the other party at least <strong>30</strong> days' written notice.</li>
      <li>This agreement is governed by the applicable tenancy law; competent courts shall have jurisdiction over any dispute.</li>
      <li>Executed in two original counterparts, one for each party.</li>
    </ol>`;

  const body = `
    ${brandBlock(
      data.brand,
      L("عقد إيجار", "Lease Agreement"),
      landlordLine,
      `<div>${escapeHtml(data.building_name || "—")}</div><div>${escapeHtml(data.unit_number || "—")}</div><div>${escapeHtml(startDate)}</div>`
    )}
    <div class="content">
      <p style="font-size:13px; line-height:2; margin-bottom:18px; color:var(--muted);">
        ${L(
          `إنه في يوم <strong>${escapeHtml(startDate)}</strong> تمّ الاتفاق بين كلٍّ من المؤجِّر <strong>${escapeHtml(landlordLine)}</strong> (الطرف الأول)، والمستأجر <strong>${escapeHtml(data.tenant_name || "—")}</strong> (الطرف الثاني)، على تأجير الوحدة الموضّحة بياناتها أدناه وفق الشروط والبنود التالية:`,
          `On <strong>${escapeHtml(startDate)}</strong>, this agreement is made between the Landlord <strong>${escapeHtml(landlordLine)}</strong> (First Party) and the Tenant <strong>${escapeHtml(data.tenant_name || "—")}</strong> (Second Party) for the lease of the unit described below, subject to the following terms:`
        )}
      </p>
      <div class="section-title">${L("بيانات الوحدة والمستأجر", "Unit & Tenant Details")}</div>
      <div class="grid">
        <div class="card"><div class="label">${L("اسم المستأجر", "Tenant name")}</div><div class="value">${escapeHtml(data.tenant_name || "—")}</div></div>
        <div class="card"><div class="label">${L("رقم الهاتف", "Phone")}</div><div class="value">${escapeHtml(data.tenant_phone || "—")}</div></div>
        <div class="card"><div class="label">${L("رقم الهوية / السجل المدني", "ID number")}</div><div class="value">${escapeHtml(data.tenant_id_number || "—")}</div></div>
        <div class="card"><div class="label">${L("نوع الوحدة", "Unit type")}</div><div class="value">${escapeHtml(unitTypeLabel)}</div></div>
        <div class="card"><div class="label">${L("الطابق", "Floor")}</div><div class="value">${escapeHtml(data.floor ?? "—")}</div></div>
        <div class="card"><div class="label">${L("نوع الإيجار", "Rent type")}</div><div class="value">${escapeHtml(rentTypeLabel)}</div></div>
        <div class="card"><div class="label">${L("قيمة الإيجار", "Rent amount")}</div><div class="value amount-positive">${escapeHtml(rentMoney)}</div></div>
        <div class="card"><div class="label">${L("وديعة التأمين", "Security deposit")}</div><div class="value">${escapeHtml(depositMoney)}</div></div>
        <div class="card"><div class="label">${L("بداية العقد", "Contract start")}</div><div class="value">${escapeHtml(startDate)}</div></div>
        <div class="card"><div class="label">${L("نهاية العقد", "Contract end")}</div><div class="value">${escapeHtml(endDate)}</div></div>
        <div class="card"><div class="label">${L("يوم استحقاق الإيجار", "Due day")}</div><div class="value">${escapeHtml(dueDay)}</div></div>
        <div class="card"><div class="label">${L("نوع العقد", "Contract type")}</div><div class="value">${escapeHtml(contractTypeLabel)}</div></div>
      </div>

      <div class="section-title">${L("شروط وبنود العقد", "Terms & Conditions")}</div>
      ${rtl ? clausesAr : clausesEn}

      <div class="section-title">${L("توقيع الأطراف", "Signatures")}</div>
      <table>
        <thead>
          <tr>
            <th>${L("الطرف", "Party")}</th>
            <th>${L("الاسم", "Name")}</th>
            <th>${L("بيانات التواصل", "Contact")}</th>
            <th>${L("التوقيع", "Signature")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${L("المؤجِّر (الطرف الأول)", "Landlord (First Party)")}</td>
            <td>${escapeHtml(landlordLine || "—")}</td>
            <td>${escapeHtml(data.brand.phone || data.brand.address || "—")}</td>
            <td style="height:48px;">&nbsp;</td>
          </tr>
          <tr>
            <td>${L("المستأجر (الطرف الثاني)", "Tenant (Second Party)")}</td>
            <td>${escapeHtml([data.tenant_name, data.tenant_name_en].filter(Boolean).join(" / ") || data.tenant_name || "—")}</td>
            <td>${escapeHtml(data.tenant_id_number || data.tenant_phone || "—")}</td>
            <td style="height:48px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="footer">${escapeHtml(data.brand.address || "")}</div>
  `;

  return pageShell(L("عقد إيجار", "Lease Agreement"), body, { rtl });
}

// =============================================================
// Omani lease (Royal Decree 89/6) — bilingual official-style form
// =============================================================

export function buildOmaniLeaseHTML(data: Lease): string {
  const startDate = formatDate(data.contract_start_date, true);
  const endDate = formatDate(data.contract_end_date, true);
  const today = formatDate(new Date().toISOString().slice(0, 10), true);
  const landlordAr = [data.brand.landlordName, data.brand.landlordNameEn].filter(Boolean).join(" / ") || data.brand.name || "—";
  const tenantAr = [data.tenant_name, data.tenant_name_en].filter(Boolean).join(" / ") || data.tenant_name || "—";
  const rent = Number(data.rent_amount || 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
  const rentPeriodAr = data.rent_type === "yearly" ? "كل سنة" : data.rent_type === "weekly" ? "كل أسبوع" : data.rent_type === "daily" ? "كل يوم" : "كل شهر";
  const rentPeriodEn = data.rent_type === "yearly" ? "every year" : data.rent_type === "weekly" ? "every week" : data.rent_type === "daily" ? "every day" : "every month";
  const useTypeAr = data.use_type || (data.unit_type ? arOr(UNIT_TYPE_AR, data.unit_type) : "سكني");

  const dash = "—";
  const v = (x?: string | number | null) => {
    const s = String(x ?? "").trim();
    return s || dash;
  };

  const articles: Array<{ ar: string; en: string; n: number; ar_title: string; en_title: string }> = [
    {
      n: 4,
      ar_title: "البند الرابع",
      en_title: "Article (4)",
      ar: "يلتزم الطرف الثاني بسداد قيمة استهلاك الكهرباء والماء والهاتف والصرف الصحي وأية رسوم أخرى يلتزم بأدائها قانوناً، وذلك اعتباراً من تاريخ استلام المحل المؤجَّر حتى تاريخ إعادة تسليمه إلى الطرف الأول ما لم يُتَّفق على غير ذلك.",
      en: "The second party shall pay all electricity, water, telephone, sewage and any other legally-required fees, from the date of receiving the leased premises until handing them back to the first party, unless otherwise agreed.",
    },
    {
      n: 5,
      ar_title: "البند الخامس",
      en_title: "Article (5)",
      ar: "يلتزم الطرف الأول بإجراء الترميمات وأعمال الصيانة اللازمة لبقاء المحل المؤجَّر صالحاً لتحقيق الغرض المؤجَّر من أجله.",
      en: "The first party shall undertake all necessary renovation and maintenance to keep the leased premises fit for the purpose of the lease.",
    },
    {
      n: 6,
      ar_title: "البند السادس",
      en_title: "Article (6)",
      ar: "يلتزم الطرف الثاني بتسليم المحل المؤجَّر إلى الطرف الأول عند انتهاء العقد، ويلتزم بإصلاح أي تلفٍ في المحل المؤجَّر ناتج عن سوء الاستعمال.",
      en: "The second party shall hand over the leased premises to the first party upon expiry of the lease and shall repair any damage caused by misuse.",
    },
    {
      n: 7,
      ar_title: "البند السابع",
      en_title: "Article (7)",
      ar: "تسري أحكام المرسوم السلطاني رقم 6/89 وتعديلاته المشار إليه فيما لم يرد بشأنه نصٌّ في هذا العقد.",
      en: "The provisions of Royal Decree No. 6/89 and its amendments shall apply to any matter not provided for herein.",
    },
    {
      n: 8,
      ar_title: "البند الثامن",
      en_title: "Article (8)",
      ar: "لا يجوز للمؤجِّر زيادة أجرة المحال التجارية والسكنية والصناعية إلا بعد ثلاث سنوات من تاريخ آخر زيادة متفقٍ عليها، ما لم يُتَّفق على غير ذلك.",
      en: "The lessor shall not increase the rent of commercial, residential or industrial premises except after three years from the last agreed increase, unless agreed otherwise.",
    },
    {
      n: 9,
      ar_title: "البند التاسع",
      en_title: "Article (9)",
      ar: "لا يجوز للمؤجِّر إخراج المستأجر من المحل المؤجَّر إلا للأسباب المنصوص عليها قانوناً.",
      en: "The lessor may not evict the tenant from the leased premises except for the reasons stipulated by law.",
    },
    {
      n: 10,
      ar_title: "البند العاشر",
      en_title: "Article (10)",
      ar: "يحرَّر هذا العقد من ثلاث نسخ، تُسلَّم نسخةٌ للمؤجِّر، ونسخةٌ للمستأجر، وتودع النسخة الثالثة لدى البلدية المختصة لتسجيلها.",
      en: "This contract is made in three counterparts: one for the lessor, one for the lessee, and the third deposited with the competent Municipality for registration.",
    },
    {
      n: 11,
      ar_title: "البند الحادي عشر",
      en_title: "Article (11)",
      ar: "يترتَّب على عدم تسجيل عقد الإيجار وسداد الرسم المقرَّر خلال شهرٍ من تاريخ إبرامه عدم جواز الاعتداد بهذا العقد أمام أي جهةٍ رسميةٍ في السلطنة، بالإضافة إلى دفع غرامةٍ ماليةٍ تعادل ثلاثة أضعاف الرسم المقرَّر.",
      en: "Failure to register the lease and pay the prescribed fee within one month from its execution renders the contract inadmissible before any official authority in the Sultanate, in addition to a fine equal to three times the prescribed fee.",
    },
    {
      n: 12,
      ar_title: "البند الثاني عشر",
      en_title: "Article (12)",
      ar: "لا يجوز للمستأجر أن يحوِّل عقد الإيجار إلى أي جهةٍ أخرى، كما يحظر عليه أن يؤجِّر المحل المؤجَّر من الباطن إلا بعد الحصول على موافقةٍ كتابيةٍ من المؤجِّر، باستثناء المحال التجارية والصناعية والمهنية فإنه يجوز التنازل عنها شاملاً عقد الإيجار.",
      en: "The lessee may not assign the lease to a third party nor sublet the premises without the lessor's prior written approval, except commercial, industrial and occupational premises which may be transferred along with the lease.",
    },
    {
      n: 13,
      ar_title: "البند الثالث عشر",
      en_title: "Article (13)",
      ar: "بدء عقد الإيجار: التاريخ الذي تُفتتح به العلاقة الإيجارية بين المؤجِّر والمستأجر بموجب العقد المبرم بينهما ابتداءً، لا بموجب التجديد الدوري الذي يتم تسجيله لدى البلدية.",
      en: "Lease commencement date is the date the lease relationship initially started between the parties, not the periodic renewal date registered with the Municipality.",
    },
    {
      n: 14,
      ar_title: "البند الرابع عشر",
      en_title: "Article (14)",
      ar: "يجوز للطرفين إضافة شروطٍ أخرى تُعتبر جزءاً لا يتجزأ من هذا العقد، تُقرأ وتُفسَّر معه بشرط ألا تتعارض مع الأحكام المنظِّمة للعلاقة الإيجارية.",
      en: "The parties may add further clauses which shall form an integral part of this contract, read and construed together with it, provided they do not conflict with the governing tenancy provisions.",
    },
  ];

  const articleBlock = (a: typeof articles[number]) => `
    <div class="om-article">
      <div class="om-art-head"><span>${a.en_title}</span><span>${a.ar_title}</span></div>
      <div class="om-art-body">
        <div class="om-en">${escapeHtml(a.en)}</div>
        <div class="om-ar">${escapeHtml(a.ar)}</div>
      </div>
    </div>`;

  const body = `
    <div class="om-page">
      <div class="om-banner">
        <div class="om-banner-ar">
          <div class="om-country">سلطنة عُمان</div>
          <div class="om-gov">${escapeHtml(data.governorate ? "محافظة " + data.governorate : "محافظة …")}</div>
          <div class="om-muni">${escapeHtml(data.municipality || "البلدية المختصة")}</div>
        </div>
        <div class="om-banner-mid">
          <div class="om-title">عقد إيجار<br/><span>محل سكني / تجاري / صناعي / مهني</span></div>
          <div class="om-title-en">Lease Agreement — Residential / Commercial / Industrial / Occupational</div>
        </div>
        <div class="om-banner-en">
          <div class="om-contract-no">${escapeHtml("رقم العقد: " + (data.contract_number || "—"))}</div>
          <div class="om-date">${escapeHtml("تاريخ التحرير: " + today)}</div>
        </div>
      </div>

      <p class="om-intro">
        <span class="ar">إنه في تاريخ <strong>${escapeHtml(today)}</strong> تم الاتفاق بين كلٍّ من:</span>
        <span class="en">This agreement is made on <strong>${escapeHtml(today)}</strong> between:</span>
      </p>

      <div class="om-party">
        <div class="om-party-head">
          <span class="ar"><strong>أولاً:</strong> المؤجِّر أو من ينوب عنه <em>(الطرف الأول)</em></span>
          <span class="en"><strong>First:</strong> Lessor or his representative <em>(First Party)</em></span>
        </div>
        <div class="om-party-name">${escapeHtml(landlordAr)}</div>
        <div class="om-party-grid">
          <div><span class="lbl">الجنسية / Nationality</span><span class="val">${escapeHtml(v(data.landlord_nationality || "عمان"))}</span></div>
          <div><span class="lbl">رقم الهاتف / Phone</span><span class="val">${escapeHtml(v(data.brand.phone))}</span></div>
          <div><span class="lbl">رقم البطاقة / ID</span><span class="val">${escapeHtml(v(data.landlord_id))}</span></div>
          <div><span class="lbl">العنوان / Address</span><span class="val">${escapeHtml(v(data.brand.address))}</span></div>
        </div>
      </div>

      <div class="om-party">
        <div class="om-party-head">
          <span class="ar"><strong>ثانياً:</strong> المستأجر أو من ينوب عنه <em>(الطرف الثاني)</em></span>
          <span class="en"><strong>Second:</strong> Lessee <em>(Second Party)</em></span>
        </div>
        <div class="om-party-name">${escapeHtml(tenantAr)}</div>
        <div class="om-party-grid">
          <div><span class="lbl">الجنسية / Nationality</span><span class="val">${escapeHtml(v(data.tenant_nationality))}</span></div>
          <div><span class="lbl">رقم الهاتف / Phone</span><span class="val">${escapeHtml(v(data.tenant_phone))}</span></div>
          <div><span class="lbl">رقم البطاقة أو الجواز / ID or Passport</span><span class="val">${escapeHtml(v(data.tenant_id_number))}</span></div>
          <div><span class="lbl">حساب الكهرباء / Electricity Account</span><span class="val">${escapeHtml(v(data.electricity_account))}</span></div>
        </div>
      </div>

      <p class="om-intro"><span class="ar">على الآتي:</span><span class="en">And agreed upon the following:</span></p>

      <div class="om-article">
        <div class="om-art-head"><span>Article (1)</span><span>البند الأول</span></div>
        <div class="om-art-body">
          <div class="om-en">The first party leases to the second party the premises located in wilayat <strong>${escapeHtml(v(data.wilayat))}</strong>, block <strong>${escapeHtml(v(data.block))}</strong>, plot <strong>${escapeHtml(v(data.plot_no))}</strong>, street <strong>${escapeHtml(v(data.street))}</strong>, building <strong>${escapeHtml(v(data.building_no || data.building_name))}</strong>, flat <strong>${escapeHtml(v(data.flat_no || data.unit_number))}</strong>, type of use: <strong>${escapeHtml(v(useTypeAr))}</strong>${data.activities ? `, activities: <strong>${escapeHtml(data.activities)}</strong>` : ""}.</div>
          <div class="om-ar">أجَّر الطرف الأول إلى الطرف الثاني المحلَّ الكائن في ولاية <strong>${escapeHtml(v(data.wilayat))}</strong>، المربع <strong>${escapeHtml(v(data.block))}</strong>، رقم القطعة <strong>${escapeHtml(v(data.plot_no))}</strong>، الشارع <strong>${escapeHtml(v(data.street))}</strong>، رقم المبنى <strong>${escapeHtml(v(data.building_no || data.building_name))}</strong>، رقم الشقة <strong>${escapeHtml(v(data.flat_no || data.unit_number))}</strong>، نوع الاستعمال: <strong>${escapeHtml(v(useTypeAr))}</strong>${data.activities ? `، الأنشطة: <strong>${escapeHtml(data.activities)}</strong>` : ""}.</div>
        </div>
      </div>

      <div class="om-article">
        <div class="om-art-head"><span>Article (2)</span><span>البند الثاني</span></div>
        <div class="om-art-body">
          <div class="om-en">The lease shall be valid for a period starting from <strong>${escapeHtml(startDate)}</strong> and expiring on <strong>${escapeHtml(endDate)}</strong>, and shall be renewed spontaneously in accordance with Royal Decree No. (6/89) and its amendments, unless the lessee notifies the lessor in writing of his intention to vacate the premises at least three months prior to the expiry of the lease.</div>
          <div class="om-ar">يسري عقد الإيجار لمدةٍ تبدأ من <strong>${escapeHtml(startDate)}</strong> وتنتهي في <strong>${escapeHtml(endDate)}</strong>، ويتجدَّد تلقائياً طبقاً لأحكام المرسوم السلطاني رقم 89/6 وتعديلاته في شأن تنظيم العلاقة بين ملاك ومستأجري المساكن والمحال التجارية والصناعية وتسجيل عقود الإيجار الخاصة بها، ما لم يخطر المستأجر المؤجِّر كتابةً برغبته في إخلاء المحل المؤجَّر قبل انتهاء مدة العقد بثلاثة أشهرٍ على الأقل.</div>
        </div>
      </div>

      <div class="om-article">
        <div class="om-art-head"><span>Article (3)</span><span>البند الثالث</span></div>
        <div class="om-art-body">
          <div class="om-en">The second party shall pay to the first party a rent of <strong>(${escapeHtml(rent)}) Omani Riyals</strong>, payable in advance at the beginning of <strong>${escapeHtml(rentPeriodEn)}</strong>, within fifteen days from the due date, against a receipt evidencing payment, unless otherwise agreed.</div>
          <div class="om-ar">يلتزم الطرف الثاني بأن يؤدِّي إلى الطرف الأول أجرةً مقدارها <strong>(${escapeHtml(rent)}) ريالاً عمانياً</strong>، تُدفع مقدماً في بداية <strong>${escapeHtml(rentPeriodAr)}</strong>، خلال مدةٍ لا تتجاوز خمسة عشر يوماً من تاريخ استحقاقها، مقابل إيصالٍ يُفيد الأداء، ما لم يقضِ الاتفاق بخلاف ذلك.</div>
        </div>
      </div>

      ${articles.map(articleBlock).join("\n")}

      <div class="om-signatures">
        <div class="om-sig">
          <div class="om-sig-title"><span>الطرف الأول — المؤجِّر</span><span>First Party — Lessor</span></div>
          <div class="om-sig-name">${escapeHtml(landlordAr)}</div>
          <div class="om-sig-line"></div>
          <div class="om-sig-meta">${escapeHtml(v(data.brand.phone))}</div>
        </div>
        <div class="om-sig">
          <div class="om-sig-title"><span>الطرف الثاني — المستأجر</span><span>Second Party — Lessee</span></div>
          <div class="om-sig-name">${escapeHtml(tenantAr)}</div>
          <div class="om-sig-line"></div>
          <div class="om-sig-meta">${escapeHtml(v(data.tenant_phone))}</div>
        </div>
      </div>

      <div class="om-footnote">
        <div class="ar">يخضع هذا العقد لأحكام المرسوم السلطاني رقم 6/89 وتعديلاته. ${data.municipality ? "تُسجَّل النسخة الرسمية لدى " + escapeHtml(data.municipality) + "." : "تُسجَّل النسخة الرسمية لدى البلدية المختصة."}</div>
        <div class="en">This contract is governed by Royal Decree No. 6/89 and its amendments. The official copy is registered with the competent Municipality.</div>
      </div>
    </div>

    <style>
      .om-page { padding: 4px; }
      .om-banner {
        display: grid;
        grid-template-columns: 1fr 1.4fr 1fr;
        gap: 12px;
        align-items: center;
        padding: 18px 20px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: linear-gradient(180deg, #f7f3ea, #ffffff);
        margin-bottom: 18px;
      }
      .om-banner-ar { text-align: right; font-size: 12.5px; line-height: 1.7; color: var(--ink); }
      .om-banner-en { text-align: left; font-size: 11.5px; line-height: 1.7; color: var(--muted); direction: ltr; }
      .om-banner-mid { text-align: center; }
      .om-country { font-weight: 900; font-size: 17px; color: var(--primary); letter-spacing: 0.3px; }
      .om-gov, .om-muni { color: var(--muted); font-size: 12px; }
      .om-title { font-size: 20px; font-weight: 900; color: var(--ink); line-height: 1.35; }
      .om-title span { font-size: 12px; font-weight: 600; color: var(--muted); }
      .om-title-en { margin-top: 4px; font-size: 11px; color: var(--muted); direction: ltr; font-weight: 600; }
      .om-contract-no, .om-date { font-weight: 700; }

      .om-intro {
        display: flex; justify-content: space-between; gap: 12px;
        background: var(--soft); border: 1px solid var(--line); border-radius: 12px;
        padding: 10px 14px; font-size: 12px; margin: 14px 0;
      }
      .om-intro .ar { direction: rtl; text-align: right; }
      .om-intro .en { direction: ltr; text-align: left; color: var(--muted); }

      .om-party {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px 16px;
        margin-bottom: 12px;
        background: #ffffff;
      }
      .om-party-head {
        display: flex; justify-content: space-between; gap: 10px;
        font-size: 12px; color: var(--primary); font-weight: 800;
        border-bottom: 1px dashed var(--line); padding-bottom: 8px; margin-bottom: 10px;
      }
      .om-party-head .ar { direction: rtl; }
      .om-party-head .en { direction: ltr; color: var(--muted); font-weight: 600; }
      .om-party-name { font-size: 16px; font-weight: 800; margin-bottom: 10px; }
      .om-party-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;
      }
      .om-party-grid > div {
        display: flex; justify-content: space-between; gap: 10px;
        font-size: 12px; padding: 6px 10px;
        background: var(--soft); border-radius: 10px;
      }
      .om-party-grid .lbl { color: var(--muted); font-weight: 600; }
      .om-party-grid .val { font-weight: 700; }

      .om-article {
        border: 1px solid var(--line);
        border-radius: 14px;
        margin-bottom: 10px;
        overflow: hidden;
        background: #fff;
      }
      .om-art-head {
        display: flex; justify-content: space-between;
        background: #f1f5ee;
        padding: 8px 14px;
        font-size: 12px; font-weight: 800; color: var(--primary);
      }
      .om-art-head span:first-child { direction: ltr; }
      .om-art-body {
        display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
        padding: 12px 14px; font-size: 12px; line-height: 1.85;
      }
      .om-en { direction: ltr; text-align: left; color: var(--ink); }
      .om-ar { direction: rtl; text-align: right; color: var(--ink); }

      .om-signatures {
        margin-top: 22px;
        display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
      }
      .om-sig {
        border: 1px solid var(--line); border-radius: 16px;
        padding: 14px 16px; background: #fff; min-height: 130px;
      }
      .om-sig-title {
        display: flex; justify-content: space-between;
        font-size: 11px; color: var(--muted); font-weight: 700;
        margin-bottom: 10px;
      }
      .om-sig-name { font-weight: 800; font-size: 14px; margin-bottom: 24px; }
      .om-sig-line { border-bottom: 1px dashed var(--line); margin-bottom: 6px; }
      .om-sig-meta { font-size: 11px; color: var(--muted); }

      .om-footnote {
        margin-top: 16px; padding: 12px 14px;
        background: var(--soft); border: 1px solid var(--line); border-radius: 12px;
        font-size: 11px; color: var(--muted); line-height: 1.7;
      }
      .om-footnote .ar { direction: rtl; text-align: right; }
      .om-footnote .en { direction: ltr; text-align: left; margin-top: 4px; }
    </style>
  `;

  return pageShell("عقد إيجار — سلطنة عُمان", body, { rtl: true });
}


export async function downloadLeasePDF(data: Lease, filename: string) {
  const rtl = data.lang !== "en";
  const L = (ar: string, en: string) => (rtl ? ar : en);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  await registerLeasePdfFonts(pdf);

  type SignatureRow = {
    party: string;
    name: string;
    contact: string;
  };

  type SignatureColumn = {
    key: keyof SignatureRow | "signature";
    label: string;
    width: number;
  };

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 16;
  const marginTop = 18;
  const marginBottom = 16;
  const contentW = pageW - marginX * 2;
  const colGap = 6;
  const cardW = (contentW - colGap) / 2;
  const labelFontSize = 9;
  const valueFontSize = 12;
  const sectionFontSize = 14;
  const bodyFontSize = 11;
  const titleFontSize = 19;
  const smallFontSize = 10;

  const landlordLine = [data.brand.landlordName, data.brand.landlordNameEn].filter(Boolean).join(" / ") || data.brand.name || "—";
  const rentTypeLabel = rtl ? arOr(RENT_TYPE_AR, data.rent_type) : (data.rent_type || "—");
  const contractTypeLabel = rtl ? arOr(CONTRACT_TYPE_AR, data.contract_type) : (data.contract_type || "—");
  const unitTypeLabel = rtl ? arOr(UNIT_TYPE_AR, data.unit_type) : (data.unit_type || "—");
  const rentMoney = formatMoney(data.rent_amount, data.currency);
  const depositMoney = formatMoney(data.security_deposit || 0, data.currency);
  const startDate = formatDate(data.contract_start_date, rtl);
  const endDate = formatDate(data.contract_end_date, rtl);
  const dueDay = data.due_day != null ? String(data.due_day) : "—";
  const intro = L(
    `إنه في يوم ${startDate} تم الاتفاق بين المؤجر ${landlordLine} والمستأجر ${data.tenant_name || "—"} على تأجير الوحدة الموضحة أدناه وفق الشروط والبنود التالية.`,
    `On ${startDate}, this lease agreement is made between the Landlord ${landlordLine} and the Tenant ${data.tenant_name || "—"}, subject to the terms below.`
  );
  const clauses = rtl
    ? [
        `أقرّ الطرف الثاني (المستأجر) باستلامه الوحدة المؤجَّرة بحالة جيدة صالحة للاستعمال المتفق عليه.`,
        `قيمة الإيجار ${rentMoney} تُسدَّد ${rentTypeLabel} في موعد أقصاه يوم ${dueDay} من كل دورة استحقاق.`,
        `مدة العقد من ${startDate} وحتى ${endDate}، وهو من نوع ${contractTypeLabel}.`,
        `قام المستأجر بدفع وديعة تأمين قدرها ${depositMoney} تُرد عند انتهاء العقد بعد التحقق من سلامة الوحدة وسداد جميع المستحقات.`,
        `يلتزم المستأجر باستخدام الوحدة للغرض المتفق عليه فقط والمحافظة عليها وعدم إجراء أي تعديلات إنشائية دون إذن خطي من المؤجر.`,
        `يتحمّل المستأجر فواتير الخدمات ما لم يُتفق على خلاف ذلك كتابةً.`,
        `لا يحق للمستأجر تأجير الوحدة من الباطن أو التنازل عن العقد للغير إلا بموافقة خطية مسبقة من المؤجر.`,
        `في حال التأخر عن السداد لأكثر من 15 يوماً من تاريخ الاستحقاق، يحق للمؤجر اتخاذ الإجراءات النظامية المقررة.`,
        `عند رغبة أحد الطرفين في إنهاء العقد قبل انتهاء مدته، يجب إشعار الطرف الآخر كتابةً قبل 30 يوماً على الأقل.`,
        `حُرر هذا العقد من نسختين أصليتين بيد كل طرف نسخة للعمل بموجبها عند الحاجة.`,
      ]
    : [
        `The Tenant acknowledges receipt of the leased unit in good condition and fit for the agreed use.`,
        `Rent of ${rentMoney} is payable ${rentTypeLabel}, no later than day ${dueDay} of each due cycle.`,
        `Lease term runs from ${startDate} to ${endDate} and is classified as ${contractTypeLabel}.`,
        `A security deposit of ${depositMoney} has been paid and is refundable at lease end subject to inspection and settlement of dues.`,
        `The Tenant shall use the unit only for the agreed purpose and may not make structural alterations without written approval.`,
        `Utilities are payable by the Tenant unless otherwise agreed in writing.`,
        `The Tenant may not sublet or assign this lease without prior written approval of the Landlord.`,
        `Delay in payment for more than 15 days past due date entitles the Landlord to pursue legal remedies.`,
        `Either party wishing to terminate before the end of the term must provide at least 30 days written notice.`,
        `This agreement is executed in two original counterparts, one for each party.`,
      ];

  const detailCards = [
    { label: L("اسم المستأجر", "Tenant name"), value: data.tenant_name || "—" },
    { label: L("رقم الهاتف", "Phone"), value: data.tenant_phone || "—" },
    { label: L("رقم الهوية / السجل المدني", "ID number"), value: data.tenant_id_number || "—" },
    { label: L("نوع الوحدة", "Unit type"), value: unitTypeLabel },
    { label: L("الطابق", "Floor"), value: data.floor ?? "—" },
    { label: L("نوع الإيجار", "Rent type"), value: rentTypeLabel },
    { label: L("قيمة الإيجار", "Rent amount"), value: rentMoney },
    { label: L("وديعة التأمين", "Security deposit"), value: depositMoney },
    { label: L("بداية العقد", "Contract start"), value: startDate },
    { label: L("نهاية العقد", "Contract end"), value: endDate },
    { label: L("يوم استحقاق الإيجار", "Due day"), value: dueDay },
    { label: L("نوع العقد", "Contract type"), value: contractTypeLabel },
  ];

  let cursorY = marginTop;

  const ensureSpace = (heightNeeded: number) => {
    if (cursorY + heightNeeded <= pageH - marginBottom) return;
    pdf.addPage();
    cursorY = marginTop;
  };

  const setTextColor = (rgb: readonly number[]) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDrawColor = (rgb: readonly number[]) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const setFillColor = (rgb: readonly number[]) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);

  const drawTextBlock = ({ text, x, y, width, fontSize, bold = false, color = PDF_COLORS.ink, align }: {
    text: unknown; x: number; y: number; width: number; fontSize: number; bold?: boolean; color?: readonly number[]; align?: "left" | "right" | "center";
  }) => {
    pdf.setFontSize(fontSize);
    const prepared = splitPdfText(pdf, text, width, fontSize, bold);
    setTextColor(color);
    const resolvedAlign = align || (prepared.arabic ? "right" : "left");
    const textX = resolvedAlign === "right" ? x + width : resolvedAlign === "center" ? x + width / 2 : x;
    pdf.text(prepared.lines, textX, y, { align: resolvedAlign });
    return prepared.lines.length * getPdfLineHeight(fontSize);
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(12);
    const height = drawTextBlock({ text: title, x: marginX, y: cursorY, width: contentW, fontSize: sectionFontSize, bold: true, color: PDF_COLORS.sage });
    cursorY += height + 2;
    setDrawColor(PDF_COLORS.line);
    pdf.line(marginX, cursorY, pageW - marginX, cursorY);
    cursorY += 6;
  };

  const drawDetailCard = (x: number, y: number, label: string, value: unknown) => {
    const innerPadding = 4;
    const labelH = getPdfLineHeight(labelFontSize, 1.2);
    const valuePrepared = splitPdfText(pdf, value, cardW - innerPadding * 2, valueFontSize, true);
    const valueH = valuePrepared.lines.length * getPdfLineHeight(valueFontSize);
    const cardH = Math.max(22, innerPadding * 2 + labelH + valueH + 4);
    setFillColor(PDF_COLORS.soft);
    setDrawColor(PDF_COLORS.line);
    pdf.roundedRect(x, y, cardW, cardH, 4, 4, "FD");
    drawTextBlock({ text: label, x: x + innerPadding, y: y + 6, width: cardW - innerPadding * 2, fontSize: labelFontSize, color: PDF_COLORS.muted });
    drawTextBlock({ text: value, x: x + innerPadding, y: y + 6 + labelH + 2, width: cardW - innerPadding * 2, fontSize: valueFontSize, bold: true });
    return cardH;
  };

  const drawSignatureTable = () => {
    const rows: SignatureRow[] = [
      {
        party: L("المؤجر (الطرف الأول)", "Landlord (First Party)"),
        name: landlordLine,
        contact: data.brand.phone || data.brand.address || "—",
      },
      {
        party: L("المستأجر (الطرف الثاني)", "Tenant (Second Party)"),
        name: [data.tenant_name, data.tenant_name_en].filter(Boolean).join(" / ") || data.tenant_name || "—",
        contact: data.tenant_phone || data.tenant_id_number || "—",
      },
    ];
    const cols: SignatureColumn[] = rtl
      ? [
          { key: "signature", label: L("التوقيع", "Signature"), width: 38 },
          { key: "contact", label: L("بيانات التواصل", "Contact"), width: 46 },
          { key: "name", label: L("الاسم", "Name"), width: 52 },
          { key: "party", label: L("الطرف", "Party"), width: contentW - 38 - 46 - 52 },
        ]
      : [
          { key: "party", label: L("الطرف", "Party"), width: contentW - 38 - 46 - 52 },
          { key: "name", label: L("الاسم", "Name"), width: 52 },
          { key: "contact", label: L("بيانات التواصل", "Contact"), width: 46 },
          { key: "signature", label: L("التوقيع", "Signature"), width: 38 },
        ];

    const headerH = 10;
    ensureSpace(18 + headerH + rows.length * 20);
    setFillColor([244, 247, 242]);
    setDrawColor(PDF_COLORS.line);
    pdf.rect(marginX, cursorY, contentW, headerH, "FD");
    let x = marginX;
    cols.forEach((col, idx) => {
      drawTextBlock({ text: col.label, x, y: cursorY + 6.5, width: col.width, fontSize: smallFontSize, bold: true, color: PDF_COLORS.muted });
      x += col.width;
      if (idx < cols.length - 1) pdf.line(x, cursorY, x, cursorY + headerH);
    });
    cursorY += headerH;

    rows.forEach((row) => {
      const cellHeights = cols.map((col) => {
        if (col.key === "signature") return 18;
        const prepared = splitPdfText(pdf, row[col.key], col.width - 4, bodyFontSize, col.key !== "contact");
        return Math.max(18, prepared.lines.length * getPdfLineHeight(bodyFontSize) + 6);
      });
      const rowH = Math.max(...cellHeights);
      ensureSpace(rowH);
      pdf.rect(marginX, cursorY, contentW, rowH);
      let cellX = marginX;
      cols.forEach((col, idx) => {
        if (idx > 0) pdf.line(cellX, cursorY, cellX, cursorY + rowH);
        if (col.key === "signature") {
          setDrawColor(PDF_COLORS.line);
          pdf.line(cellX + 4, cursorY + rowH - 5, cellX + col.width - 4, cursorY + rowH - 5);
        } else {
          drawTextBlock({
            text: row[col.key],
            x: cellX + 2,
            y: cursorY + 6,
            width: col.width - 4,
            fontSize: bodyFontSize,
            bold: col.key === "name" || col.key === "party",
          });
        }
        cellX += col.width;
      });
      cursorY += rowH;
    });
  };

  ensureSpace(34);
  setFillColor([247, 243, 234]);
  setDrawColor(PDF_COLORS.line);
  pdf.roundedRect(marginX, cursorY, contentW, 28, 6, 6, "FD");
  if (data.brand.logo) {
    try {
      const logoData = await urlToDataUrl(data.brand.logo);
      pdf.addImage(logoData, "PNG", rtl ? pageW - marginX - 18 : marginX + 4, cursorY + 5, 14, 14, undefined, "FAST");
    } catch {
      // noop
    }
  }
  drawTextBlock({ text: L("عقد إيجار", "Lease Agreement"), x: marginX + 22, y: cursorY + 9, width: contentW - 44, fontSize: titleFontSize, bold: true, color: PDF_COLORS.ink, align: "center" });
  drawTextBlock({ text: landlordLine, x: marginX + 22, y: cursorY + 17, width: contentW - 44, fontSize: smallFontSize, color: PDF_COLORS.muted, align: "center" });
  cursorY += 36;

  cursorY += drawTextBlock({ text: intro, x: marginX, y: cursorY, width: contentW, fontSize: bodyFontSize, color: PDF_COLORS.muted }) + 3;
  drawSectionTitle(L("بيانات الوحدة والمستأجر", "Unit & Tenant Details"));

  for (let i = 0; i < detailCards.length; i += 2) {
    const rowCards = detailCards.slice(i, i + 2);
    const heights = rowCards.map((card) => {
      const prepared = splitPdfText(pdf, card.value, cardW - 8, valueFontSize, true);
      return Math.max(22, 8 + getPdfLineHeight(labelFontSize, 1.2) + prepared.lines.length * getPdfLineHeight(valueFontSize) + 4);
    });
    const rowH = Math.max(...heights);
    ensureSpace(rowH + 4);
    rowCards.forEach((card, idx) => {
      const x = rtl ? pageW - marginX - cardW - idx * (cardW + colGap) : marginX + idx * (cardW + colGap);
      drawDetailCard(x, cursorY, card.label, card.value);
    });
    cursorY += rowH + 4;
  }

  drawSectionTitle(L("شروط وبنود العقد", "Terms & Conditions"));
  clauses.forEach((clause, index) => {
    const prefix = rtl ? `${index + 1}.` : `${index + 1}.`;
    const prefixWidth = 10;
    const prepared = splitPdfText(pdf, clause, contentW - prefixWidth - 2, bodyFontSize, false);
    const blockHeight = Math.max(getPdfLineHeight(bodyFontSize), prepared.lines.length * getPdfLineHeight(bodyFontSize));
    ensureSpace(blockHeight + 3);
    drawTextBlock({ text: prefix, x: rtl ? pageW - marginX - prefixWidth : marginX, y: cursorY, width: prefixWidth, fontSize: bodyFontSize, bold: true });
    drawTextBlock({
      text: clause,
      x: rtl ? marginX : marginX + prefixWidth + 2,
      y: cursorY,
      width: contentW - prefixWidth - 2,
      fontSize: bodyFontSize,
      color: PDF_COLORS.ink,
    });
    cursorY += blockHeight + 3;
  });

  drawSectionTitle(L("توقيع الأطراف", "Signatures"));
  drawSignatureTable();

  const footerText = [data.brand.address, data.brand.phone].filter(Boolean).join(" — ") || data.brand.name || "";
  ensureSpace(14);
  cursorY += 6;
  setDrawColor(PDF_COLORS.line);
  pdf.line(marginX, cursorY, pageW - marginX, cursorY);
  cursorY += 6;
  drawTextBlock({ text: footerText, x: marginX, y: cursorY, width: contentW, fontSize: smallFontSize, color: PDF_COLORS.muted, align: "center" });

  pdf.save(filename);
}

export function buildTenantStatementHTML(data: TenantStatementData): string {
  const rows = data.rows
    .map(
      (row) => `
        <tr>
          <td>${formatDate(row.date)}</td>
          <td>${escapeHtml(row.month || "—")}</td>
          <td>${escapeHtml(row.description)}</td>
          <td>${escapeHtml(formatMoney(row.charge, data.currency))}</td>
          <td>${escapeHtml(formatMoney(row.payment, data.currency))}</td>
          <td class="${row.balance > 0 ? "amount-negative" : "amount-positive"}">${escapeHtml(formatMoney(row.balance, data.currency))}</td>
        </tr>`
    )
    .join("");

  const body = `
    ${brandBlock(
      data.brand,
      "Tenant Statement / كشف حساب",
      `${escapeHtml(data.tenantName)}${data.unitNumber ? ` — ${escapeHtml(data.unitNumber)}` : ""}`,
      `<div>${escapeHtml(data.generatedAt || "")}</div><div>${escapeHtml(data.building || "")}</div>`
    )}
    <div class="content">
      <div class="grid">
        <div class="card"><div class="label">Tenant / المستأجر</div><div class="value">${escapeHtml([data.tenantName, data.tenantNameEn].filter(Boolean).join(" / ") || data.tenantName)}</div></div>
        <div class="card"><div class="label">Phone / الهاتف</div><div class="value">${escapeHtml(data.tenantPhone || "—")}</div></div>
        <div class="card"><div class="label">Contract start / بداية العقد</div><div class="value">${formatDate(data.contractStart)}</div></div>
        <div class="card"><div class="label">Contract end / نهاية العقد</div><div class="value">${formatDate(data.contractEnd)}</div></div>
        <div class="card"><div class="label">Rent / الإيجار</div><div class="value">${escapeHtml(formatMoney(data.rentAmount || 0, data.currency))}</div></div>
        <div class="card"><div class="label">Rent type / النوع</div><div class="value">${escapeHtml(data.rentType || "—")}</div></div>
      </div>
      <div class="section-title">Transactions / الحركات</div>
      <table>
        <thead>
          <tr>
            <th>Date / التاريخ</th>
            <th>Month / الشهر</th>
            <th>Description / البيان</th>
            <th>Charge / مدين</th>
            <th>Payment / دائن</th>
            <th>Balance / الرصيد</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6">No records</td></tr>`}</tbody>
      </table>
      <div class="summary">
        <div class="card"><div class="label">Total charges / إجمالي المستحق</div><div class="value">${escapeHtml(formatMoney(data.totals.totalCharges, data.currency))}</div></div>
        <div class="card"><div class="label">Total paid / إجمالي المدفوع</div><div class="value amount-positive">${escapeHtml(formatMoney(data.totals.totalPaid, data.currency))}</div></div>
        <div class="card"><div class="label">Outstanding / المتبقي</div><div class="value ${data.totals.outstanding > 0 ? "amount-negative" : "amount-positive"}">${escapeHtml(formatMoney(data.totals.outstanding, data.currency))}</div></div>
      </div>
      ${(data.totals.openingBalance || data.totals.securityDeposit) ? `<div class="note">Opening balance: <strong>${escapeHtml(formatMoney(data.totals.openingBalance || 0, data.currency))}</strong> · Security deposit: <strong>${escapeHtml(formatMoney(data.totals.securityDeposit || 0, data.currency))}</strong></div>` : ""}
    </div>
    <div class="footer">${escapeHtml(data.brand.phone || "")}</div>
  `;

  return pageShell("Tenant Statement", body);
}

export function buildReportHTML(data: ReportData): string {
  const monthlyRows = data.monthly
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(formatMoney(row.income, data.currency))}</td>
          <td>${escapeHtml(formatMoney(row.expenses, data.currency))}</td>
          <td class="${row.net >= 0 ? "amount-positive" : "amount-negative"}">${escapeHtml(formatMoney(row.net, data.currency))}</td>
        </tr>`
    )
    .join("");

  const buildingRows = data.buildings
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.units)}</td>
          <td>${escapeHtml(row.rented)}</td>
          <td>${escapeHtml(row.vacant)}</td>
          <td>${escapeHtml(formatMoney(row.expectedMonthly, data.currency))}</td>
          <td>${escapeHtml(formatMoney(row.income, data.currency))}</td>
          <td>${escapeHtml(formatMoney(row.expenses, data.currency))}</td>
        </tr>`
    )
    .join("");

  const body = `
    ${brandBlock(
      data.brand,
      "Portfolio Report / التقرير",
      `${data.rangeMonths} months overview`,
      `<div>${escapeHtml(data.generatedAt)}</div><div>${escapeHtml(data.brand.name)}</div>`
    )}
    <div class="content">
      <div class="summary">
        <div class="card"><div class="label">Income</div><div class="value amount-positive">${escapeHtml(formatMoney(data.totals.income, data.currency))}</div></div>
        <div class="card"><div class="label">Expenses</div><div class="value amount-negative">${escapeHtml(formatMoney(data.totals.expenses, data.currency))}</div></div>
        <div class="card"><div class="label">Net</div><div class="value ${data.totals.net >= 0 ? "amount-positive" : "amount-negative"}">${escapeHtml(formatMoney(data.totals.net, data.currency))}</div></div>
      </div>
      <div class="summary">
        <div class="card"><div class="label">Buildings</div><div class="value">${escapeHtml(data.totals.buildings)}</div></div>
        <div class="card"><div class="label">Units</div><div class="value">${escapeHtml(data.totals.units)}</div></div>
        <div class="card"><div class="label">Occupancy</div><div class="value">${escapeHtml(`${data.totals.occupancy}%`)}</div></div>
      </div>
      <div class="summary">
        <div class="card"><div class="label">Rented</div><div class="value">${escapeHtml(data.totals.rented)}</div></div>
        <div class="card"><div class="label">Vacant</div><div class="value">${escapeHtml(data.totals.vacant)}</div></div>
        <div class="card"><div class="label">Collection rate</div><div class="value">${escapeHtml(`${data.totals.collectionRate}%`)}</div></div>
      </div>
      <div class="section-title">Monthly performance</div>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Income</th>
            <th>Expenses</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>${monthlyRows || `<tr><td colspan="4">No data</td></tr>`}</tbody>
      </table>
      <div class="section-title">Building breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Building</th>
            <th>Units</th>
            <th>Rented</th>
            <th>Vacant</th>
            <th>Expected</th>
            <th>Income</th>
            <th>Expenses</th>
          </tr>
        </thead>
        <tbody>${buildingRows || `<tr><td colspan="7">No data</td></tr>`}</tbody>
      </table>
    </div>
    <div class="footer">${escapeHtml(data.brand.phone || "")}${data.brand.address ? ` · ${escapeHtml(data.brand.address)}` : ""}</div>
  `;

  return pageShell("Portfolio Report", body);
}

export function buildCollectionHTML(data: CollectionPdfData): string {
  const rtl = data.lang === "ar";
  const T = rtl
    ? { title: "تقرير التحصيل الشهري", expected: "المتوقّع", collected: "المُحصَّل", remaining: "المتبقي", rate: "نسبة التحصيل", paid: "مسدِّدون", late: "متأخرون", lateSec: "قائمة المتأخرين", paidSec: "قائمة المسدِّدين", tenant: "المستأجر", building: "المبنى", unit: "الوحدة", rent: "الإيجار", paidCol: "المدفوع", remCol: "المتبقي", overdue: "متأخر منذ", months: "شهر", lastPay: "آخر دفعة", partial: "جزئي", unpaid: "غير مسدد", paidL: "مسدد", vs: "مقابل الشهر السابق", none: "لا يوجد", footer: "تم الإنشاء بواسطة" }
    : { title: "Monthly Collection Report", expected: "Expected", collected: "Collected", remaining: "Remaining", rate: "Collection rate", paid: "Paid", late: "Late", lateSec: "Late tenants", paidSec: "Paid tenants", tenant: "Tenant", building: "Building", unit: "Unit", rent: "Rent", paidCol: "Paid", remCol: "Remaining", overdue: "Overdue", months: "mo", lastPay: "Last payment", partial: "Partial", unpaid: "Unpaid", paidL: "Paid", vs: "vs previous month", none: "None", footer: "Generated by" };

  const lateRows = data.late.map((r) => `
    <tr>
      <td>${escapeHtml(r.tenant)}${r.overdueMonths && r.overdueMonths > 1 ? ` <span class="pill" style="background:rgba(168,93,93,.12);color:#8a3f3f">${T.overdue} ${r.overdueMonths} ${T.months}</span>` : ""}</td>
      <td>${escapeHtml(r.building)} · #${escapeHtml(r.unit)}</td>
      <td>${escapeHtml(formatMoney(r.rent, data.currency))}</td>
      <td>${escapeHtml(formatMoney(r.paid, data.currency))}</td>
      <td class="amount-negative">${escapeHtml(formatMoney(r.remaining, data.currency))}</td>
      <td>${r.status === "partial" ? T.partial : T.unpaid}</td>
    </tr>`).join("");

  const paidRows = data.paid.map((r) => `
    <tr>
      <td>${escapeHtml(r.tenant)}</td>
      <td>${escapeHtml(r.building)} · #${escapeHtml(r.unit)}</td>
      <td>${escapeHtml(formatMoney(r.rent, data.currency))}</td>
      <td class="amount-positive">${escapeHtml(formatMoney(r.paid, data.currency))}</td>
      <td>${escapeHtml(r.lastDate || "—")}</td>
    </tr>`).join("");

  const deltaHtml = (delta: number) => {
    if (!delta || !isFinite(delta)) return "";
    const up = delta > 0;
    return `<span class="pill" style="background:${up ? "rgba(95,126,101,.14)" : "rgba(168,93,93,.12)"};color:${up ? "#3d5942" : "#8a3f3f"}">${up ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}% ${T.vs}</span>`;
  };

  const body = `
    ${brandBlock(data.brand, T.title, data.monthLabel, `<div>${escapeHtml(data.generatedAt)}</div><div>${escapeHtml(data.brand.name)}</div>`)}
    <div class="content">
      <div class="summary">
        <div class="card"><div class="label">${T.expected}</div><div class="value">${escapeHtml(formatMoney(data.totals.expected, data.currency))}</div></div>
        <div class="card"><div class="label">${T.collected}</div><div class="value amount-positive">${escapeHtml(formatMoney(data.totals.collected, data.currency))}</div></div>
        <div class="card"><div class="label">${T.remaining}</div><div class="value ${data.totals.remaining > 0 ? "amount-negative" : "amount-positive"}">${escapeHtml(formatMoney(data.totals.remaining, data.currency))}</div></div>
      </div>
      <div class="summary">
        <div class="card"><div class="label">${T.rate}</div><div class="value amount-positive">${data.totals.rate}%</div>${data.vsLastMonth ? `<div style="margin-top:6px">${deltaHtml(data.vsLastMonth.rateDelta)}</div>` : ""}</div>
        <div class="card"><div class="label">${T.paid}</div><div class="value">${data.totals.paidCount}</div></div>
        <div class="card"><div class="label">${T.late}</div><div class="value ${data.totals.lateCount > 0 ? "amount-negative" : ""}">${data.totals.lateCount}</div></div>
      </div>

      <div class="section-title">${T.lateSec} · ${data.late.length}</div>
      <table>
        <thead><tr><th>${T.tenant}</th><th>${T.building}</th><th>${T.rent}</th><th>${T.paidCol}</th><th>${T.remCol}</th><th>${rtl ? "الحالة" : "Status"}</th></tr></thead>
        <tbody>${lateRows || `<tr><td colspan="6" style="text-align:center;color:#6a786b">${T.none}</td></tr>`}</tbody>
      </table>

      <div class="section-title">${T.paidSec} · ${data.paid.length}</div>
      <table>
        <thead><tr><th>${T.tenant}</th><th>${T.building}</th><th>${T.rent}</th><th>${T.paidCol}</th><th>${T.lastPay}</th></tr></thead>
        <tbody>${paidRows || `<tr><td colspan="5" style="text-align:center;color:#6a786b">${T.none}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="footer">${T.footer} ${escapeHtml(data.brand.name)}${data.brand.phone ? ` · ${escapeHtml(data.brand.phone)}` : ""}</div>
  `;
  return pageShell(T.title, body, { rtl });
}



/**
 * Inject the @font-face declarations (as data URLs) into the HTML produced by
 * pageShell. Fills the `<style id="pdf-fonts">` placeholder so Arabic letters
 * shape (join) correctly in preview iframes, print windows, and PDF renders.
 */
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
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${styleTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${styleTag}</head>`);
  }
  return `<!doctype html><html dir="rtl" lang="ar"><head>${styleTag}</head><body>${html}</body></html>`;
}

export async function printHTML(html: string) {
  const finalHtml = await inlinePdfFonts(html);
  // Use a hidden in-document iframe instead of window.open — popups are
  // blocked on iOS Safari and inside Capacitor WKWebView, and document.write
  // into a new window is unreliable. An iframe + contentWindow.print() works
  // on every platform including iPhone/iPad (triggers AirPrint).
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  iframe.srcdoc = finalHtml;
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      try { iframe.remove(); } catch { /* noop */ }
    }, 1000);
  };

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    // Safety timeout in case onload never fires.
    setTimeout(() => resolve(), 4000);
  });

  try {
    const win = iframe.contentWindow;
    if (!win) throw new Error("Could not access print frame");
    try { await (win.document as any).fonts?.ready; } catch { /* noop */ }
    await new Promise((r) => setTimeout(r, 200));
    win.focus();
    win.print();
  } finally {
    cleanup();
  }
}

const TRANSPARENT_PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

async function urlToDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url || TRANSPARENT_PX;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || TRANSPARENT_PX));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("[pdf] image inline failed:", url, e);
    return TRANSPARENT_PX;
  }
}

async function inlineImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;
      const dataUrl = await urlToDataUrl(src);
      img.setAttribute("src", dataUrl);
      img.setAttribute("crossorigin", "anonymous");
      await new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );
}

function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return true;
    const stepX = Math.max(1, Math.floor(w / 80));
    const stepY = Math.max(1, Math.floor(h / 80));
    const data = ctx.getImageData(0, 0, w, h).data;
    let nonWhite = 0;
    for (let y = 0; y < h; y += stepY) {
      for (let x = 0; x < w; x += stepX) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        // Treat as "ink" only if clearly darker than pure white
        if (a !== 0 && (r < 240 || g < 240 || b < 240)) {
          nonWhite++;
          if (nonWhite > 5) return false;
        }
      }
    }
    return nonWhite <= 5;
  } catch {
    return false;
  }
}

async function waitForWebFonts(root: HTMLElement) {
  try {
    const fonts = (root.ownerDocument as any)?.fonts;
    if (fonts?.ready) {
      await fonts.ready;
    }
    // Force-load key Arabic + Latin faces so html2canvas's foreignObject
    // snapshot has them available for proper shaping.
    const faces = [
      '700 16px "Noto Kufi Arabic"',
      '500 16px "Noto Kufi Arabic"',
      '400 16px "Noto Kufi Arabic"',
      '700 16px "Outfit"',
      '500 16px "Outfit"',
    ];
    if (fonts?.load) {
      const sample = "أبجد هوز Aa1";
      await Promise.all(
        faces.map((f) =>
          fonts.load(f, sample).catch(() => undefined)
        )
      );
    }
    await new Promise((r) => setTimeout(r, 350));
  } catch { /* noop */ }
}

function stripExternalRenderResources(doc: Document) {
  Array.from(doc.querySelectorAll('link[href]')).forEach((el) => {
    const href = el.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) {
      el.remove();
    }
  });

  Array.from(doc.querySelectorAll("style")).forEach((style) => {
    if (!style.textContent) return;
    style.textContent = style.textContent.replace(/@import\s+url\((?:'|")?https?:\/\/[^;]+;?/gi, "");
  });
}

function buildPdfFromCanvas(canvas: HTMLCanvasElement, filename: string, pageSize: PageSize, margins: Margins) {
  const pdf = new jsPDF({ unit: "mm", format: pageSize.toLowerCase() as "a4" | "a5" | "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const printableW = pageW - margins.left - margins.right;
  const printableH = pageH - margins.top - margins.bottom;
  let imgData: string;
  try {
    imgData = canvas.toDataURL("image/png");
  } catch {
    throw new Error("تعذّر إنشاء الـ PDF بسبب قيود أمان المتصفح (CORS). أعد المحاولة.");
  }
  const imgW = printableW;
  const imgH = (canvas.height * printableW) / canvas.width;

  if (imgH <= printableH) {
    pdf.addImage(imgData, "PNG", margins.left, margins.top, imgW, imgH, undefined, "SLOW");
  } else {
    const pageCanvas = document.createElement("canvas");
    const pageCtx = pageCanvas.getContext("2d");
    if (!pageCtx) throw new Error("Canvas rendering failed");
    const sliceHeightPx = Math.floor((printableH * canvas.width) / printableW);
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    let renderedHeight = 0;
    let pageIndex = 0;
    while (renderedHeight < canvas.height) {
      const remaining = canvas.height - renderedHeight;
      const currentSlice = Math.min(sliceHeightPx, remaining);
      pageCanvas.height = currentSlice;
      pageCtx.clearRect(0, 0, pageCanvas.width, currentSlice);
      pageCtx.drawImage(canvas, 0, renderedHeight, canvas.width, currentSlice, 0, 0, canvas.width, currentSlice);
      const sliceImg = pageCanvas.toDataURL("image/png");
      if (pageIndex > 0) pdf.addPage();
      const sliceH = (currentSlice * printableW) / canvas.width;
      pdf.addImage(sliceImg, "PNG", margins.left, margins.top, printableW, sliceH, undefined, "SLOW");
      renderedHeight += currentSlice;
      pageIndex += 1;
    }
  }
  pdf.save(filename);
}

/**
 * Render an HTML string in a hidden container INSIDE the main document.
 * Preferred path for Arabic content: the app's fonts (Noto Kufi Arabic, Outfit)
 * are already loaded and stable, so html2canvas captures correctly-shaped
 * (connected) Arabic letters. Matches the path used by the Payments page.
 */
async function renderInMainDocument(html: string): Promise<HTMLCanvasElement> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-20000px";
  wrapper.style.top = "0";
  wrapper.style.width = "794px";
  wrapper.style.background = "#ffffff";
  wrapper.style.zIndex = "-1";
  wrapper.style.pointerEvents = "none";

  // Carry over <style> tags from the source HTML head so .page layout matches
  Array.from(doc.head.querySelectorAll("style")).forEach((s) => {
    const clone = document.createElement("style");
    clone.textContent = s.textContent || "";
    wrapper.appendChild(clone);
  });

  const dir = doc.documentElement.getAttribute("dir") || "ltr";
  wrapper.setAttribute("dir", dir);

  const bodyHost = document.createElement("div");
  bodyHost.innerHTML = doc.body.innerHTML;
  wrapper.appendChild(bodyHost);

  document.body.appendChild(wrapper);

  try {
    const target = (wrapper.querySelector(".page") as HTMLElement) || bodyHost;
    target.style.background = "#ffffff";
    const hasArabic = /[\u0600-\u06FF]/.test(target.innerText || target.textContent || "");
    if (hasArabic) {
      target.setAttribute("dir", "rtl");
      target.style.fontFamily = '"Noto Kufi Arabic", "Noto Naskh Arabic", "Segoe UI", Tahoma, Arial, sans-serif';
    }
    await inlineImages(target);
    await waitForWebFonts(target);
    await new Promise((r) => setTimeout(r, 400));

    // IMPORTANT: do NOT use foreignObjectRendering for Arabic — it breaks
    // letter joining in modern Chrome. Match the manual Payments path.
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      foreignObjectRendering: false,
      windowWidth: target.scrollWidth || 794,
      windowHeight: target.scrollHeight || target.offsetHeight || 1123,
    });

    if (isCanvasBlank(canvas)) throw new Error("blank-canvas");
    return canvas;
  } finally {
    wrapper.remove();
  }
}


async function renderInIframe(html: string): Promise<HTMLCanvasElement> {
  const fontUrls = await getFontDataUrls();
  const fontFaceCss = buildFontFaceCss(fontUrls);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-20000px";
  iframe.style.top = "0";
  iframe.style.width = "794px";
  iframe.style.height = "1123px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.background = "#ffffff";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (cb: () => void) => { if (settled) return; settled = true; cb(); };
      iframe.onload = () => finish(() => resolve());
      iframe.onerror = () => finish(() => reject(new Error("تعذّر تجهيز ملف العقد قبل التنزيل.")));
      iframe.srcdoc = html;
      window.setTimeout(() => finish(() => resolve()), 600);
    });

    const frameDoc = iframe.contentDocument;
    if (!frameDoc) throw new Error("تعذّر تجهيز صفحة العقد للتنزيل.");

    stripExternalRenderResources(frameDoc);
    const fontStyle = frameDoc.getElementById("pdf-fonts") || frameDoc.createElement("style");
    fontStyle.id = "pdf-fonts";
    fontStyle.textContent = fontFaceCss;
    if (!fontStyle.parentNode) frameDoc.head.appendChild(fontStyle);
    await registerFontsInDocument(frameDoc, fontUrls);

    const target = (frameDoc.querySelector(".page") as HTMLElement) || frameDoc.body;
    target.style.background = "#ffffff";
    await inlineImages(target);
    await waitForWebFonts(target);
    await new Promise((r) => setTimeout(r, 350));

    const hasArabic = /[\u0600-\u06FF]/.test(target.innerText || target.textContent || "");
    const renderScale = hasArabic ? 3 : 2;

    const renderOnce = (useForeignObject: boolean, allowTaint: boolean) =>
      html2canvas(target, {
        scale: renderScale,
        useCORS: true,
        allowTaint,
        backgroundColor: "#ffffff",
        logging: false,
        foreignObjectRendering: useForeignObject,
        windowWidth: target.scrollWidth || 794,
        windowHeight: target.scrollHeight || target.offsetHeight || 1123,
      });

    let canvas: HTMLCanvasElement;
    if (hasArabic) {
      try {
        canvas = await renderOnce(true, false);
      } catch {
        await new Promise((r) => setTimeout(r, 300));
        canvas = await renderOnce(true, false);
      }
      if (isCanvasBlank(canvas)) {
        await new Promise((r) => setTimeout(r, 400));
        canvas = await renderOnce(true, false);
      }
    } else {
      try {
        canvas = await renderOnce(false, false);
        if (isCanvasBlank(canvas)) canvas = await renderOnce(true, false);
      } catch {
        canvas = await renderOnce(true, false);
      }
    }

    if (isCanvasBlank(canvas)) {
      throw new Error("تعذّر إنشاء الـ PDF: الصفحة الناتجة فارغة. حاول مرة أخرى.");
    }
    return canvas;
  } finally {
    iframe.remove();
  }
}

export async function downloadHTMLAsPDF(html: string, filename: string, settings?: PdfSettings) {
  const pageSize = settings?.pageSize || DEFAULT_PAGE_SIZE;
  const margins = settings?.margins || DEFAULT_MARGINS;

  // Inject @font-face (data URLs) so both render paths see the Arabic font
  // declarations inline — no reliance on relative /fonts/ URLs.
  const finalHtml = await inlinePdfFonts(html);

  let canvas: HTMLCanvasElement | null = null;

  try {
    canvas = await renderInMainDocument(finalHtml);
  } catch (e) {
    console.warn("[pdf] main-document render failed, falling back to iframe", e);
  }

  if (!canvas) {
    canvas = await renderInIframe(finalHtml);
  }

  buildPdfFromCanvas(canvas, filename, pageSize, margins);
}
