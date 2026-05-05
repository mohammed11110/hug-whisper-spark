// Lightweight PDF generator for receipts & lease contracts using html2canvas+jsPDF
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { AppSettings } from "@/lib/appSettings";

export interface BrandInfo {
  name: string;
  logo: string | null;
  phone: string;
  address: string;
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
      <div class="row"><span>${L.name}</span><b>${d.brand.name}</b></div>
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

export function printHTML(html: string) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 350);
}
