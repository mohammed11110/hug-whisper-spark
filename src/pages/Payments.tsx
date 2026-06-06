import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, Printer, Trash2, Search, Calendar, Plus, Download, Pencil, Archive } from "lucide-react";
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
import { downloadReceiptPDFDirect, printReceiptPDFDirect, type ReceiptData } from "@/lib/pdfDocs";
import { isIOS } from "@/lib/platform";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

  /** Build the typed ReceiptData consumed by the direct (vector) PDF engine.
   *  Replaces the old HTML-string + html2canvas pipeline so that switching
   *  between AR/EN no longer pays the cost of re-snapshotting a full DOM. */
  const buildReceiptData = (r: Row, lng: RLang): ReceiptData => {
    const meta = r.derivedMeta;
    const cycleDue = meta?.cycleDue && meta.cycleDue > 0
      ? meta.cycleDue
      : (r.expected_amount && r.expected_amount > 0 ? r.expected_amount : r.amount);
    const cumulativePaid = meta?.cumulativePaid ?? r.amount;
    const cycleRemaining = Math.max(0, cycleDue - cumulativePaid);
    const otherOutstanding = Math.max(0, r.remaining - cycleRemaining);
    const sfx = meta?.derivedSuffix ?? suffixOf(r.receipt_number);
    const isPartialInstallment = isPartialSuffix(sfx);
    const isFinalInstallment = isFinalSuffix(sfx) || (meta?.cycleClosed && (meta?.cycleSize ?? 1) > 1 && !isPartialInstallment);
    const partialIndex = isPartialInstallment ? parseInt(sfx as string, 10) : 0;
    const L = RECEIPT_TXT[lng];
    const installmentNote = isPartialInstallment
      ? L.partial_note(partialIndex)
      : (isFinalInstallment ? L.final_note : "");
    const cycleClosed = cycleRemaining <= 0.009 || !!meta?.cycleClosed;
    const statusKey: ReceiptData["statusKey"] = isPartialInstallment
      ? "partial"
      : (cycleClosed ? "paid" : "late");
    const statusLabel = statusKey === "partial" ? L.partial
      : statusKey === "paid" ? L.paid
      : statusKey === "late" ? L.late
      : L.soon;
    return {
      brand: settings.brand,
      receiptNumber: r.receipt_number || r.id,
      paymentDate: r.payment_date,
      amount: r.amount,
      expectedAmount: r.expected_amount,
      periodLabel: r.period_start ? cycleLabel(r, lng) : null,
      building: r.building_name,
      unitNumber: r.unit_number,
      tenantName: r.tenant_name,
      currency,
      lang: lng,
      cycleTotalDue: cycleDue,
      cyclePaidToDate: cumulativePaid,
      cycleRemaining,
      otherOutstanding,
      grandTotal: r.amount,
      statusKey,
      statusLabel,
      installmentNote: installmentNote || null,
    };
  };

  const printReceipt = async (r: Row, lng: RLang = receiptLang) => {
    try {
      const filename = `${r.receipt_number || r.id}-${lng}.pdf`;
      const data = buildReceiptData(r, lng);
      console.info("[receipt:print:start]", { receiptNumber: r.receipt_number || r.id, lng, native: isNative(), ios: isIOS() });
      await printReceiptPDFDirect(data, filename);
    } catch (e: any) {
      console.error("[receipt:print]", e);
      toast.error(String(e?.message || e) || "Print error");
    }
  };

  const downloadReceiptPDF = async (r: Row, lng: RLang = receiptLang) => {
    try {
      const filename = `${r.receipt_number || r.id}-${lng}.pdf`;
      const data = buildReceiptData(r, lng);
      console.info("[receipt:download:start]", { receiptNumber: r.receipt_number || r.id, lng, native: isNative(), ios: isIOS() });
      await downloadReceiptPDFDirect(data, filename);
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-lg text-sage-500"
                          title={lang === "ar" ? "طباعة" : "Print"}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[180px]">
                        <DropdownMenuItem onClick={() => printReceipt(r, "ar")}>
                          {lang === "ar" ? "طباعة بالعربية" : "Print in Arabic"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printReceipt(r, "en")}>
                          {lang === "ar" ? "طباعة بالإنجليزية" : "Print in English"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-lg text-sage-600"
                          title={lang === "ar" ? "تحميل PDF" : "Download PDF"}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[180px]">
                        <DropdownMenuItem onClick={() => downloadReceiptPDF(r, "ar")}>
                          {lang === "ar" ? "تحميل بالعربية" : "Download in Arabic"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadReceiptPDF(r, "en")}>
                          {lang === "ar" ? "تحميل بالإنجليزية" : "Download in English"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>


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
