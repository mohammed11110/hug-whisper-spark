// Lightweight PDF generator for receipts & lease contracts using html2canvas+jsPDF
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { AppSettings } from "@/lib/appSettings";

export interface BrandInfo {
  name: string;
  logo: string | null;
  phone: string;
  address: string;
  landlordName?: string;
  landlordNameEn?: string;
}

// Pick landlord name for a given language with safe fallback.
export function pickLandlord(brand: BrandInfo | undefined, lang: "ar" | "en" | string): string {
  if (!brand) return "";
  if (lang === "en") return (brand.landlordNameEn || brand.landlordName || brand.name || "").trim();
  return (brand.landlordName || brand.landlordNameEn || brand.name || "").trim();
}

export interface LeaseData {
  brand: BrandInfo;
  building_name: string;
  unit_number: string;
  unit_type: string;
  floor: number | string;
  tenant_name: string;
  tenant_phone: string;
  tenant_id_number: string;
  rent_amount: number;
  rent_type: string;
  contract_type: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  due_day: number;
  security_deposit: number;
  currency: string;
  lang: "ar" | "en";
}

const TXT = {
  ar: {
    title: "عقد إيجار", date: "التاريخ", first: "الطرف الأول (المؤجر)", second: "الطرف الثاني (المستأجر)",
    name: "الاسم", phone: "الهاتف", id: "رقم الهوية", address: "العنوان",
    property: "العقار المؤجر", building: "المبنى", unit: "رقم الوحدة", floor: "الطابق", type: "النوع",
    terms: "شروط الإيجار", rent: "قيمة الإيجار", period: "مدة العقد", start: "تاريخ البداية", end: "تاريخ النهاية",
    due: "يوم الاستحقاق", deposit: "التأمين", method: "كل", monthly: "شهرياً", yearly: "سنوياً",
    clauses_title: "البنود",
    c1: "1) يلتزم المستأجر بسداد بدل الإيجار في الموعد المحدد دون تأخير.",
    c2: "2) لا يحق للمستأجر التنازل عن العقد أو تأجير العقار من الباطن دون موافقة كتابية.",
    c3: "3) يلتزم المستأجر بصيانة العقار وإعادته بحالته الأصلية عند انتهاء العقد.",
    c4: "4) في حال التأخر عن السداد لأكثر من شهر، يحق للمؤجر اتخاذ الإجراءات النظامية.",
    c5: "5) جميع فواتير الخدمات (كهرباء/ماء/إنترنت) على عاتق المستأجر ما لم يُتفق على خلاف ذلك.",
    sign1: "توقيع المؤجر", sign2: "توقيع المستأجر",
  },
  en: {
    title: "Lease Contract", date: "Date", first: "First Party (Lessor)", second: "Second Party (Lessee)",
    name: "Name", phone: "Phone", id: "ID Number", address: "Address",
    property: "Leased Property", building: "Building", unit: "Unit #", floor: "Floor", type: "Type",
    terms: "Lease Terms", rent: "Rent", period: "Period", start: "Start date", end: "End date",
    due: "Due day", deposit: "Security deposit", method: "per", monthly: "month", yearly: "year",
    clauses_title: "Clauses",
    c1: "1) Lessee shall pay rent on time without delay.",
    c2: "2) Sub-leasing or assignment is not allowed without prior written consent.",
    c3: "3) Lessee shall maintain the property and return it in original condition.",
    c4: "4) Late payment of more than one month allows lessor to take legal action.",
    c5: "5) Utility bills (electricity/water/internet) are the lessee's responsibility unless agreed.",
    sign1: "Lessor signature", sign2: "Lessee signature",
  },
};

export function buildLeaseHTML(d: LeaseData): string {
  const L = TXT[d.lang];
  const today = new Date().toISOString().slice(0, 10);
  const period = d.contract_type === "monthly" ? L.monthly : L.yearly;
  const dir = d.lang === "ar" ? "rtl" : "ltr";
  const fmt = (n: number) => `${n.toLocaleString()} ${d.currency}`;
  const logoHTML = d.brand.logo
    ? `<img src="${d.brand.logo}" style="height:48px;object-fit:contain"/>`
    : `<div style="font-weight:900;font-size:20px;color:#5a7359">${d.brand.name}</div>`;
  return `<html dir="${dir}"><head><meta charset="utf-8"/><title>${L.title}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#3a4f3a;background:#fff;margin:0;padding:24px}
  .doc{max-width:760px;margin:auto;background:#fff;border:1px solid #d6e0cf;border-radius:18px;padding:28px;position:relative}
  .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #eef3ea;padding-bottom:14px;margin-bottom:18px}
  h1{margin:0;font-size:26px;color:#3a6b3a;letter-spacing:1px}
  .meta{font-size:11px;color:#7a8a78;margin-top:4px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}
  .box{border:1px solid #e1ead8;border-radius:12px;padding:12px 14px;background:#f9fcf6}
  .box h3{margin:0 0 8px;font-size:13px;color:#5a7359;letter-spacing:1px;text-transform:uppercase}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed #d6e0cf}
  .row:last-child{border-bottom:0}
  .row span{color:#7a8a78}
  .row b{color:#3a4f3a}
  .clauses{margin-top:14px;padding:14px 16px;border:1px solid #e1ead8;border-radius:12px;background:#fff}
  .clauses h3{margin:0 0 10px;font-size:13px;color:#5a7359;letter-spacing:1px;text-transform:uppercase}
  .clauses p{margin:6px 0;font-size:12px;line-height:1.7}
  .signs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px}
  .sign{border-top:1.5px solid #5a7359;padding-top:6px;font-size:11px;color:#5a7359;text-align:center;font-weight:700}
  .total{margin-top:14px;padding:14px 18px;background:linear-gradient(135deg,#eef3ea,#dcebd2);border-radius:14px;display:flex;justify-content:space-between;font-weight:900;color:#3a6b3a;font-size:16px}
</style></head><body>
<div class="doc" id="doc-root">
  <div class="head">
    <div>${logoHTML}<div class="meta">${d.brand.address || ""} ${d.brand.phone ? "· " + d.brand.phone : ""}</div></div>
    <div style="text-align:end"><h1>${L.title}</h1><div class="meta">${L.date}: ${today}</div></div>
  </div>
  <div class="grid2">
    <div class="box"><h3>${L.first}</h3>
      <div class="row"><span>${L.name}</span><b>${d.brand.landlordName || d.brand.name}</b></div>
      <div class="row"><span>${L.phone}</span><b>${d.brand.phone || "—"}</b></div>
      <div class="row"><span>${L.address}</span><b>${d.brand.address || "—"}</b></div>
    </div>
    <div class="box"><h3>${L.second}</h3>
      <div class="row"><span>${L.name}</span><b>${d.tenant_name || "—"}</b></div>
      <div class="row"><span>${L.phone}</span><b>${d.tenant_phone || "—"}</b></div>
      <div class="row"><span>${L.id}</span><b>${d.tenant_id_number || "—"}</b></div>
    </div>
  </div>
  <div class="box"><h3>${L.property}</h3>
    <div class="row"><span>${L.building}</span><b>${d.building_name}</b></div>
    <div class="row"><span>${L.unit}</span><b>#${d.unit_number}</b></div>
    <div class="row"><span>${L.floor}</span><b>${d.floor}</b></div>
    <div class="row"><span>${L.type}</span><b>${d.unit_type}</b></div>
  </div>
  <div class="box" style="margin-top:14px"><h3>${L.terms}</h3>
    <div class="row"><span>${L.rent}</span><b>${fmt(d.rent_amount)} ${L.method} ${period}</b></div>
    <div class="row"><span>${L.start}</span><b>${d.contract_start_date || "—"}</b></div>
    <div class="row"><span>${L.end}</span><b>${d.contract_end_date || "—"}</b></div>
    <div class="row"><span>${L.due}</span><b>${d.due_day}</b></div>
    <div class="row"><span>${L.deposit}</span><b>${fmt(d.security_deposit)}</b></div>
  </div>
  <div class="clauses">
    <h3>${L.clauses_title}</h3>
    <p>${L.c1}</p><p>${L.c2}</p><p>${L.c3}</p><p>${L.c4}</p><p>${L.c5}</p>
  </div>
  <div class="total"><span>${L.rent} (${period})</span><span>${fmt(d.rent_amount)}</span></div>
  <div class="signs">
    <div class="sign">${L.sign1}</div>
    <div class="sign">${L.sign2}</div>
  </div>
</div></body></html>`;
}

export async function downloadHTMLAsPDF(html: string, filename: string, settings: Pick<AppSettings, "pageSize" | "margins">) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "820px";
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const root = container.querySelector("#doc-root") as HTMLElement;
    const canvas = await html2canvas(root, { scale: 2, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: settings.pageSize.toLowerCase() as any });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const m = settings.margins;
    const w = pageW - m.left - m.right;
    const fullH = (canvas.height * w) / canvas.width;
    const availH = pageH - m.top - m.bottom;
    if (fullH <= availH) {
      pdf.addImage(img, "PNG", m.left, m.top, w, fullH);
    } else {
      // Multi-page: slice canvas into page-sized chunks
      const pxPerMm = canvas.width / w;
      const pageHpx = availH * pxPerMm;
      let renderedPx = 0;
      while (renderedPx < canvas.height) {
        const sliceHpx = Math.min(pageHpx, canvas.height - renderedPx);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHpx;
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
        const sImg = sliceCanvas.toDataURL("image/png");
        const sH = (sliceHpx * w) / canvas.width;
        if (renderedPx > 0) pdf.addPage();
        pdf.addImage(sImg, "PNG", m.left, m.top, w, sH);
        renderedPx += sliceHpx;
      }
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

// ============================================================
// Bilingual branded REPORT (per-building + grand totals)
// ============================================================

export interface ReportBuildingRow {
  name: string;
  units: number;
  rented: number;
  vacant: number;
  expectedMonthly: number;
  income: number;
  expenses: number;
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
  monthly: { label: string; income: number; expenses: number; net: number }[];
  buildings: ReportBuildingRow[];
}

const AMLAKI_LOGO_SVG = `<svg width="44" height="44" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="lk" x1="0" y1="0" x2="64" y2="64">
    <stop offset="0%" stop-color="#7a9a7e"/><stop offset="100%" stop-color="#3d4d3f"/>
  </linearGradient></defs>
  <circle cx="22" cy="22" r="13" stroke="url(#lk)" stroke-width="4" fill="none"/>
  <circle cx="22" cy="22" r="4" fill="url(#lk)"/>
  <path d="M31 31 L52 52" stroke="url(#lk)" stroke-width="4" stroke-linecap="round"/>
  <path d="M44 44 L50 38" stroke="url(#lk)" stroke-width="4" stroke-linecap="round"/>
  <path d="M48 48 L54 42" stroke="url(#lk)" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export function buildReportHTML(d: ReportData): string {
  const fmt = (n: number) => `${Math.round(n).toLocaleString()} ${d.currency}`;
  const logoHTML = d.brand.logo
    ? `<img src="${d.brand.logo}" style="height:48px;object-fit:contain"/>`
    : AMLAKI_LOGO_SVG;

  const monthlyRows = d.monthly.map((m) => `
    <tr>
      <td>${m.label}</td>
      <td class="num">${fmt(m.income)}</td>
      <td class="num">${fmt(m.expenses)}</td>
      <td class="num ${m.net >= 0 ? "pos" : "neg"}">${fmt(m.net)}</td>
    </tr>`).join("");

  const buildingCards = d.buildings.map((b, i) => {
    const occ = b.units ? Math.round((b.rented / b.units) * 100) : 0;
    const net = b.income - b.expenses;
    const avgRent = b.rented ? b.expectedMonthly / b.rented : 0;
    const expectedTotal = b.expectedMonthly * d.rangeMonths;
    const collection = expectedTotal > 0 ? Math.min(999, Math.round((b.income / expectedTotal) * 100)) : 0;
    const margin = b.income > 0 ? Math.round((net / b.income) * 100) : 0;
    const occColor = occ >= 80 ? "#5f7e65" : occ >= 50 ? "#a89456" : "#a85d5d";
    return `
    <div class="b-card">
      <div class="b-head">
        <div class="b-idx">${String(i + 1).padStart(2, "0")}</div>
        <div class="b-title-wrap">
          <div class="b-title">${escapeHTML(b.name)}</div>
          <div class="b-sub">${b.units} وحدة · ${b.units} units &nbsp;·&nbsp; ${b.rented} مؤجرة · rented &nbsp;·&nbsp; ${b.vacant} شاغرة · vacant</div>
        </div>
        <div class="b-occ" style="color:${occColor}">${occ}%<span>الإشغال · Occupancy</span></div>
      </div>

      <div class="b-section">
        <div class="b-section-title">حالة الوحدات · Unit status</div>
        <div class="b-bar"><div class="b-bar-fill" style="width:${occ}%;background:linear-gradient(90deg,#7a9a7e,#3d4d3f)"></div></div>
        <div class="b-bar-legend">
          <span><i style="background:#3d4d3f"></i>${b.rented} مؤجرة · Rented</span>
          <span><i style="background:#d5ddc9"></i>${b.vacant} شاغرة · Vacant</span>
        </div>
      </div>

      <div class="b-section">
        <div class="b-section-title">الملخص المالي · Financial summary (${d.rangeMonths} أشهر · months)</div>
        <table class="b-table">
          <tr><td>متوقع شهرياً · Expected monthly</td><td class="num">${fmt(b.expectedMonthly)}</td></tr>
          <tr><td>متوسط الإيجار · Average rent</td><td class="num">${fmt(avgRent)}</td></tr>
          <tr><td>إجمالي متوقع · Expected total</td><td class="num">${fmt(expectedTotal)}</td></tr>
          <tr><td>إجمالي التحصيل · Total income</td><td class="num pos">${fmt(b.income)}</td></tr>
          <tr><td>إجمالي المصروفات · Total expenses</td><td class="num neg">${fmt(b.expenses)}</td></tr>
          <tr><td>نسبة التحصيل · Collection rate</td><td class="num">${collection}%</td></tr>
          <tr><td>هامش الربح · Profit margin</td><td class="num">${margin}%</td></tr>
        </table>
      </div>

      <div class="b-net">
        <span>الصافي · Net result</span>
        <b class="${net >= 0 ? "pos-light" : "neg-light"}">${fmt(net)}</b>
      </div>
    </div>`;
  }).join("");

  return `<html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>تقرير · Report</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Noto Kufi Arabic","Outfit",system-ui,sans-serif;color:#2c3a2e;background:#faf6ee;margin:0;padding:24px}
  .doc{max-width:820px;margin:auto;background:#ffffff;border:1px solid rgba(95,126,101,.18);border-radius:22px;padding:32px;box-shadow:0 8px 24px rgba(95,126,101,.08)}
  .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid rgba(95,126,101,.15);padding-bottom:18px;margin-bottom:22px}
  .brand-wrap{display:flex;align-items:center;gap:12px}
  .brand-name{font-weight:900;font-size:20px;color:#3d4d3f;letter-spacing:-.01em}
  .brand-tag{font-size:11px;color:#7a8e9a;margin-top:2px;letter-spacing:.02em}
  .title-block{text-align:left;direction:ltr}
  h1{margin:0;font-size:24px;color:#3d4d3f;letter-spacing:-.02em;font-weight:900}
  .h-sub{font-size:11px;color:#7a8e9a;margin-top:4px}
  .section-title{display:flex;align-items:center;gap:10px;margin:26px 0 12px;font-size:14px;font-weight:800;color:#3d4d3f;letter-spacing:.02em}
  .section-title::before{content:"";width:4px;height:18px;background:linear-gradient(135deg,#7a9a7e,#3d4d3f);border-radius:2px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px}
  .kpi{background:#faf6ee;border:1px solid rgba(95,126,101,.12);border-radius:14px;padding:12px 14px}
  .kpi span{display:block;font-size:10.5px;color:#7a8e9a;letter-spacing:.02em;line-height:1.4;margin-bottom:6px}
  .kpi b{display:block;font-size:15px;font-weight:900;color:#3d4d3f;letter-spacing:-.01em}
  .kpi.gold{background:linear-gradient(135deg,#fdf6e6,#f7ecd2);border-color:rgba(168,148,86,.3)}
  .kpi.gold b{color:#7d6b3a}
  table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid rgba(95,126,101,.12)}
  thead{background:linear-gradient(135deg,#5f7e65,#3d4d3f);color:#fff}
  th,td{padding:9px 12px;text-align:start;border-bottom:1px solid rgba(95,126,101,.08)}
  th{font-weight:700;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
  tbody tr:nth-child(even){background:#faf6ee}
  td.num{text-align:end;font-variant-numeric:tabular-nums;font-weight:700}
  .pos{color:#3d4d3f}
  .neg{color:#a85d5d}
  .b-card{background:#fff;border:1px solid rgba(95,126,101,.14);border-radius:18px;padding:18px 20px;margin-bottom:14px;page-break-inside:avoid;box-shadow:0 2px 8px rgba(95,126,101,.04)}
  .b-head{display:flex;align-items:center;gap:14px;border-bottom:1px dashed rgba(95,126,101,.18);padding-bottom:12px;margin-bottom:14px}
  .b-idx{height:36px;min-width:36px;border-radius:11px;background:linear-gradient(135deg,#7a9a7e,#3d4d3f);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;letter-spacing:.04em}
  .b-title-wrap{flex:1;min-width:0}
  .b-title{font-weight:900;font-size:16px;color:#3d4d3f;letter-spacing:-.01em;margin-bottom:3px}
  .b-sub{font-size:10.5px;color:#7a8e9a;letter-spacing:.01em}
  .b-occ{font-size:18px;font-weight:900;text-align:end;line-height:1}
  .b-occ span{display:block;font-size:9px;color:#7a8e9a;font-weight:600;letter-spacing:.04em;margin-top:4px;text-transform:uppercase}
  .b-section{margin-top:12px}
  .b-section-title{font-size:10px;font-weight:800;color:#5f7e65;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(95,126,101,.1)}
  .b-bar{height:8px;background:#eef3ea;border-radius:99px;overflow:hidden;margin-bottom:8px}
  .b-bar-fill{height:100%;border-radius:99px;transition:width .3s}
  .b-bar-legend{display:flex;gap:14px;font-size:10.5px;color:#5a6a5c;font-weight:600}
  .b-bar-legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-inline-end:5px;vertical-align:middle}
  .b-table{width:100%;border-collapse:collapse;font-size:11.5px}
  .b-table td{padding:6px 8px;border-bottom:1px dashed rgba(95,126,101,.12);color:#5a6a5c}
  .b-table td:first-child{font-weight:600}
  .b-table tr:last-child td{border-bottom:0}
  .b-table td.num{text-align:end;font-variant-numeric:tabular-nums;font-weight:800;color:#3d4d3f}
  .b-table td.num.pos{color:#3d4d3f}
  .b-table td.num.neg{color:#a85d5d}
  .b-net{margin-top:14px;padding:12px 16px;background:linear-gradient(135deg,#eef3ea,#dcebd2);border-radius:12px;border:1px solid rgba(95,126,101,.2);display:flex;justify-content:space-between;align-items:center}
  .b-net span{font-size:11px;font-weight:700;color:#5a6a5c;letter-spacing:.04em;text-transform:uppercase}
  .b-net b{font-size:17px;font-weight:900;letter-spacing:-.01em}
  .b-net b.pos-light{color:#3d4d3f}
  .b-net b.neg-light{color:#a85d5d}
  .grand{margin-top:22px;background:linear-gradient(135deg,#3d4d3f,#2c3a2e);color:#faf6ee;border-radius:20px;padding:22px 26px;page-break-inside:avoid}
  .grand-title{font-size:13px;font-weight:700;letter-spacing:.06em;opacity:.85;margin-bottom:14px;text-transform:uppercase}
  .grand-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .grand-cell{border:1px solid rgba(250,246,238,.15);border-radius:12px;padding:12px 14px;background:rgba(250,246,238,.04)}
  .grand-cell span{display:block;font-size:10.5px;opacity:.75;margin-bottom:6px;letter-spacing:.02em}
  .grand-cell b{display:block;font-size:17px;font-weight:900;letter-spacing:-.01em}
  .grand-cell.net{background:linear-gradient(135deg,#a89456,#7d6b3a);border-color:#a89456}
  .footer{margin-top:22px;text-align:center;font-size:10.5px;color:#7a8e9a;letter-spacing:.04em;border-top:1px dashed rgba(95,126,101,.2);padding-top:14px}
</style></head><body>
<div class="doc" id="doc-root">
  <div class="head">
    <div class="brand-wrap">
      ${logoHTML}
      <div>
        <div class="brand-name">${escapeHTML(d.brand.name)}</div>
        <div class="brand-tag">إدارة عقاراتك بذكاء · Manage smartly</div>
      </div>
    </div>
    <div class="title-block">
      <h1>Performance Report · تقرير الأداء</h1>
      <div class="h-sub">${d.rangeMonths} months · ${d.rangeMonths} أشهر &nbsp;·&nbsp; ${d.generatedAt}</div>
    </div>
  </div>

  <div class="section-title">ملخص تنفيذي · Executive summary</div>
  <div class="kpis">
    <div class="kpi"><span>إجمالي التحصيل · Total income</span><b>${fmt(d.totals.income)}</b></div>
    <div class="kpi"><span>إجمالي المصروفات · Total expenses</span><b>${fmt(d.totals.expenses)}</b></div>
    <div class="kpi gold"><span>الصافي · Net profit</span><b>${fmt(d.totals.net)}</b></div>
    <div class="kpi"><span>نسبة التحصيل · Collection rate</span><b>${d.totals.collectionRate}%</b></div>
    <div class="kpi"><span>المباني · Buildings</span><b>${d.totals.buildings}</b></div>
    <div class="kpi"><span>الوحدات · Units</span><b>${d.totals.units}</b></div>
    <div class="kpi"><span>نسبة الإشغال · Occupancy</span><b>${d.totals.occupancy}%</b></div>
    <div class="kpi"><span>المتأخرات · Late</span><b>${d.totals.late}</b></div>
  </div>

  <div class="section-title">الأداء الشهري · Monthly performance</div>
  <table>
    <thead><tr>
      <th>الشهر · Month</th>
      <th style="text-align:end">الدخل · Income</th>
      <th style="text-align:end">المصروفات · Expenses</th>
      <th style="text-align:end">الصافي · Net</th>
    </tr></thead>
    <tbody>${monthlyRows || `<tr><td colspan="4" style="text-align:center;color:#7a8e9a;padding:18px">— لا توجد بيانات · No data —</td></tr>`}</tbody>
  </table>

  <div class="section-title">تفاصيل المباني · Buildings breakdown</div>
  ${buildingCards || `<div style="background:#faf6ee;border:1px dashed rgba(95,126,101,.25);border-radius:14px;padding:24px;text-align:center;color:#7a8e9a;font-size:12px">لا توجد مبانٍ · No buildings</div>`}

  <div class="grand">
    <div class="grand-title">الإجمالي العام · Grand totals</div>
    <div class="grand-grid">
      <div class="grand-cell"><span>إجمالي التحصيل · Income</span><b>${fmt(d.totals.income)}</b></div>
      <div class="grand-cell"><span>إجمالي المصروفات · Expenses</span><b>${fmt(d.totals.expenses)}</b></div>
      <div class="grand-cell net"><span>الصافي النهائي · Net profit</span><b>${fmt(d.totals.net)}</b></div>
    </div>
  </div>

  <div class="footer">
    ${escapeHTML(d.brand.name)} ${d.brand.phone ? "· " + escapeHTML(d.brand.phone) : ""} ${d.brand.address ? "· " + escapeHTML(d.brand.address) : ""}
    <br/>تم الإنشاء بواسطة أملاكي · Generated by Amlaki
  </div>
</div></body></html>`;
}

function escapeHTML(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function printHTML(html: string) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 350);
}

// ============================================================
// Bilingual branded RECEIPT
// ============================================================

export interface ReceiptData {
  brand: BrandInfo;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  expectedAmount?: number | null;
  method: string;
  periodLabel?: string | null;
  building: string;
  unitNumber: string;
  tenantName: string;
  notes?: string | null;
  currency: string;
}

export function buildReceiptHTML(d: ReceiptData): string {
  const fmt = (n: number) => `${Math.round(n).toLocaleString()} ${d.currency}`;
  const expected = Number(d.expectedAmount) || 0;
  const remaining = expected > 0 ? Math.max(0, expected - d.amount) : 0;
  const isPartial = remaining > 0;
  const logoHTML = d.brand.logo
    ? `<img src="${d.brand.logo}" style="height:48px;object-fit:contain"/>`
    : AMLAKI_LOGO_SVG;
  return `<html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>إيصال · Receipt ${escapeHTML(d.receiptNumber)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Noto Kufi Arabic","Outfit",system-ui,sans-serif;color:#2c3a2e;background:#faf6ee;margin:0;padding:24px}
  .doc{max-width:640px;margin:auto;background:#fff;border:1px solid rgba(95,126,101,.2);border-radius:22px;padding:30px;box-shadow:0 8px 24px rgba(95,126,101,.08)}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid rgba(95,126,101,.15);padding-bottom:16px;margin-bottom:20px}
  .brand-wrap{display:flex;align-items:center;gap:12px}
  .brand-name{font-weight:900;font-size:18px;color:#3d4d3f;letter-spacing:-.01em}
  .brand-meta{font-size:10.5px;color:#7a8e9a;margin-top:3px;line-height:1.5}
  .title-block{text-align:end}
  h1{margin:0;font-size:22px;color:#3d4d3f;letter-spacing:-.02em;font-weight:900}
  .h-sub{font-size:11px;color:#7a8e9a;margin-top:4px;letter-spacing:.04em;text-transform:uppercase}
  .num-pill{display:inline-block;margin-top:8px;background:linear-gradient(135deg,#5f7e65,#3d4d3f);color:#fff;padding:5px 14px;border-radius:99px;font-family:"Outfit",monospace;font-weight:800;font-size:13px;letter-spacing:.05em}
  .amount-card{background:linear-gradient(135deg,#eef3ea,#dcebd2);border-radius:18px;padding:22px;text-align:center;margin:18px 0;border:1px solid rgba(95,126,101,.2)}
  .amount-label{font-size:11px;color:#5a6a5c;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
  .amount-value{font-size:34px;font-weight:900;color:#3d4d3f;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .partial-tag{display:inline-block;margin-top:8px;background:#f5e3cf;color:#8a5a2a;font-size:10.5px;font-weight:800;padding:4px 12px;border-radius:99px;letter-spacing:.04em}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
  .info{background:#faf6ee;border:1px solid rgba(95,126,101,.12);border-radius:14px;padding:12px 14px}
  .info h3{margin:0 0 8px;font-size:10px;color:#5f7e65;letter-spacing:.08em;text-transform:uppercase;font-weight:800}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed rgba(95,126,101,.15)}
  .row:last-child{border-bottom:0}
  .row span{color:#7a8e9a}
  .row b{color:#3d4d3f;font-weight:700}
  .notes{margin-top:10px;padding:11px 14px;background:#fff7e6;border:1px dashed rgba(168,148,86,.4);border-radius:12px;font-size:11.5px;color:#5a6a5c;line-height:1.6}
  .signs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:30px}
  .sign{border-top:1.5px solid #5f7e65;padding-top:6px;font-size:10.5px;color:#5f7e65;text-align:center;font-weight:800;letter-spacing:.04em}
  .footer{margin-top:20px;text-align:center;font-size:10px;color:#7a8e9a;letter-spacing:.04em;border-top:1px dashed rgba(95,126,101,.2);padding-top:12px}
</style></head><body>
<div class="doc" id="doc-root">
  <div class="head">
    <div class="brand-wrap">
      ${logoHTML}
      <div>
        <div class="brand-name">${escapeHTML(d.brand.landlordName || d.brand.name)}</div>
        <div class="brand-meta">${escapeHTML(d.brand.phone || "")}${d.brand.phone && d.brand.address ? " · " : ""}${escapeHTML(d.brand.address || "")}</div>
      </div>
    </div>
    <div class="title-block">
      <h1>إيصال استلام<br/><span style="font-size:14px;color:#7a8e9a;font-weight:700">Payment Receipt</span></h1>
      <div class="num-pill">#${escapeHTML(d.receiptNumber)}</div>
    </div>
  </div>

  <div class="amount-card">
    <div class="amount-label">المبلغ المستلم · Amount received</div>
    <div class="amount-value">${fmt(d.amount)}</div>
    ${isPartial ? `<div class="partial-tag">دفع جزئي · Partial payment — متبقي · Remaining ${fmt(remaining)}</div>` : ""}
  </div>

  <div class="grid2">
    <div class="info">
      <h3>بيانات الدفع · Payment</h3>
      <div class="row"><span>التاريخ · Date</span><b>${escapeHTML(d.paymentDate)}</b></div>
      <div class="row"><span>طريقة الدفع · Method</span><b>${escapeHTML(d.method)}</b></div>
      ${d.periodLabel ? `<div class="row"><span>عن شهر · For month</span><b>${escapeHTML(d.periodLabel)}</b></div>` : ""}
      ${expected > 0 ? `<div class="row"><span>المتوقع · Expected</span><b>${fmt(expected)}</b></div>` : ""}
    </div>
    <div class="info">
      <h3>العقار والمستأجر · Property</h3>
      <div class="row"><span>المبنى · Building</span><b>${escapeHTML(d.building)}</b></div>
      <div class="row"><span>الوحدة · Unit</span><b>#${escapeHTML(d.unitNumber)}</b></div>
      <div class="row"><span>المستأجر · Tenant</span><b>${escapeHTML(d.tenantName || "—")}</b></div>
    </div>
  </div>

  ${d.notes ? `<div class="notes"><b>ملاحظات · Notes:</b> ${escapeHTML(d.notes)}</div>` : ""}

  <div class="signs">
    <div class="sign">توقيع المؤجر · Lessor signature</div>
    <div class="sign">توقيع المستأجر · Lessee signature</div>
  </div>

  <div class="footer">
    شكراً لسدادك في موعده · Thank you for your timely payment
    <br/>${escapeHTML(d.brand.name)} · تم الإنشاء بواسطة أملاكي · Generated by Amlaki
  </div>
</div></body></html>`;
}

// ============================================================
// Bilingual branded TENANT STATEMENT (account statement)
// ============================================================

export interface StatementRow {
  date: string;
  description: string;
  charge: number;
  payment: number;
  balance: number;
}

export interface TenantStatementData {
  brand: BrandInfo;
  currency: string;
  generatedAt: string;
  tenantName: string;
  tenantPhone?: string | null;
  building: string;
  unitNumber: string;
  contractStart?: string | null;
  contractEnd?: string | null;
  rentAmount: number;
  rentType: string;
  rows: StatementRow[];
  totals: {
    totalCharges: number;
    totalPaid: number;
    outstanding: number;
    openingBalance: number;
    securityDeposit: number;
  };
}

export function buildTenantStatementHTML(d: TenantStatementData): string {
  const fmt = (n: number) => `${Math.round(n).toLocaleString()} ${d.currency}`;
  const logoHTML = d.brand.logo
    ? `<img src="${d.brand.logo}" style="height:48px;object-fit:contain"/>`
    : AMLAKI_LOGO_SVG;
  const rows = d.rows.map((r) => `
    <tr>
      <td>${escapeHTML(r.date)}</td>
      <td>${escapeHTML(r.description)}</td>
      <td class="num">${r.charge > 0 ? fmt(r.charge) : "—"}</td>
      <td class="num pos">${r.payment > 0 ? fmt(r.payment) : "—"}</td>
      <td class="num ${r.balance > 0 ? "neg" : ""}">${fmt(r.balance)}</td>
    </tr>`).join("");

  return `<html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>كشف حساب · Statement</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Noto Kufi Arabic","Outfit",system-ui,sans-serif;color:#2c3a2e;background:#faf6ee;margin:0;padding:24px}
  .doc{max-width:820px;margin:auto;background:#fff;border:1px solid rgba(95,126,101,.2);border-radius:22px;padding:30px;box-shadow:0 8px 24px rgba(95,126,101,.08)}
  .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid rgba(95,126,101,.15);padding-bottom:18px;margin-bottom:22px}
  .brand-wrap{display:flex;align-items:center;gap:12px}
  .brand-name{font-weight:900;font-size:18px;color:#3d4d3f;letter-spacing:-.01em}
  .brand-meta{font-size:10.5px;color:#7a8e9a;margin-top:3px}
  h1{margin:0;font-size:22px;color:#3d4d3f;letter-spacing:-.02em;font-weight:900;text-align:end}
  .h-sub{font-size:11px;color:#7a8e9a;margin-top:4px;text-align:end}
  .section-title{display:flex;align-items:center;gap:10px;margin:22px 0 10px;font-size:13px;font-weight:800;color:#3d4d3f;letter-spacing:.02em}
  .section-title::before{content:"";width:4px;height:16px;background:linear-gradient(135deg,#7a9a7e,#3d4d3f);border-radius:2px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .info{background:#faf6ee;border:1px solid rgba(95,126,101,.12);border-radius:14px;padding:14px 16px}
  .info h3{margin:0 0 8px;font-size:10px;color:#5f7e65;letter-spacing:.08em;text-transform:uppercase;font-weight:800}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px dashed rgba(95,126,101,.15)}
  .row:last-child{border-bottom:0}
  .row span{color:#7a8e9a}
  .row b{color:#3d4d3f;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:11.5px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid rgba(95,126,101,.12);margin-top:8px}
  thead{background:linear-gradient(135deg,#5f7e65,#3d4d3f);color:#fff}
  th,td{padding:9px 11px;text-align:start;border-bottom:1px solid rgba(95,126,101,.08)}
  th{font-weight:700;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase}
  tbody tr:nth-child(even){background:#faf6ee}
  td.num{text-align:end;font-variant-numeric:tabular-nums;font-weight:700}
  .pos{color:#3d4d3f}
  .neg{color:#a85d5d}
  .totals{margin-top:18px;background:linear-gradient(135deg,#3d4d3f,#2c3a2e);color:#faf6ee;border-radius:18px;padding:20px 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .totals .cell{border:1px solid rgba(250,246,238,.15);border-radius:12px;padding:11px 13px;background:rgba(250,246,238,.04)}
  .totals span{display:block;font-size:10px;opacity:.75;margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase}
  .totals b{display:block;font-size:16px;font-weight:900;letter-spacing:-.01em}
  .totals .cell.net{background:linear-gradient(135deg,#a89456,#7d6b3a);border-color:#a89456}
  .footer{margin-top:20px;text-align:center;font-size:10px;color:#7a8e9a;letter-spacing:.04em;border-top:1px dashed rgba(95,126,101,.2);padding-top:12px}
</style></head><body>
<div class="doc" id="doc-root">
  <div class="head">
    <div class="brand-wrap">
      ${logoHTML}
      <div>
        <div class="brand-name">${escapeHTML(d.brand.landlordName || d.brand.name)}</div>
        <div class="brand-meta">${escapeHTML(d.brand.phone || "")}${d.brand.phone && d.brand.address ? " · " : ""}${escapeHTML(d.brand.address || "")}</div>
      </div>
    </div>
    <div>
      <h1>كشف حساب المستأجر<br/><span style="font-size:13px;color:#7a8e9a;font-weight:700">Tenant Statement</span></h1>
      <div class="h-sub">${escapeHTML(d.generatedAt)}</div>
    </div>
  </div>

  <div class="grid2">
    <div class="info">
      <h3>المستأجر · Tenant</h3>
      <div class="row"><span>الاسم · Name</span><b>${escapeHTML(d.tenantName || "—")}</b></div>
      ${d.tenantPhone ? `<div class="row"><span>الهاتف · Phone</span><b>${escapeHTML(d.tenantPhone)}</b></div>` : ""}
      <div class="row"><span>المبنى · Building</span><b>${escapeHTML(d.building)}</b></div>
      <div class="row"><span>الوحدة · Unit</span><b>#${escapeHTML(d.unitNumber)}</b></div>
    </div>
    <div class="info">
      <h3>تفاصيل العقد · Lease</h3>
      <div class="row"><span>قيمة الإيجار · Rent</span><b>${fmt(d.rentAmount)} / ${escapeHTML(d.rentType)}</b></div>
      <div class="row"><span>بداية العقد · Start</span><b>${escapeHTML(d.contractStart || "—")}</b></div>
      <div class="row"><span>نهاية العقد · End</span><b>${escapeHTML(d.contractEnd || "—")}</b></div>
      <div class="row"><span>التأمين · Deposit</span><b>${fmt(d.totals.securityDeposit)}</b></div>
    </div>
  </div>

  <div class="section-title">حركة الحساب · Account activity</div>
  <table>
    <thead><tr>
      <th>التاريخ · Date</th>
      <th>البيان · Description</th>
      <th style="text-align:end">مستحق · Charge</th>
      <th style="text-align:end">مدفوع · Paid</th>
      <th style="text-align:end">الرصيد · Balance</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#7a8e9a;padding:18px">— لا توجد حركات · No entries —</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div class="cell"><span>إجمالي المستحق · Total charges</span><b>${fmt(d.totals.totalCharges)}</b></div>
    <div class="cell"><span>إجمالي المدفوع · Total paid</span><b>${fmt(d.totals.totalPaid)}</b></div>
    <div class="cell net"><span>الرصيد المستحق · Outstanding</span><b>${fmt(d.totals.outstanding)}</b></div>
  </div>

  <div class="footer">
    ${escapeHTML(d.brand.name)} ${d.brand.phone ? "· " + escapeHTML(d.brand.phone) : ""}
    <br/>تم الإنشاء بواسطة أملاكي · Generated by Amlaki
  </div>
</div></body></html>`;
}
