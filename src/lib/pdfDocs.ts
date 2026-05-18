import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { AppSettings, BusinessBrand, Margins, PageSize } from "@/lib/appSettings";

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
}

export interface StatementRow {
  date: string;
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
    <!-- Fonts intentionally not loaded from external CDN to avoid CORS-tainting html2canvas. The container inherits fonts already loaded by the app document (Noto Kufi Arabic + Outfit). -->
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
        font-feature-settings: "kern", "liga", "calt", "init", "medi", "fina", "isol";
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        unicode-bidi: ${options?.rtl ? "plaintext" : "normal"};
      }
      :lang(ar), [lang="ar"], [dir="rtl"], [dir="rtl"] * {
        font-family: "Noto Kufi Arabic", "Noto Naskh Arabic", "Segoe UI", Tahoma, Arial, sans-serif;
        font-feature-settings: "kern", "liga", "calt", "init", "medi", "fina", "isol";
      }
      [dir="rtl"] .value, [dir="rtl"] .label, [dir="rtl"] td, [dir="rtl"] th, [dir="rtl"] p, [dir="rtl"] div {
        unicode-bidi: plaintext;
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
  const intro = L(
    `استلمنا من السيد/ة <strong>${escapeHtml(data.tenantName || "—")}</strong> مبلغاً وقدره <strong>${escapeHtml(amountStr)}</strong> وذلك بدل إيجار الوحدة رقم <strong>${escapeHtml(data.unitNumber || "—")}</strong> بمبنى <strong>${escapeHtml(data.building || "—")}</strong> عن فترة <strong>${escapeHtml(data.periodLabel || "—")}</strong> بتاريخ <strong>${escapeHtml(dateStr)}</strong>.`,
    `Received from <strong>${escapeHtml(data.tenantName || "—")}</strong> the sum of <strong>${escapeHtml(amountStr)}</strong> as rent for unit <strong>${escapeHtml(data.unitNumber || "—")}</strong> at <strong>${escapeHtml(data.building || "—")}</strong>, for the period <strong>${escapeHtml(data.periodLabel || "—")}</strong>, on <strong>${escapeHtml(dateStr)}</strong>.`
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
        <div class="card"><div class="label">${L("عن فترة الإيجار", "Rent period")}</div><div class="value">${escapeHtml(data.periodLabel || "—")}</div></div>
      </div>
      ${data.settlementNote ? `<div class="note" style="background:#eef5ec;border-color:#cfe0ce;color:#2c5a36;"><strong>${L("إشعار سداد", "Settlement notice")}:</strong> ${escapeHtml(data.settlementNote)}</div>` : ""}
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

export function buildTenantStatementHTML(data: TenantStatementData): string {
  const rows = data.rows
    .map(
      (row) => `
        <tr>
          <td>${formatDate(row.date)}</td>
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
            <th>Description / البيان</th>
            <th>Charge / مدين</th>
            <th>Payment / دائن</th>
            <th>Balance / الرصيد</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5">No records</td></tr>`}</tbody>
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

export function printHTML(html: string) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!win) throw new Error("Could not open print window");
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  const runPrint = () => win.print();
  if (win.document.readyState === "complete") {
    setTimeout(runPrint, 150);
  } else {
    win.onload = () => setTimeout(runPrint, 150);
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
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready;
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
    if ((document as any).fonts?.load) {
      const sample = "أبجد هوز Aa1";
      await Promise.all(
        faces.map((f) =>
          (document as any).fonts.load(f, sample).catch(() => undefined)
        )
      );
    }
    await new Promise((r) => setTimeout(r, 350));
  } catch { /* noop */ }
}

export async function downloadHTMLAsPDF(html: string, filename: string, settings?: PdfSettings) {
  const pageSize = settings?.pageSize || DEFAULT_PAGE_SIZE;
  const margins = settings?.margins || DEFAULT_MARGINS;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-20000px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#ffffff";
  container.style.zIndex = "-1";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headNodes = Array.from(doc.head.childNodes);
  const bodyNodes = Array.from(doc.body.childNodes);

  headNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === "TITLE") return;
    container.appendChild(el.cloneNode(true));
  });

  const mount = document.createElement("div");
  mount.setAttribute("dir", doc.documentElement.getAttribute("dir") || "ltr");
  mount.setAttribute("lang", doc.documentElement.getAttribute("lang") || "en");
  mount.style.width = "794px";
  mount.style.background = "#ffffff";
  bodyNodes.forEach((node) => mount.appendChild(node.cloneNode(true)));
  container.appendChild(mount);
  document.body.appendChild(container);

  try {
    const target = (mount.querySelector(".page") as HTMLElement) || mount;
    // Inline images as data URLs so foreignObjectRendering / CORS never produce a blank canvas
    await inlineImages(target);
    await waitForWebFonts(target);

    const hasArabic = /[\u0600-\u06FF]/.test(target.innerText || target.textContent || "");

    const renderOnce = (useForeignObject: boolean, allowTaint: boolean) =>
      html2canvas(target, {
        scale: 2,
        useCORS: true,
        allowTaint,
        backgroundColor: "#ffffff",
        logging: false,
        foreignObjectRendering: useForeignObject,
        windowWidth: target.scrollWidth || 794,
        windowHeight: target.scrollHeight || target.offsetHeight || 1123,
      });

    let canvas: HTMLCanvasElement;
    try {
      // For Arabic we MUST use foreignObjectRendering — html2canvas's
      // fallback renderer cannot shape/join Arabic letters and produces
      // disconnected glyphs. Do not fall back for Arabic.
      canvas = await renderOnce(true, true);
      if (!hasArabic && isCanvasBlank(canvas)) {
        console.warn("[pdf] first render blank — retrying without foreignObjectRendering");
        canvas = await renderOnce(false, true);
      }
    } catch (e) {
      console.warn("[pdf] primary render failed, falling back", e);
      canvas = await renderOnce(hasArabic ? true : false, true);
    }

    if (isCanvasBlank(canvas)) {
      throw new Error("PDF render produced a blank page");
    }

    const pdf = new jsPDF({ unit: "mm", format: pageSize.toLowerCase() as "a4" | "a5" | "letter" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const printableW = pageW - margins.left - margins.right;
    const printableH = pageH - margins.top - margins.bottom;
    const imgData = canvas.toDataURL("image/png");

    const imgW = printableW;
    const imgH = (canvas.height * printableW) / canvas.width;

    if (imgH <= printableH) {
      pdf.addImage(imgData, "PNG", margins.left, margins.top, imgW, imgH, undefined, "FAST");
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
        pdf.addImage(sliceImg, "PNG", margins.left, margins.top, printableW, sliceH, undefined, "FAST");
        renderedHeight += currentSlice;
        pageIndex += 1;
      }
    }

    pdf.save(filename);
  } finally {
    container.remove();
  }
}
