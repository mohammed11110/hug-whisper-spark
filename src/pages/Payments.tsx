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
import { useI18n, docLang } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { useAppSettings, readFilters, writeFilters } from "@/lib/appSettings";
import { getUnitArrears, getCycleForPeriodStart } from "@/lib/balance";
import { suffixOf, isPartialSuffix, isFinalSuffix, derivePartialMetaForDisplay, type DerivedPartialMeta } from "@/lib/receiptNumbering";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { isNative } from "@/lib/nativeFiles";
import { downloadHTMLAsPDF, downloadReceiptPDFDirect, printReceiptPDFDirect, type ReceiptData } from "@/lib/pdfDocs";
import { isIOS } from "@/lib/platform";

interface Row {
  id: string;
  unit_id: string;
  amount: number;
  expected_amount: number | null;
  payment_date: string;
  receipt_number: string | null;
  unit_number: string;
  building_name: string;
  tenant_name: string | null;
  unit_status: string;
  period_start: string | null;
  period_end: string | null;
  tenancy_id: string | null;
  remaining: number;
  /** Display-only suffix derived from cycle context when the stored
   *  `receipt_number` has none. Lets legacy receipts visually join the new
   *  partial-cycle system without DB writes. */
  derivedMeta?: DerivedPartialMeta;
  /** Minimal unit context needed to rebuild the canonical cycle label
   *  (contract_start_date drives whether the receipt shows a full month or
   *  a D/M → (D-1)/(M+1) range). */
  unit_ctx: { contract_start_date?: string | null; opening_balance_date?: string | null; due_day?: number | null };
}

type Filter = "all" | "month" | "year";
type StatusFilter = "all" | "paid" | "late";

const LS_KEY = "amlaki.payments.filters.v2";
const DEFAULT_FILTERS = { search: "", filter: "month" as Filter, statusFilter: "all" as StatusFilter };

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Canonical cycle label for a stored payment. Honors contract start day so a
 *  contract starting 10/1/2026 shows "إيجار الفترة من 10/1/2026 إلى 9/2/2026"
 *  and a contract starting on the 1st shows "إيجار شهر يونيو 2026". */
function cycleLabel(r: Row, lang: string): string {
  if (!r.period_start) return "";
  const c = getCycleForPeriodStart(r.unit_ctx as any, r.period_start, lang as "ar" | "en");
  if (c) return c.label;
  // Legacy fallback: derive a full-month label.
  const d = new Date(r.period_start);
  const names = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  return `${names[d.getMonth()]} ${d.getFullYear()}`;
}



const RECEIPT_TXT = {
  ar: {
    receipt_number: "رقم الإيصال", payment_date: "تاريخ الدفع", building_name: "المبنى",
    unit_number: "رقم الوحدة", status: "الحالة", tenant_name: "المستأجر",
    rent_month: "شهر الإيجار", amount_paid: "المبلغ المدفوع", receipt: "إيصال استلام",
    paid: "مدفوع", late: "متأخر", soon: "قريباً", partial: "جزئي",
    total_due: "إجمالي مستحق الدورة", remaining_after: "المتبقي على الدورة", settled: "مسدد بالكامل",
    summary: "ملخص الدفعة",
    other_outstanding: "متأخرات أخرى على الوحدة",
    partial_note: (n: number) => `دفعة جزئية رقم ${n} — الدورة قيد التحصيل`,
    final_note: "الدفعة الختامية — الدورة مسدّدة بالكامل",
  },
  en: {
    receipt_number: "Receipt #", payment_date: "Payment date", building_name: "Building",
    unit_number: "Unit #", status: "Status", tenant_name: "Tenant",
    rent_month: "Rent month", amount_paid: "Amount paid", receipt: "Payment Receipt",
    paid: "Paid", late: "Late", soon: "Upcoming", partial: "Partial",
    total_due: "Cycle total due", remaining_after: "Cycle remaining", settled: "Fully settled",
    summary: "Payment summary",
    other_outstanding: "Other outstanding on unit",
    partial_note: (n: number) => `Partial payment ${n} — cycle in progress`,
    final_note: "Final payment — cycle fully settled",
  },
} as const;
type RLang = keyof typeof RECEIPT_TXT;

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
  const receiptLang: RLang = docLang(lang);

  useEffect(() => {
    writeFilters(LS_KEY, { search, filter, statusFilter }, settings.filterRetentionMin);
  }, [search, filter, statusFilter, settings.filterRetentionMin]);

  const load = async () => {
    setLoading(true);
    const { data: pays } = await supabase
      .from("payments")
      .select("id, unit_id, amount, expected_amount, payment_date, receipt_number, period_start, period_end, tenancy_id, created_at, kind, deleted_at")
      .is("deleted_at", null)
      .order("payment_date", { ascending: false })
      .limit(500);
    const unitIds = Array.from(new Set((pays || []).map((p: any) => p.unit_id)));
    const { data: units } = unitIds.length
      ? await supabase.from("units").select("id, unit_number, tenant_name, status, building_id, rent_amount, rent_type, contract_start_date, due_day, rent_timing, opening_balance, opening_balance_date, paid_up_to").in("id", unitIds)
      : { data: [] as any[] };
    const buildingIds = Array.from(new Set((units || []).map((u: any) => u.building_id)));
    const { data: builds } = buildingIds.length
      ? await supabase.from("buildings").select("id, name, name_en").in("id", buildingIds)
      : { data: [] as any[] };
    // All non-deleted payments for involved units (used for outstanding balance + cycle derivation).
    const { data: allPays } = unitIds.length
      ? await supabase.from("payments").select("id, unit_id, amount, expected_amount, deleted_at, payment_date, period_start, period_end, tenancy_id, created_at, receipt_number, kind").in("unit_id", unitIds).is("deleted_at", null)
      : { data: [] as any[] };
    // Active-lease map keeps each unit's outstanding limited to the
    // current tenant — past tenant payments stay archived but don't bleed in.
    const { data: activeTs } = unitIds.length
      ? await supabase.from("tenancies").select("id, unit_id").in("unit_id", unitIds).eq("status", "active")
      : { data: [] as any[] };
    const activeMap = new Map<string, string>((activeTs || []).map((t: any) => [t.unit_id, t.id]));
    const activeTenancyIds = new Set<string>((activeTs || []).map((t: any) => t.id));
    const uMap = new Map((units || []).map((u: any) => [u.id, u]));
    const bMap = new Map((builds || []).map((b: any) => [b.id, b]));
    const remainingMap = new Map<string, number>();
    (units || []).forEach((u: any) => {
      const { totalShortfall } = getUnitArrears(u, allPays || [], new Date(), lang as "ar" | "en", activeMap.get(u.id) || null);
      remainingMap.set(u.id, totalShortfall);
    });
    // Compute display-only partial metadata for every payment in scope.
    const derivedMap = derivePartialMetaForDisplay((allPays || []) as any, { activeTenancyIds });
    const mapped: Row[] = (pays || []).map((p: any) => {
      const u: any = uMap.get(p.unit_id);
      const b: any = u ? bMap.get(u.building_id) : null;
      return {
        id: p.id,
        unit_id: p.unit_id,
        amount: Number(p.amount),
        expected_amount: p.expected_amount == null ? null : Number(p.expected_amount),
        payment_date: p.payment_date,
        receipt_number: p.receipt_number,
        period_start: p.period_start,
        period_end: p.period_end ?? null,
        tenancy_id: p.tenancy_id ?? null,
        unit_number: u?.unit_number ?? "—",
        tenant_name: u?.tenant_name ?? null,
        building_name: b?.name || b?.name_en || "—",
        unit_status: u?.status ?? "soon",
        remaining: remainingMap.get(p.unit_id) ?? 0,
        derivedMeta: derivedMap.get(p.id),
        unit_ctx: {
          contract_start_date: u?.contract_start_date ?? null,
          opening_balance_date: u?.opening_balance_date ?? null,
          due_day: u?.due_day ?? null,
        },
      };
    });
    setRows(mapped);
    setLoading(false);
  };


  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("amlaki:payment-added", h);
    return () => window.removeEventListener("amlaki:payment-added", h);
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      const d = new Date(r.payment_date);
      if (filter === "month" && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (filter === "year" && d.getFullYear() !== now.getFullYear()) return false;
      if (statusFilter === "paid" && !(r.remaining <= 0.009)) return false;
      if (statusFilter === "late" && !(r.remaining > 0.009)) return false;
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
    // Newest payment first; tie-break by id for stable order.
    return list.sort((a, b) => {
      const d = (b.payment_date || "").localeCompare(a.payment_date || "");
      return d !== 0 ? d : b.id.localeCompare(a.id);
    });
  }, [rows, search, filter, statusFilter]);

  const total = filtered.reduce((s, r) => s + r.amount, 0);

  const handleDelete = async () => {
    if (!delId) return;
    const target = rows.find((r) => r.id === delId);
    // soft delete → goes to recycle bin
    const { error } = await supabase.from("payments").update({ deleted_at: new Date().toISOString() }).eq("id", delId);
    if (error) return toast.error(error.message);
    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(target?.unit_id ?? null);
    if (target) {
      const { data: u } = await supabase.from("units").select("building_id").eq("id", target.unit_id).maybeSingle();
      logActivity({
        entityType: "payment",
        action: "deleted",
        entityId: delId,
        entityLabel: target.receipt_number || target.tenant_name || target.unit_number,
        buildingId: (u as any)?.building_id ?? null,
        descriptionAr: `حذف إيصال استلام بقيمة ${target.amount} — ${target.tenant_name || target.unit_number}`,
        descriptionEn: `Receipt deleted (amount ${target.amount}) — ${target.tenant_name || target.unit_number}`,
        changes: { amount: target.amount, receipt_number: target.receipt_number },
      });
    }
    toast.success(lang === "ar" ? "نُقلت إلى السلة (30 يوم للاسترجاع)" : "Moved to bin (30-day restore)");
    setDelId(null);
    load();
  };

  const onDeleteClick = (id: string) => {
    if (settings.deletePin) setPinForDel(id);
    else setDelId(id);
  };

  const buildReceiptHTML = (r: Row, lng: RLang) => {
    const L = RECEIPT_TXT[lng];
    const dir = lng === "ar" ? "rtl" : "ltr";
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    // Cycle-only totals — use cumulative cycle data so receipts reflect ALL
    // installments of the same (unit + period), not just this single row.
    const meta = r.derivedMeta;
    const cycleDue = meta?.cycleDue && meta.cycleDue > 0
      ? meta.cycleDue
      : (r.expected_amount && r.expected_amount > 0 ? r.expected_amount : r.amount);
    const cumulativePaid = meta?.cumulativePaid ?? r.amount;
    const receiptTotalDue = cycleDue;
    const receiptRemaining = Math.max(0, cycleDue - cumulativePaid);
    // Outstanding on the unit that belongs to OTHER cycles (informative only).
    const otherOutstanding = Math.max(0, r.remaining - receiptRemaining);
    const sc = settings.statusColors;
    const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
      paid: { bg: sc.paid.bg, fg: sc.paid.fg, label: L.paid },
      late: { bg: sc.late.bg, fg: sc.late.fg, label: L.late },
      soon: { bg: sc.soon.bg, fg: sc.soon.fg, label: L.soon },
      partial: { bg: "#f5e3cf", fg: "#8a5a2a", label: L.partial },
    };
    // Cycle-level installment context (suffix can come from stored or derived).
    const sfx = meta?.derivedSuffix ?? suffixOf(r.receipt_number);
    const isPartialInstallment = isPartialSuffix(sfx);
    const isFinalInstallment = isFinalSuffix(sfx) || (meta?.cycleClosed && (meta?.cycleSize ?? 1) > 1 && !isPartialInstallment);
    const partialIndex = isPartialInstallment ? parseInt(sfx as string, 10) : 0;
    const installmentNote = isPartialInstallment
      ? L.partial_note(partialIndex)
      : (isFinalInstallment ? L.final_note : "");
    // Status describes THIS receipt's cycle, not the whole unit.
    const cycleClosed = receiptRemaining <= 0.009 || !!meta?.cycleClosed;
    const cycleStatusKey = isPartialInstallment
      ? "partial"
      : (cycleClosed ? "paid" : "late");
    const us = statusColors[cycleStatusKey];
    const showStatus = true;
    const brand = settings.brand;
    const brandHeader = brand.logo
      ? `<img src="${esc(brand.logo)}" style="height:46px;object-fit:contain"/>`
      : `<h1>${esc(brand.name)}</h1>`;
    const html = `
      <html dir="${dir}"><head><meta charset="utf-8"/><title>${esc(r.receipt_number || r.id)}</title>
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
        
      </style></head><body>
        <div class="card" id="receipt-card">
          ${showStatus ? `<div class="watermark">${us.label}</div>` : ""}
          <div class="header">
            <div>
              ${brandHeader}
              <p class="sub">${esc(L.receipt_number)} · ${esc(r.receipt_number || "—")}</p>
              ${installmentNote ? `<p style="margin:4px 0 0;font-size:11px;font-weight:700;color:${isFinalInstallment ? "#3a6b3a" : "#8a5a2a"}">${esc(installmentNote)}</p>` : ""}
              ${brand.address || brand.phone ? `<p class="brand-meta">${esc(brand.address || "")} ${brand.phone ? "· " + esc(brand.phone) : ""}</p>` : ""}
            </div>
            ${showStatus ? `<span class="badge">${esc(us.label)}</span>` : ""}
          </div>
          <div class="meta">
            <div><span>${esc(L.payment_date)}</span><b>${esc(r.payment_date)}</b></div>
            <div><span>${esc(L.building_name)}</span><b>${esc(r.building_name)}</b></div>
          </div>
          <div class="row"><span>${esc(L.unit_number)}</span><b>#${esc(r.unit_number)}</b></div>
          
          <div class="row"><span>${esc(L.tenant_name)}</span><b>${esc(r.tenant_name || "—")}</b></div>
          ${r.period_start ? `<div class="row"><span>${esc(L.rent_month)}</span><b>${esc(cycleLabel(r, lng))}</b></div>` : ""}
          
          <div style="margin-top:18px;padding:16px 18px;background:#f6faf3;border:1px solid #cdd9c8;border-radius:14px">
            <div style="font-size:11px;color:#7a8a78;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;font-weight:700">${L.summary}</div>
            <div class="row"><span>${L.total_due}</span><b>${format(receiptTotalDue)}</b></div>
            <div class="row" style="border-bottom:none"><span>${L.amount_paid}</span><b style="color:#3a6b3a;font-size:15px">− ${format(cumulativePaid)}${cumulativePaid !== r.amount ? ` <span style="font-weight:600;font-size:11px;color:#7a8a78">(${lng === "ar" ? "هذه الدفعة" : "this payment"}: ${format(r.amount)})</span>` : ''}</b></div>
          </div>

          <div class="total"><span>${L.amount_paid}</span><span>${format(r.amount)}</span></div>
          <div class="remaining" style="margin-top:10px;padding:14px 18px;border-radius:14px;display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px;${receiptRemaining > 0 ? 'background:#f8e6e6;color:#8a2a2a;border:1px solid #e8c2c2' : 'background:#e7f1de;color:#3a6b3a;border:1px solid #bcd4ad'}">
            <span>${L.remaining_after}</span><span>${format(receiptRemaining)}${receiptRemaining === 0 ? ` · ${L.settled}` : ''}</span>
          </div>
          ${otherOutstanding > 0.009 ? `
          <div style="margin-top:8px;padding:10px 16px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:12px;background:#f7ede4;color:#8a5a2a;border:1px dashed #d9b893">
            <span>${L.other_outstanding}</span><span>${format(otherOutstanding)}</span>
          </div>` : ""}
          <div class="footer">— ${L.receipt} —</div>
        </div>
      </body></html>`;
    return { us, html };
  };

  const buildReceiptDocData = (r: Row, lng: RLang): ReceiptData => {
    const L = RECEIPT_TXT[lng];
    const meta = r.derivedMeta;
    const cycleDue = meta?.cycleDue && meta.cycleDue > 0
      ? meta.cycleDue
      : (r.expected_amount && r.expected_amount > 0 ? r.expected_amount : r.amount);
    const cumulativePaid = meta?.cumulativePaid ?? r.amount;
    const receiptRemaining = Math.max(0, cycleDue - cumulativePaid);
    const otherOutstanding = Math.max(0, r.remaining - receiptRemaining);
    const sfx = meta?.derivedSuffix ?? suffixOf(r.receipt_number);
    const isPartialInstallment = isPartialSuffix(sfx);
    const isFinalInstallment = isFinalSuffix(sfx) || (meta?.cycleClosed && (meta?.cycleSize ?? 1) > 1 && !isPartialInstallment);
    const partialIndex = isPartialInstallment ? parseInt(sfx as string, 10) : 0;
    const installmentNote = isPartialInstallment
      ? L.partial_note(partialIndex)
      : (isFinalInstallment ? L.final_note : "");
    const cycleClosed = receiptRemaining <= 0.009 || !!meta?.cycleClosed;
    const statusKey: ReceiptData["statusKey"] = isPartialInstallment
      ? "partial"
      : (cycleClosed ? "paid" : "late");
    const statusLabel = {
      paid: L.paid,
      late: L.late,
      soon: L.soon,
      partial: L.partial,
    }[statusKey || "paid"];

    return {
      brand: settings.brand,
      receiptNumber: r.receipt_number || r.id,
      paymentDate: r.payment_date,
      amount: r.amount,
      expectedAmount: cycleDue,
      periodLabel: r.period_start ? cycleLabel(r, lng) : "—",
      building: r.building_name,
      unitNumber: r.unit_number,
      tenantName: r.tenant_name || "—",
      currency,
      lang: lng,
      cycleTotalDue: cycleDue,
      cyclePaidToDate: cumulativePaid,
      cycleRemaining: receiptRemaining,
      otherOutstanding,
      statusKey,
      statusLabel,
      installmentNote,
    };
  };

  const printReceipt = (r: Row, lng: RLang = receiptLang) => {
    try {
      const filename = `${r.receipt_number || r.id}.pdf`;
      const receiptData = buildReceiptDocData(r, lng);
      // Native iOS/Android: generate a real PDF and hand it to the OS print
      // flow. This avoids window.open/sessionStorage/window.print issues.
      if (isNative()) {
        void printReceiptPDFDirect(receiptData, filename).catch((e: any) => {
          console.error("[receipt:print:native]", e);
          toast.error(String(e?.message || e) || "Print error");
        });
        return;
      }
      // Mobile Safari: generate the PDF and hand it to the platform viewer /
      // share flow so the user can print from there.
      if (isIOS()) {
        void printReceiptPDFDirect(receiptData, filename).catch((e: any) => {
          console.error("[receipt:print:ios]", e);
          toast.error(String(e?.message || e) || "Print error");
        });
        return;
      }
      const { html } = buildReceiptHTML(r, lng);
      // Web fallback: open a new window and trigger window.print().
      const w = window.open("", "_blank", "width=600,height=800");
      if (!w) {
        void downloadHTMLAsPDF(html, filename, settings).catch((e: any) => {
          console.error("[receipt:print:web-fallback]", e);
          toast.error(String(e?.message || e) || "Print error");
        });
        return;
      }
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
    } catch (e: any) {
      console.error("[receipt:print]", e);
      toast.error(String(e?.message || e) || "Print error");
    }
  };

  const downloadReceiptPDF = async (r: Row, lng: RLang = receiptLang) => {
    try {
      const filename = `${r.receipt_number || r.id}.pdf`;
      const receiptData = buildReceiptDocData(r, lng);
      if (isNative()) {
        await downloadReceiptPDFDirect(receiptData, filename);
        return;
      }
      if (isIOS()) {
        await downloadReceiptPDFDirect(receiptData, filename);
        return;
      }
      const { html } = buildReceiptHTML(r, lng);
      // Web: render via html2canvas + jsPDF and trigger pdf.save().
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
        pdf.save(filename);
      } finally {
        document.body.removeChild(container);
      }
    } catch (e: any) {
      console.error("[receipt:download]", e);
      toast.error(String(e?.message || e) || "PDF error");
    }
  };



  return (
    <div className="mobile-shell min-h-screen pb-24 md:pb-8 bg-background">
      <TopBar />

      <div className="px-5 md:px-8 lg:px-12 pt-2 flex items-start justify-between gap-2">
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
                rent_month: r.period_start ? cycleLabel(r, lang) : "",
              }))
            ))}>
            <Download className="h-3.5 w-3.5 me-1" />CSV
          </Button>
        </div>
      </div>




      {/* Stat */}
      <div className="px-5 md:px-8 lg:px-12 mt-4">
        <div className="rounded-3xl bg-gradient-deep text-primary-foreground p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wider opacity-75">
            {filter === "month" ? t2("this_month") : filter === "year" ? t2("filter_year") : t2("all_payments")}
          </p>
          <p className="text-3xl font-black mt-1">{format(total)}</p>
          <p className="text-xs opacity-80 mt-1">{filtered.length} {t2("receipts")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 md:px-8 lg:px-12 mt-4 space-y-3">
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
      <div className="px-5 md:px-8 lg:px-12 mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 md:gap-4 items-start">
        {loading ? (
          <p className="md:col-span-2 lg:col-span-3 text-center text-sage-500 py-12 text-sm">{t("loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 text-center py-16">
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
                    {r.receipt_number && (
                      <span className="font-mono inline-flex items-center gap-1">
                        {r.receipt_number}
                        {r.derivedMeta?.isComputed && r.derivedMeta.derivedSuffix && (
                          <span className="font-sans not-italic text-[9px] font-bold px-1.5 py-0.5 rounded bg-sage-100 text-sage-500 tracking-normal" title={lang === "ar" ? "اللاحقة مُحتسبة من دورة الإيجار — رقم الإيصال الأصلي لم يتغيّر" : "Suffix derived from rent cycle — stored receipt # unchanged"}>
                            /{r.derivedMeta.derivedSuffix} · {lang === "ar" ? "محسوب" : "auto"}
                          </span>
                        )}
                      </span>
                    )}
                    {(() => {
                      const sfx = r.derivedMeta?.derivedSuffix ?? suffixOf(r.receipt_number);
                      if (!sfx) return null;
                      if (isFinalSuffix(sfx)) {
                        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sage-100 text-sage-600 font-bold" title={lang === "ar" ? "الدفعة الختامية — الدورة مسدّدة" : "Final payment — cycle settled"}>{lang === "ar" ? "ختامي" : "Final"}</span>;
                      }
                      if (isPartialSuffix(sfx)) {
                        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold" style={{ background: "#f5e3cf", color: "#8a5a2a" }} title={lang === "ar" ? `دفعة جزئية ${sfx} — مرتبطة بدورة الإيجار` : `Partial installment ${sfx} — linked to rent cycle`}>{lang === "ar" ? `جزئي ${sfx}` : `Partial ${sfx}`}</span>;
                      }
                      return null;
                    })()}
                    {r.period_start && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sage-100 text-sage-600 font-semibold">
                        {cycleLabel(r, lang)}
                      </span>
                    )}
                  </div>

                </Link>
                <div className="text-end">
                  <p className="font-black text-sage-600 text-lg whitespace-nowrap">{format(r.amount)}</p>
                  <div className="flex gap-1 mt-1 justify-end flex-wrap">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg text-sage-500"
                      title={lang === "ar" ? "طباعة" : "Print"}
                      onClick={() => printReceipt(r, receiptLang)}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg text-sage-600"
                      title={lang === "ar" ? "تحميل PDF" : "Download PDF"}
                      onClick={() => downloadReceiptPDF(r, receiptLang)}
                    >
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
