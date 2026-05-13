import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, Printer, Trash2, Search, Calendar, Plus, Download, Pencil, Archive } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { EditPaymentDialog } from "@/components/EditPaymentDialog";
import { PinDialog } from "@/components/PinDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { useAppSettings, readFilters, writeFilters } from "@/lib/appSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Row {
  id: string;
  unit_id: string;
  amount: number;
  payment_date: string;
  receipt_number: string | null;
  unit_number: string;
  building_name: string;
  tenant_name: string | null;
  unit_status: string;
  period_start: string | null;
}

type Filter = "all" | "month" | "year";
type StatusFilter = "all" | "paid" | "late";

const LS_KEY = "amlaki.payments.filters.v2";
const DEFAULT_FILTERS = { search: "", filter: "month" as Filter, statusFilter: "all" as StatusFilter };

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthLabel(dateStr: string | null, lang: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const names = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  return `${names[d.getMonth()]} ${d.getFullYear()}`;
}

export default function Payments() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { format, currency } = useCurrency();
  const { settings } = useAppSettings();
  const initial = readFilters(LS_KEY, DEFAULT_FILTERS, settings.filterRetentionMin);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState(initial.search);
  const [filter, setFilter] = useState<Filter>(initial.filter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initial.statusFilter);
  const [delId, setDelId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pinForDel, setPinForDel] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    writeFilters(LS_KEY, { search, filter, statusFilter }, settings.filterRetentionMin);
  }, [search, filter, statusFilter, settings.filterRetentionMin]);

  const load = async () => {
    setLoading(true);
    const { data: pays } = await supabase
      .from("payments")
      .select("id, unit_id, amount, payment_date, receipt_number, period_start")
      .is("deleted_at", null)
      .order("payment_date", { ascending: false })
      .limit(500);
    const unitIds = Array.from(new Set((pays || []).map((p: any) => p.unit_id)));
    const { data: units } = unitIds.length
      ? await supabase.from("units").select("id, unit_number, tenant_name, status, building_id").in("id", unitIds)
      : { data: [] as any[] };
    const buildingIds = Array.from(new Set((units || []).map((u: any) => u.building_id)));
    const { data: builds } = buildingIds.length
      ? await supabase.from("buildings").select("id, name, name_en").in("id", buildingIds)
      : { data: [] as any[] };
    const uMap = new Map((units || []).map((u: any) => [u.id, u]));
    const bMap = new Map((builds || []).map((b: any) => [b.id, b]));
    const mapped: Row[] = (pays || []).map((p: any) => {
      const u: any = uMap.get(p.unit_id);
      const b: any = u ? bMap.get(u.building_id) : null;
      return {
        id: p.id,
        unit_id: p.unit_id,
        amount: Number(p.amount),
        payment_date: p.payment_date,
        receipt_number: p.receipt_number,
        period_start: p.period_start,
        unit_number: u?.unit_number ?? "—",
        tenant_name: u?.tenant_name ?? null,
        building_name: b?.name || b?.name_en || "—",
        unit_status: u?.status ?? "soon",
      };
    });
    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const d = new Date(r.payment_date);
      if (filter === "month" && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (filter === "year" && d.getFullYear() !== now.getFullYear()) return false;
      if (statusFilter === "paid" && r.unit_status !== "paid") return false;
      if (statusFilter === "late" && r.unit_status !== "late") return false;
      if (q) {
        return (
          r.receipt_number?.toLowerCase().includes(q) ||
          r.unit_number.toLowerCase().includes(q) ||
          r.building_name.toLowerCase().includes(q) ||
          r.tenant_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, filter, statusFilter]);

  const total = filtered.reduce((s, r) => s + r.amount, 0);

  const handleDelete = async () => {
    if (!delId) return;
    // soft delete → goes to recycle bin
    const { error } = await supabase.from("payments").update({ deleted_at: new Date().toISOString() }).eq("id", delId);
    if (error) return toast.error(error.message);
    toast.success(lang === "ar" ? "نُقلت إلى السلة (30 يوم للاسترجاع)" : "Moved to bin (30-day restore)");
    setDelId(null);
    load();
  };

  const onDeleteClick = (id: string) => {
    if (settings.deletePin) setPinForDel(id);
    else setDelId(id);
  };

  const buildReceiptHTML = (r: Row) => {
    const sc = settings.statusColors;
    const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
      paid: { bg: sc.paid.bg, fg: sc.paid.fg, label: t2("paid") },
      late: { bg: sc.late.bg, fg: sc.late.fg, label: t2("late") },
      soon: { bg: sc.soon.bg, fg: sc.soon.fg, label: t2("soon") },
    };
    const us = statusColors[r.unit_status] || statusColors.soon;
    const brand = settings.brand;
    const brandHeader = brand.logo
      ? `<img src="${brand.logo}" style="height:46px;object-fit:contain"/>`
      : `<h1>${brand.name}</h1>`;
    const html = `
      <html><head><title>${r.receipt_number || r.id}</title>
      <style>
        @page{size:${settings.pageSize};margin:${settings.margins.top}mm ${settings.margins.right}mm ${settings.margins.bottom}mm ${settings.margins.left}mm}
        *{box-sizing:border-box}
        body{font-family:system-ui,-apple-system,sans-serif;color:#3a4f3a;background:#faf6ee;margin:0;padding:0}
        .card{border:2px solid #a3b89c;border-radius:24px;padding:28px;background:#fff;max-width:560px;margin:auto;position:relative;overflow:hidden}
        .watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:90px;font-weight:900;color:#a3b89c;opacity:.08;pointer-events:none;letter-spacing:8px}
        .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #eef3ea;padding-bottom:14px;margin-bottom:14px}
        h1{margin:0 0 2px;font-size:22px;color:#5a7359}
        .sub{color:#7a8a78;font-size:11px;letter-spacing:2px;text-transform:uppercase}
        .brand-meta{font-size:10px;color:#9aa898;margin-top:4px}
        .badge{display:inline-block;padding:6px 14px;border-radius:999px;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:1px;background:${us.bg};color:${us.fg}}
        .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:14px;font-size:12px}
        .meta div{padding:8px 12px;background:#f6faf3;border-radius:10px}
        .meta b{display:block;color:#5a7359;font-size:13px;margin-top:2px}
        .meta span{color:#7a8a78;font-size:10px;text-transform:uppercase;letter-spacing:1px}
        .row{display:flex;justify-content:space-between;padding:11px 4px;border-bottom:1px dashed #cdd9c8;font-size:13px}
        .row span{color:#7a8a78}
        .row b{color:#3a4f3a}
        .total{margin-top:18px;padding:18px 22px;background:linear-gradient(135deg,#eef3ea,#dcebd2);border-radius:18px;display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:22px;color:#3a6b3a}
        .footer{margin-top:18px;text-align:center;color:#9aa898;font-size:10px;letter-spacing:1px}
        .unit-pill{display:inline-block;padding:4px 10px;border-radius:8px;background:#5a7359;color:#fff;font-weight:800;font-size:13px;margin-inline-end:6px}
      </style></head><body>
        <div class="card" id="receipt-card">
          <div class="watermark">${us.label}</div>
          <div class="header">
            <div>
              ${brandHeader}
              <p class="sub">${t2("receipt_number")} · ${r.receipt_number || "—"}</p>
              ${brand.address || brand.phone ? `<p class="brand-meta">${brand.address || ""} ${brand.phone ? "· " + brand.phone : ""}</p>` : ""}
            </div>
            <span class="badge">${us.label}</span>
          </div>
          <div class="meta">
            <div><span>${t2("payment_date")}</span><b>${r.payment_date}</b></div>
            <div><span>${t2("building_name")}</span><b>${r.building_name}</b></div>
          </div>
          <div class="row"><span>${t2("unit_number")}</span><b><span class="unit-pill">#${r.unit_number}</span></b></div>
          <div class="row"><span>${t2("occupancy_status") || t2("status")}</span><b style="color:${us.fg}">${us.label}</b></div>
          <div class="row"><span>${t2("tenant_name")}</span><b>${r.tenant_name || "—"}</b></div>
          ${r.period_start ? `<div class="row"><span>${t2("rent_month")}</span><b>${monthLabel(r.period_start, lang)}</b></div>` : ""}
          <div class="total"><span>${t2("total")}</span><span>${format(r.amount)}</span></div>
          <div class="footer">— ${t2("issue_receipt") || "Receipt"} —</div>
        </div>
      </body></html>`;
    return { us, html };
  };

  const printReceipt = (r: Row) => {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    const { html } = buildReceiptHTML(r);
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const downloadReceiptPDF = async (r: Row) => {
    const { html } = buildReceiptHTML(r);
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "640px";
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      const card = container.querySelector("#receipt-card") as HTMLElement;
      const canvas = await html2canvas(card, { scale: 2, backgroundColor: "#ffffff" });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: settings.pageSize.toLowerCase() as any });
      const pageW = pdf.internal.pageSize.getWidth();
      const m = settings.margins;
      const w = pageW - m.left - m.right;
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, "PNG", m.left, m.top, w, h);
      pdf.save(`${r.receipt_number || r.id}.pdf`);
    } catch (e: any) {
      toast.error(e.message || "PDF error");
    } finally {
      document.body.removeChild(container);
    }
  };


  return (
    <div className="mobile-shell min-h-screen pb-24 bg-background">
      <TopBar />

      <div className="px-5 pt-2 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-sage-600">{t2("payments")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t2("receipts")}</p>
        </div>
        <div className="flex gap-1.5">
          <Link to="/payments/trash">
            <Button size="sm" variant="outline" className="rounded-xl border-sage-300 text-sage-600">
              <Archive className="h-3.5 w-3.5 me-1" />
              {lang === "ar" ? "السلة" : "Bin"}
            </Button>
          </Link>
          <Button size="sm" variant="outline" className="rounded-xl border-sage-300 text-sage-600"
            onClick={() => import("@/lib/exportCSV").then(({ exportToCSV }) => exportToCSV(
              `payments-${new Date().toISOString().slice(0,10)}`,
              filtered.map((r) => ({
                date: r.payment_date, receipt: r.receipt_number || "", building: r.building_name,
                unit: r.unit_number, tenant: r.tenant_name || "", amount: r.amount, status: r.unit_status,
              }))
            ))}>
            <Download className="h-3.5 w-3.5 me-1" />CSV
          </Button>
        </div>
      </div>

      {/* Stat */}
      <div className="px-5 mt-4">
        <div className="rounded-3xl bg-gradient-deep text-primary-foreground p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wider opacity-75">
            {filter === "month" ? t2("this_month") : filter === "year" ? t2("filter_year") : t2("all_payments")}
          </p>
          <p className="text-3xl font-black mt-1">{format(total)}</p>
          <p className="text-xs opacity-80 mt-1">{filtered.length} {t2("receipts")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 mt-4 space-y-3">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-sage-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search" as any) || "..."}
            className="ps-10 rounded-xl border-sage-200 bg-card h-11" />
        </div>
        <div className="flex gap-1.5">
          {(["month", "year", "all"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === f ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
              }`}>
              {t2(f === "all" ? "filter_all" : f === "month" ? "filter_month" : "filter_year")}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["all", "paid", "late"] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === s
                  ? s === "paid"
                    ? "bg-sage-300/40 text-sage-600 ring-1 ring-sage-400"
                    : s === "late"
                      ? "bg-burgundy/15 text-burgundy ring-1 ring-burgundy/40"
                      : "bg-gradient-sage text-primary-foreground shadow-soft"
                  : "bg-muted text-muted-foreground"
              }`}>
              {t2(s === "all" ? "filter_all" : s)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-5 mt-4 space-y-2.5">
        {loading ? (
          <p className="text-center text-sage-500 py-12 text-sm">{t("loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex p-4 rounded-3xl bg-sage-100 mb-3">
              <Receipt className="h-8 w-8 text-sage-400" />
            </div>
            <p className="font-bold text-sage-600">{t2("no_payments_msg")}</p>
          </div>
        ) : (
          filtered.map((r, i) => (
            <div key={r.id}
              className="bg-card border border-sage-200/40 rounded-2xl p-4 shadow-soft animate-float-up"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
              <div className="flex items-start gap-3">
                <Link to={`/units/${r.unit_id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sage-600 truncate">{r.building_name} · {r.unit_number}</span>
                  </div>
                  {r.tenant_name && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.tenant_name}</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-sage-500">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{r.payment_date}</span>
                    {r.receipt_number && <span className="font-mono">{r.receipt_number}</span>}
                    {r.period_start && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sage-100 text-sage-600 font-semibold">
                        {lang === "ar" ? "إيجار" : "Rent"} {monthLabel(r.period_start, lang)}
                      </span>
                    )}
                  </div>
                </Link>
                <div className="text-end">
                  <p className="font-black text-sage-600 text-lg whitespace-nowrap">{format(r.amount)}</p>
                  <div className="flex gap-1 mt-1 justify-end flex-wrap">
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-sage-500" onClick={() => printReceipt(r)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-sage-600" onClick={() => downloadReceiptPDF(r)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-sage-600" onClick={() => setEditId(r.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-burgundy hover:bg-burgundy/10" onClick={() => onDeleteClick(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <button onClick={() => setAddOpen(true)} aria-label={t2("register_payment")}
        className="fixed bottom-24 end-5 z-30 h-14 w-14 rounded-full bg-gradient-sage text-primary-foreground shadow-soft flex items-center justify-center active:scale-95 transition-transform">
        <Plus className="h-6 w-6" />
      </button>

      <AddPaymentDialog open={addOpen} onOpenChange={setAddOpen} onSaved={load} />
      <EditPaymentDialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)} paymentId={editId} onSaved={load} />
      <BottomNav />
      <ConfirmDeleteDialog
        open={!!delId}
        onOpenChange={(o) => !o && setDelId(null)}
        onConfirm={handleDelete}
        title={lang === "ar" ? "نقل إلى السلة؟" : "Move to bin?"}
        description={lang === "ar" ? "يمكنك استرجاعها خلال 30 يوماً" : "You can restore within 30 days"}
      />
      <PinDialog
        open={!!pinForDel}
        onOpenChange={(o) => !o && setPinForDel(null)}
        expectedPin={settings.deletePin || ""}
        onSuccess={() => { setDelId(pinForDel); setPinForDel(null); }}
        title={lang === "ar" ? "تأكيد الحذف" : "Confirm delete"}
      />
    </div>
  );
}
