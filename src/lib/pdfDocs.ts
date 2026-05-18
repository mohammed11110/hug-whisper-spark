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

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);
  return d.toLocaleDateString("en-GB");
};

const pageShell = (title: string, body: string, options?: { rtl?: boolean }) => `<!doctype html>
<html lang="${options?.rtl ? "ar" : "en"}" dir="${options?.rtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Cairo:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
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
        font-family: ${options?.rtl ? `"Noto Naskh Arabic", "Cairo", "Segoe UI", Tahoma, Arial, sans-serif` : `"Inter", "Segoe UI", Tahoma, Arial, sans-serif`};
        color: var(--ink);
        padding: 24px;
        font-feature-settings: "kern", "liga", "calt";
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
      :lang(ar), [lang="ar"], [dir="rtl"] {
        font-family: "Noto Naskh Arabic", "Cairo", "Segoe UI", Tahoma, Arial, sans-serif;
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
  const partial = data.expectedAmount && data.amount < data.expectedAmount;
  const body = `
    ${brandBlock(
      data.brand,
      "Receipt / سند قبض",
      data.brand.name,
      `<div>${escapeHtml(data.receiptNumber)}</div><div>${formatDate(data.paymentDate)}</div>`
    )}
    <div class="content">
      <div class="grid">
        <div class="card"><div class="label">Building / المبنى</div><div class="value">${escapeHtml(data.building || "—")}</div></div>
        <div class="card"><div class="label">Unit / الوحدة</div><div class="value">${escapeHtml(data.unitNumber || "—")}</div></div>
        <div class="card"><div class="label">Tenant / المستأجر</div><div class="value">${escapeHtml(data.tenantName || "—")}</div></div>
        <div class="card"><div class="label">Method / طريقة الدفع</div><div class="value">${escapeHtml(data.method || "—")}</div></div>
        <div class="card"><div class="label">Amount / المبلغ</div><div class="value amount-positive">${escapeHtml(formatMoney(data.amount, data.currency))}</div></div>
        <div class="card"><div class="label">Rent period / فترة الإيجار</div><div class="value">${escapeHtml(data.periodLabel || "—")}</div></div>
      </div>
      ${data.expectedAmount ? `<div class="note">Expected / المتوقع: <strong>${escapeHtml(formatMoney(data.expectedAmount, data.currency))}</strong>${partial ? ` — <span class="pill">Partial payment / دفعة جزئية</span>` : ""}</div>` : ""}
      ${data.notes ? `<div class="section-title">Notes / ملاحظات</div><div class="card"><div class="value">${escapeHtml(data.notes)}</div></div>` : ""}
    </div>
    <div class="footer">
      <div>${escapeHtml(data.brand.phone || "")}</div>
      <div>${escapeHtml(data.brand.address || "")}</div>
    </div>
  `;

  return pageShell("Receipt", body);
}

export function buildLeaseHTML(data: Lease): string {
  const rtl = data.lang === "ar";
  const landlordLine = [data.brand.landlordName, data.brand.landlordNameEn].filter(Boolean).join(" / ") || data.brand.name;
  const body = `
    ${brandBlock(
      data.brand,
      rtl ? "عقد إيجار" : "Lease Agreement",
      landlordLine,
      `<div>${escapeHtml(data.building_name || "—")}</div><div>${escapeHtml(data.unit_number || "—")}</div>`
    )}
    <div class="content">
      <div class="grid">
        <div class="card"><div class="label">${rtl ? "اسم المستأجر" : "Tenant name"}</div><div class="value">${escapeHtml(data.tenant_name || "—")}</div></div>
        <div class="card"><div class="label">${rtl ? "رقم الهاتف" : "Phone"}</div><div class="value">${escapeHtml(data.tenant_phone || "—")}</div></div>
        <div class="card"><div class="label">${rtl ? "رقم الهوية" : "ID number"}</div><div class="value">${escapeHtml(data.tenant_id_number || "—")}</div></div>
        <div class="card"><div class="label">${rtl ? "نوع الوحدة" : "Unit type"}</div><div class="value">${escapeHtml(data.unit_type || "—")}</div></div>
        <div class="card"><div class="label">${rtl ? "الطابق" : "Floor"}</div><div class="value">${escapeHtml(data.floor ?? "—")}</div></div>
        <div class="card"><div class="label">${rtl ? "نوع الإيجار" : "Rent type"}</div><div class="value">${escapeHtml(data.rent_type || "—")}</div></div>
        <div class="card"><div class="label">${rtl ? "قيمة الإيجار" : "Rent amount"}</div><div class="value amount-positive">${escapeHtml(formatMoney(data.rent_amount, data.currency))}</div></div>
        <div class="card"><div class="label">${rtl ? "وديعة التأمين" : "Security deposit"}</div><div class="value">${escapeHtml(formatMoney(data.security_deposit || 0, data.currency))}</div></div>
        <div class="card"><div class="label">${rtl ? "بداية العقد" : "Contract start"}</div><div class="value">${formatDate(data.contract_start_date)}</div></div>
        <div class="card"><div class="label">${rtl ? "نهاية العقد" : "Contract end"}</div><div class="value">${formatDate(data.contract_end_date)}</div></div>
        <div class="card"><div class="label">${rtl ? "يوم الاستحقاق" : "Due day"}</div><div class="value">${escapeHtml(data.due_day ?? "—")}</div></div>
        <div class="card"><div class="label">${rtl ? "نوع العقد" : "Contract type"}</div><div class="value">${escapeHtml(data.contract_type || "—")}</div></div>
      </div>
      <div class="section-title">${rtl ? "بيانات الأطراف" : "Parties"}</div>
      <table>
        <thead>
          <tr>
            <th>${rtl ? "الطرف" : "Party"}</th>
            <th>${rtl ? "الاسم" : "Name"}</th>
            <th>${rtl ? "معلومة إضافية" : "Additional info"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${rtl ? "المؤجر" : "Landlord"}</td>
            <td>${escapeHtml(landlordLine || "—")}</td>
            <td>${escapeHtml(data.brand.phone || data.brand.address || "—")}</td>
          </tr>
          <tr>
            <td>${rtl ? "المستأجر" : "Tenant"}</td>
            <td>${escapeHtml([data.tenant_name, data.tenant_name_en].filter(Boolean).join(" / ") || data.tenant_name || "—")}</td>
            <td>${escapeHtml(data.tenant_id_number || data.tenant_phone || "—")}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="footer">${escapeHtml(data.brand.address || "")}</div>
  `;

  return pageShell(rtl ? "عقد إيجار" : "Lease Agreement", body, { rtl });
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
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const target = (container.querySelector(".page") as HTMLElement) || container;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: target.scrollWidth || 794,
      windowHeight: target.scrollHeight || target.offsetHeight || 1123,
    });

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
