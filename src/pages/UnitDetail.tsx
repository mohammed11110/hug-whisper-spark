import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, User, Phone, FileText, IdCard, Calendar, Wallet, Plus, Receipt, Wrench, Scale, Camera, Droplets, Zap, Flame, Wifi, FileSignature, Pencil, Check, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { useAppSettings } from "@/lib/appSettings";
import { buildLeaseHTML, buildOmaniLeaseHTML, downloadHTMLAsPDF, downloadLeasePDF, printHTML, downloadUnitStatementPDFDirect, printUnitStatementPDFDirect, type UnitStatementLeaseBlock, type UnitStatementRow } from "@/lib/pdfDocsLazy";
import { isIOS } from "@/lib/platform";
import { isNative } from "@/lib/nativeFiles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { EndTenancyDialog } from "@/components/EndTenancyDialog";
import { NewTenancyDialog } from "@/components/NewTenancyDialog";
import { AddMaintenanceDialog } from "@/components/AddMaintenanceDialog";
import { FileUpload } from "@/components/FileUpload";
import { getUnitArrears, type PaymentForBalance } from "@/lib/balance";
import { derivePartialMetaForDisplay } from "@/lib/receiptNumbering";
import { ArrearsBadge } from "@/components/ArrearsBadge";
import { AdjustBalanceDialog } from "@/components/AdjustBalanceDialog";

import { UnitHealthBadge } from "@/components/UnitHealthBadge";
import { exportToCSV } from "@/lib/exportCSV";
import { FilePreviewDialog, type FilePreviewPayload } from "@/components/FilePreviewDialog";

interface Unit {
  id: string; building_id: string; unit_number: string; floor: number; type: string;
  tenant_name: string | null; tenant_phone: string | null; tenant_id_number: string | null;
  tenant_id_image_url: string | null;
  rent_amount: number; rent_type: string; due_day: number; status: string;
  contract_type: string; contract_start_date: string | null; contract_end_date: string | null;
  contract_file_url: string | null; last_paid_date: string | null;
  security_deposit: number;
  water_account: string | null; electric_account: string | null; gas_account: string | null; internet_account: string | null;
  utilities: any; legal_case: any; handover_photos: any; photo_labels: any; photo_kinds: any;
}

const TABS = ["details", "maintenance", "utilities", "legal", "photos"] as const;
type Tab = typeof TABS[number];
const TAB_ICONS: Record<Tab, any> = { details: User, maintenance: Wrench, utilities: Droplets, legal: Scale, photos: Camera };

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-sage-300/30 text-sage-600",
  late: "bg-burgundy/15 text-burgundy",
  soon: "bg-terracotta/15 text-terracotta",
};

export default function UnitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { format, currency } = useCurrency();
  const { settings } = useAppSettings();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [payments, setPayments] = useState<PaymentForBalance[]>([]);
  const [buildingName, setBuildingName] = useState<string>("");
  const [tab, setTab] = useState<Tab>("details");
  const [delOpen, setDelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [newTenantOpen, setNewTenantOpen] = useState(false);
  const [activeTenancyId, setActiveTenancyId] = useState<string | null>(null);
  const [tenancies, setTenancies] = useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<FilePreviewPayload | null>(null);
  const openPreview = (p: FilePreviewPayload) => { setPreviewPayload(p); setPreviewOpen(true); };
  const closePreview = () => setPreviewOpen(false);
  

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("units").select("*").eq("id", id).maybeSingle();
    setUnit(data as any);
    if (data?.building_id) {
      const { data: b } = await supabase.from("buildings").select("name, name_en").eq("id", data.building_id).maybeSingle();
      if (b) setBuildingName((b as any).name || (b as any).name_en || "");
    }
    const { data: ps } = await supabase.from("payments").select("id,unit_id,amount,expected_amount,deleted_at,payment_date,period_start,period_end,tenancy_id,kind,receipt_number,created_at,notes").eq("unit_id", id).is("deleted_at", null);
    setPayments((ps || []) as any);
    const { data: ts } = await supabase.from("tenancies").select("id,status,tenant_name,tenant_name_en,contract_number,official_contract_number,contract_start_date,contract_end_date,ended_at,ended_reason,rent_amount,rent_type,opening_balance,opening_balance_date,outstanding_at_end,deposit_status,deposit_refund_amount,debt_resolution,debt_settled,debt_settled_at,closing_balance,write_off_amount,write_off_reason").eq("unit_id", id).order("contract_start_date", { ascending: false });
    setTenancies((ts || []) as any);
    const active = (ts || []).find((t: any) => t.status === "active");
    setActiveTenancyId(active?.id || null);
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    let unsub: (() => void) | null = null;
    import("@/lib/paymentsBus").then(({ paymentsBus }) => {
      unsub = paymentsBus.subscribe(() => load());
    });
    return () => { if (unsub) unsub(); };
  }, [id]);

  const handleDelete = async () => {
    if (!unit) return;
    const { error } = await supabase.from("units").delete().eq("id", unit.id);
    if (error) return toast.error(error.message);
    logActivity({
      entityType: "unit",
      action: "deleted",
      entityId: unit.id,
      entityLabel: unit.unit_number,
      buildingId: unit.building_id,
      descriptionAr: `حذف الوحدة ${unit.unit_number}${unit.tenant_name ? ` — كان مستأجرها ${unit.tenant_name}` : ""}`,
      descriptionEn: `Unit ${unit.unit_number} deleted`,
    });
    toast.success("✓");
    navigate(`/buildings/${unit.building_id}`);
  };

  const buildLeaseData = () => {
    if (!unit) return null;
    return {
      brand: settings.brand,
      building_name: buildingName || "—",
      unit_number: unit.unit_number,
      unit_type: t2(unit.type as any),
      floor: unit.floor,
      tenant_name: unit.tenant_name || "",
      tenant_name_en: (unit as any).tenant_name_en || "",
      tenant_phone: unit.tenant_phone || "",
      tenant_id_number: (unit as any).tenant_id_number || "",
      rent_amount: Number(unit.rent_amount),
      rent_type: unit.rent_type,
      contract_type: (unit as any).contract_type || "yearly",
      contract_start_date: (unit as any).contract_start_date,
      contract_end_date: unit.contract_end_date,
      due_day: unit.due_day,
      security_deposit: Number((unit as any).security_deposit || 0),
      currency: currency.symbol,
      lang: (lang === "ar" ? "ar" : "en") as "ar" | "en",
      // Omani / municipality optional fields (used only when currency is OMR)
      contract_number: (tenancies.find((t: any) => t.status === "active") as any)?.official_contract_number
        || (tenancies.find((t: any) => t.status === "active") as any)?.contract_number || null,
      electricity_account: (unit as any).electric_account || null,
      flat_no: unit.unit_number,
      building_no: buildingName || null,
    };
  };

  // Oman uses an official Royal-Decree-89/6-style lease; other countries use the generic format.
  const isOman = currency.code === "OMR";

  const exportLease = async (mode: "download" | "print" | "preview") => {
    if (!unit) return;
    const leaseData = buildLeaseData();
    if (!leaseData) return;
    const filename = `lease-${unit.unit_number}-${unit.tenant_name || "tenant"}.pdf`;

    // Direct (vector) lease PDF — fast on iPad. The generic lease has a
    // dedicated direct generator; the Omani template still uses HTML.
    const doDirectSave = async () => {
      if (isOman) {
        const html = await buildOmaniLeaseHTML(leaseData);
        await downloadHTMLAsPDF(html, filename, settings);
      } else {
        await downloadLeasePDF(leaseData, filename);
      }
    };

    // Print path — keep current behavior for desktop, share-as-PDF on iOS/native.
    if (mode === "print") {
      try {
        if (isNative() || isIOS()) {
          await doDirectSave();
        } else {
          const html = isOman ? await buildOmaniLeaseHTML(leaseData) : await buildLeaseHTML(leaseData);
          await printHTML(html);
        }
      } catch (e: any) { toast.error(e.message || "PDF error"); }
      return;
    }

    // Download path — always direct, fast.
    if (mode === "download") {
      try {
        await doDirectSave();
        toast.success(lang === "ar" ? "تم حفظ الملف ✓" : "Saved ✓");
      } catch (e: any) { toast.error(e.message || "PDF error"); }
      return;
    }

    // Preview path — on iOS / native, skip the heavy iframe preview and
    // route straight to the native share sheet. Desktop keeps full preview.
    if (isNative() || isIOS()) {
      try {
        await doDirectSave();
        toast.success(lang === "ar" ? "تم حفظ الملف ✓" : "Saved ✓");
      } catch (e: any) { toast.error(e.message || "PDF error"); }
      return;
    }
    const html = isOman ? await buildOmaniLeaseHTML(leaseData) : await buildLeaseHTML(leaseData);
    openPreview({
      type: "pdf",
      title: lang === "ar"
        ? (isOman ? "عقد إيجار — سلطنة عُمان" : "عقد الإيجار")
        : (isOman ? "Lease Agreement — Sultanate of Oman" : "Lease agreement"),
      filename,
      html,
      onSave: async () => {
        try {
          await doDirectSave();
          toast.success(lang === "ar" ? "تم حفظ الملف ✓" : "Saved ✓");
          closePreview();
        } catch (e: any) { toast.error(e.message || "PDF error"); }
      },
      onPrint: async () => { await printHTML(html); },
    });
  };

  const exportStatement = async () => {
    if (!unit) return;

    // Fetch all (non-deleted) payments for this unit. tenancy_id has been
    // backfilled, so we can group strictly by lease.
    const { data: ps } = await supabase
      .from("payments")
      .select("id, amount, expected_amount, payment_date, period_start, period_end, receipt_number, notes, kind, tenancy_id, created_at, deleted_at, unit_id")
      .eq("unit_id", unit.id)
      .is("deleted_at", null)
      .order("payment_date", { ascending: true });

    // Order leases oldest → newest for the document flow.
    const orderedTenancies = [...(tenancies || [])].sort((a: any, b: any) => {
      const ad = a.contract_start_date || "";
      const bd = b.contract_start_date || "";
      return ad.localeCompare(bd);
    });
    if (orderedTenancies.length === 0) {
      toast.error(lang === "ar" ? "لا توجد عقود لإصدار الكشف" : "No leases on record");
      return;
    }

    const ar = lang === "ar";
    const todayIso = new Date().toISOString().slice(0, 10);

    // Build a block per tenancy.
    const leases: UnitStatementLeaseBlock[] = orderedTenancies.map((t: any) => {
      const tPays = (ps || []).filter((p: any) => p.tenancy_id === t.id);
      const rent = Number(t.rent_amount) || 0;
      const rentType = (t.rent_type || "monthly").toLowerCase();
      const start = t.contract_start_date || (tPays[0]?.period_start ?? tPays[0]?.payment_date) || null;
      const endRaw = t.ended_at || t.contract_end_date || null;
      const endBound = endRaw && endRaw < todayIso ? endRaw : todayIso;
      type Entry = { date: string; description: string; charge: number; payment: number; sortKey: string };
      const entries: Entry[] = [];

      // 1) Opening balance row (per-lease)
      const opening = Number(t.opening_balance || 0);
      if (opening > 0.009) {
        const obDate = t.opening_balance_date || start || todayIso;
        entries.push({
          date: obDate,
          description: ar ? "رصيد افتتاحي (متأخرات سابقة)" : "Opening balance (prior arrears)",
          charge: opening,
          payment: 0,
          sortKey: obDate + "0",
        });
      }

      // 2) Rent accruals from contract_start to min(today, end). Monthly uses
      //    the start-day cycle generator; yearly/daily fall back to simple
      //    period increments.
      if (rent > 0 && start) {
        const startD = new Date(start);
        const endD = new Date(endBound);
        if (rentType === "monthly") {
          const anchorDay = startD.getDate();
          const cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
          while (cur <= endD) {
            const cy = cur.getFullYear();
            const cm = cur.getMonth() + 1;
            const cycleStart = new Date(cy, cm - 1, Math.min(28, anchorDay));
            if (cycleStart >= startD && cycleStart <= endD) {
              const iso = cycleStart.toISOString().slice(0, 10);
              const monthsAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
              const monthsEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              const mName = (ar ? monthsAr : monthsEn)[cycleStart.getMonth()];
              const label = ar
                ? `إيجار شهر ${mName} ${cy}`
                : `Rent — ${mName} ${cy}`;
              entries.push({
                date: iso,
                description: label,
                charge: rent,
                payment: 0,
                sortKey: iso + "1",
              });
            }
            cur.setMonth(cur.getMonth() + 1);
          }
        } else if (rentType === "yearly") {
          const cur = new Date(startD);
          while (cur <= endD) {
            const iso = cur.toISOString().slice(0, 10);
            entries.push({
              date: iso,
              description: ar ? `إيجار سنوي — ${cur.getFullYear()}` : `Annual rent — ${cur.getFullYear()}`,
              charge: rent,
              payment: 0,
              sortKey: iso + "1",
            });
            cur.setFullYear(cur.getFullYear() + 1);
          }
        }
        // daily/other rent_types: skip accrual rows; the lease summary
        // already reflects them via real payments below.
      }

      // 3) Payments for this lease — preserve the EXISTING receipt_number as
      //    stored (R-xxxx, R-xxxx/1, /2, /D). For legacy rows without a
      //    stored suffix, compute one for DISPLAY ONLY using the shared
      //    derivePartialMetaForDisplay helper so partial cycles still group
      //    visually under the same base number.
      const derivedForLease = derivePartialMetaForDisplay(tPays as any);
      tPays
        .filter((p: any) => (p.kind || "rent") !== "opening")
        .forEach((p: any) => {
          const amt = Number(p.amount) || 0;
          const isAdj = (p.kind || "rent") === "adjustment";
          const date = p.payment_date || p.period_start || "";
          const descBase = isAdj
            ? (ar ? "تعديل الرصيد" : "Adjustment")
            : (ar ? "دفعة" : "Payment");
          // Receipt display: keep the stored number verbatim when present.
          // If the row has no stored suffix but the cycle has multiple
          // installments, append the derived suffix with a small "(محسوب)"
          // marker so legacy receipts read like new ones without mutating
          // the source-of-truth value.
          const meta = derivedForLease.get(p.id);
          let receiptDisplay = "";
          if (p.receipt_number) {
            const hasStoredSuffix = p.receipt_number.includes("/");
            if (!hasStoredSuffix && meta?.isComputed && meta.derivedSuffix) {
              receiptDisplay = ` #${p.receipt_number}/${meta.derivedSuffix}${ar ? " (محسوب)" : " (computed)"}`;
            } else {
              receiptDisplay = ` #${p.receipt_number}`;
            }
          }
          const desc = descBase + receiptDisplay + (p.notes ? ` — ${p.notes}` : "");
          const charge = isAdj && amt < 0 ? -amt : 0;
          const payment = isAdj ? (amt > 0 ? amt : 0) : amt;
          entries.push({
            date,
            description: desc,
            charge,
            payment,
            sortKey: date + "2",
          });
        });

      entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      // 4) Running balance — RESETS to 0 for each lease
      let bal = 0;
      const rows: UnitStatementRow[] = entries.map((e) => {
        bal += e.charge - e.payment;
        return { date: e.date, description: e.description, charge: e.charge, payment: e.payment, balance: bal };
      });
      const totalCharges = entries.reduce((s, e) => s + e.charge, 0);
      const totalPaid = entries.reduce((s, e) => s + e.payment, 0);
      // Closing balance: prefer the recorded `outstanding_at_end` for ended
      // leases, otherwise the running balance.
      const closingBalance = t.status === "ended" && t.outstanding_at_end != null
        ? Number(t.outstanding_at_end)
        : Math.max(0, totalCharges - totalPaid);

      return {
        tenantName: t.tenant_name || "—",
        tenantNameEn: t.tenant_name_en || null,
        contractNumber: t.official_contract_number || t.contract_number || null,
        contractStart: t.contract_start_date || null,
        contractEnd: t.contract_end_date || null,
        endedAt: t.ended_at || null,
        rentAmount: rent,
        rentType: t.rent_type || "monthly",
        status: t.status === "active" ? "current" : "previous",
        debtResolution: (t.debt_resolution as any) || null,
        debtSettled: !!t.debt_settled,
        writeOffReason: t.write_off_reason || null,
        rows,
        totals: { totalCharges, totalPaid, closingBalance },
      } as UnitStatementLeaseBlock;
    });

    const statementData = {
      brand: settings.brand,
      currency: currency.symbol,
      generatedAt: todayIso,
      building: buildingName || "—",
      unitNumber: unit.unit_number,
      unitType: t2(unit.type as any),
      leases,
    };

    const filename = `unit-statement-${unit.unit_number}.pdf`;

    try {
      if (isNative() || isIOS()) {
        await downloadUnitStatementPDFDirect(statementData, filename);
        toast.success(ar ? "تم تجهيز كشف الحساب ✓" : "Statement ready ✓");
      } else {
        // Skip the HTML preview iframe: the new grouped layout has no HTML
        // sibling renderer; jump straight to direct (vector) download.
        await downloadUnitStatementPDFDirect(statementData, filename);
        toast.success(ar ? "تم حفظ الملف ✓" : "Saved ✓");
      }
    } catch (e: any) {
      toast.error(e.message || "PDF error");
    }
    // unused legacy var to silence the compiler about removed branches
    void printUnitStatementPDFDirect;
  };



  if (!unit) return <div className="mobile-shell flex items-center justify-center min-h-screen"><p className="text-sage-500">{t("loading")}</p></div>;

  return (
    <div className="mobile-shell min-h-screen pb-10 bg-background">
      {/* Header */}
      <div className="bg-gradient-deep text-primary-foreground px-5 pt-4 pb-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-3">
          <Link to={`/buildings/${unit.building_id}`}>
            <Button variant="ghost" size="icon" className="rounded-full text-primary-foreground hover:bg-card/15">
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="rounded-full text-primary-foreground hover:bg-burgundy/30" onClick={() => setDelOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-75">{t2(unit.type as any)} · F{unit.floor}</p>
            <h1 className="text-3xl font-black mt-1">{unit.unit_number}</h1>
            {buildingName && <p className="text-xs opacity-75 mt-1">🏢 {buildingName}</p>}
            {unit.tenant_name && <p className="text-sm opacity-90 mt-0.5">{unit.tenant_name}</p>}
            {unit.tenant_name && (() => {
              const active = tenancies.find((t: any) => t.status === "active");
              if (!active?.contract_number) return null;
              return (
                <p className="text-[10px] opacity-80 mt-0.5 font-semibold tracking-wide">
                  {active.contract_number}
                  {active.official_contract_number ? ` · ${active.official_contract_number}` : ""}
                </p>
              );
            })()}
            {unit.tenant_name && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <UnitHealthBadge unit={unit as any} payments={payments} activeTenancyId={activeTenancyId} />
                <ArrearsBadge unit={unit as any} payments={payments} activeTenancyId={activeTenancyId} block />
              </div>
            )}

          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${STATUS_STYLES[unit.status]}`}>{t2(unit.status as any)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 sticky top-0 z-20 glass border-b border-sage-200/40">
        <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
          {TABS.map((tk) => {
            const Icon = TAB_ICONS[tk];
            const active = tab === tk;
            return (
              <button key={tk} onClick={() => setTab(tk)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
                  active ? "bg-gradient-sage text-primary-foreground shadow-soft" : "text-muted-foreground"
                }`}>
                <Icon className="h-3.5 w-3.5" />{t2(tk)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-5 space-y-4 animate-float-up" key={tab}>
        {tab === "details" && (
          unit.tenant_name ? (
            <>
              <DetailsTab unit={unit} payments={payments} format={format} t2={t2} lang={lang}
                activeTenancyId={activeTenancyId}
                onPay={() => setPayOpen(true)} onLeasePDF={() => exportLease("preview")} onLeasePrint={() => exportLease("print")}
                onStatement={exportStatement}
                onPreview={openPreview}
                onEnd={() => setEndOpen(true)} reload={load} />
              <LeaseHistoryCard unitId={unit.id} tenancies={tenancies} payments={payments} format={format} lang={lang} />
            </>
          ) : (
            <>
              <VacantState t2={t2} onAdd={() => setNewTenantOpen(true)} />
              <LeaseHistoryCard unitId={unit.id} tenancies={tenancies} payments={payments} format={format} lang={lang} />
            </>
          )
        )}
        {tab === "maintenance" && <MaintenanceTab unit={unit} lang={lang} t2={t2} format={format} />}
        {tab === "utilities" && <UtilitiesTab unit={unit} reload={load} lang={lang} />}
        {tab === "legal" && <LegalTab unit={unit} reload={load} />}
        {tab === "photos" && <PhotosTab unit={unit} reload={load} />}
      </div>

      <ConfirmDeleteDialog open={delOpen} onOpenChange={setDelOpen} onConfirm={handleDelete} />
      <AddPaymentDialog open={payOpen} onOpenChange={setPayOpen} presetUnitId={unit.id} onSaved={load} />
      <EndTenancyDialog open={endOpen} onOpenChange={setEndOpen} unit={unit} tenancyId={activeTenancyId} onDone={load} />
      <NewTenancyDialog open={newTenantOpen} onOpenChange={setNewTenantOpen} unit={unit} onDone={load} />
      <FilePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} payload={previewPayload} />
    </div>
  );
}

function VacantState({ t2, onAdd }: any) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-sage-300/60 bg-card px-6 py-10 text-center space-y-3">
      <div className="text-4xl">🏠</div>
      <h3 className="text-base font-black text-sage-600">{t2("vacant_unit")}</h3>
      <p className="text-xs text-muted-foreground">{t2("vacant_unit_msg")}</p>
      <Button onClick={onAdd} className="rounded-xl bg-gradient-sage text-primary-foreground h-11 mt-2">
        <Plus className="h-4 w-4 me-1.5" />{t2("add_tenant")}
      </Button>
    </div>
  );
}

function DetailsTab({ unit, payments, format, t2, lang, onPay, onLeasePDF, onLeasePrint, onStatement, onPreview, onEnd, reload, activeTenancyId }: any) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const arr = getUnitArrears(unit, payments, new Date(), lang as "ar" | "en", activeTenancyId);

  const totalPaid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const bal = {
    outstanding: arr.totalShortfall,
    opening: arr.openingBalance,
    totalDue: arr.totalShortfall + totalPaid,
    paid: totalPaid,
  };
  // ملاحظة: تحرير المتأخرات يدويًا متاح فقط عند تسجيل المستأجر
  // (AddUnitDialog / NewTenancyDialog). بعد التسجيل تنقص المتأخرات حصرًا
  // عبر تسجيل دفعات (إيصالات) — لا تعديل يدوي من صفحة المستأجر.

  return (
    <>
      <Card>
        <h3 className="text-sage-600 font-bold mb-3 text-sm">{t2("tenant_name")}</h3>
        <Row icon={User} label={t2("tenant_name")} value={unit.tenant_name || "—"} />
        <Row icon={Phone} label={t2("tenant_phone")} value={unit.tenant_phone || "—"} />
        <Row icon={IdCard} label={lang === "ar" ? "رقم الهوية" : "ID number"} value={unit.tenant_id_number || "—"} />
      </Card>
      <Card>
        <h3 className="text-sage-600 font-bold mb-3 text-sm">{lang === "ar" ? "المستندات" : "Documents"}</h3>
        <div className="space-y-3">
          <FileUpload
            bucket="contracts"
            pathPrefix={`${unit.building_id}/${unit.id}`}
            value={unit.contract_file_url}
            onChange={async (v) => {
              await supabase.from("units").update({ contract_file_url: v }).eq("id", unit.id);
              logActivity({
                entityType: "unit",
                action: "updated",
                entityId: unit.id,
                entityLabel: unit.unit_number,
                buildingId: unit.building_id,
                descriptionAr: `تحديث ملف عقد الإيجار — وحدة ${unit.unit_number}`,
                descriptionEn: `Lease contract file updated — unit ${unit.unit_number}`,
              });
              reload?.();
            }}
            accept="application/pdf,image/*"
            label="عقد الإيجار"
          />
          <FileUpload
            bucket="tenant-ids"
            pathPrefix={`${unit.building_id}/${unit.id}`}
            value={unit.tenant_id_image_url}
            onChange={async (v) => {
              await supabase.from("units").update({ tenant_id_image_url: v }).eq("id", unit.id);
              logActivity({
                entityType: "tenant",
                action: "updated",
                entityId: unit.id,
                entityLabel: unit.tenant_name || unit.unit_number,
                buildingId: unit.building_id,
                descriptionAr: `تحديث صورة هوية المستأجر — وحدة ${unit.unit_number}`,
                descriptionEn: `Tenant ID image updated — unit ${unit.unit_number}`,
              });
              reload?.();
            }}
            accept="image/*,application/pdf"
            label="صورة هوية المستأجر"
          />
        </div>
      </Card>
      <Card>
        <h3 className="text-sage-600 font-bold mb-3 text-sm">{t2("rent_amount")}</h3>
        <Row icon={Wallet} label={t2("rent_amount")} value={`${format(Number(unit.rent_amount))} / ${t2(unit.rent_type)}`} />
        <Row icon={Calendar} label={t2("rent_timing")} value={t2((unit as any).rent_timing === "arrears" ? "rent_timing_arrears" : "rent_timing_advance")} />
        <DueDateRow unit={unit} t2={t2} lang={lang} />
        <Row icon={Receipt} label={t2("last_payment")} value={unit.last_paid_date || "—"} />
        <Row icon={Calendar} label={t2("contract_end")} value={unit.contract_end_date || "—"} />
      </Card>
      {unit.tenant_name && (
        <Card>
          <h3 className="text-sage-600 font-bold mb-3 text-sm">{t2("payment_summary")}</h3>
          {/* المتأخرات الافتتاحية للقراءة فقط — تُحدَّث عبر الإيصالات */}
          <Row icon={Wallet} label={t2("arrears")} value={format(bal.opening)} />
          <Row icon={Wallet} label={t2("total_due")} value={format(bal.totalDue)} />
          <Row icon={Wallet} label={t2("total_received")} value={format(bal.paid)} />
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-sage-200/40">
            <span className="text-sm font-bold text-sage-600">{t2("outstanding_balance")}</span>
            <div className="flex items-center gap-2">
              <span className={`text-base font-black ${bal.outstanding > 0 ? "text-burgundy" : bal.outstanding < 0 ? "text-sage-700" : "text-sage-600"}`}>
                {format(Math.abs(bal.outstanding))}
                {bal.outstanding < 0 && (
                  <span className="ms-1 text-[10px] font-bold text-sage-600 opacity-75">
                    ({lang === "ar" ? "دائن" : "credit"})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setAdjustOpen(true)}
                className="rounded-lg border border-sage-300 px-2 py-0.5 text-[10px] font-bold text-sage-600 hover:bg-sage-50 transition-colors"
                aria-label={lang === "ar" ? "تعديل الرصيد" : "Adjust balance"}
              >
                {lang === "ar" ? "تعديل" : "Adjust"}
              </button>
            </div>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="outline" onClick={onLeasePDF} className="rounded-xl border-sage-300 text-sage-600 h-12 font-semibold">
          <FileSignature className="h-4 w-4 me-1.5" />{lang === "ar" ? "تنزيل العقد" : "Lease PDF"}
        </Button>
        <Button onClick={onPay} className="rounded-xl bg-gradient-sage text-primary-foreground h-12 font-semibold shadow-soft">
          <Plus className="h-4 w-4 me-1.5" />{t2("register_payment")}
        </Button>
      </div>
      <Button variant="outline" onClick={onStatement} className="w-full rounded-xl border-sage-300 text-sage-600 h-11 font-semibold">
        <Receipt className="h-4 w-4 me-1.5" />{t2("tenant_statement")} PDF
      </Button>
      <Button
        variant="outline"
        onClick={() => setAdjustOpen(true)}
        className="w-full rounded-xl border-sage-300 text-sage-600 h-11 font-semibold"
      >
        {lang === "ar" ? "تعديل الرصيد يدوياً (+/−)" : "Adjust balance (+/−)"}
      </Button>
      <AdjustBalanceDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        unitId={unit.id}
        unitNumber={unit.unit_number}
        buildingId={unit.building_id}
        tenantName={unit.tenant_name}
        currentBalance={bal.outstanding}
        formatAmount={format}
      />

      <Button
        variant="ghost"
        onClick={() => {
          const rows = arr.cycles.map((c) => ({
            cycle: c.label,
            period_start: c.periodStartIso,
            period_end: c.periodEndIso,
            rent: c.rent,
            paid: c.paid,
            shortfall: c.shortfall,
            status: c.status,
          }));
          if (arr.openingBalance > 0.009) {
            rows.unshift({
              cycle: lang === "ar" ? "متأخرات سابقة" : "Prior arrears",
              period_start: "",
              period_end: "",
              rent: arr.openingBalance,
              paid: 0,
              shortfall: arr.openingBalance,
              status: "unpaid",
            });
          }
          if (!rows.length) return;
          const filename = `unit-${unit.unit_number}-cycles-${new Date().toISOString().slice(0,10)}.csv`;
          const headerLabels = lang === "ar" ? {
            cycle: "الدورة", period_start: "من", period_end: "إلى",
            rent: "الإيجار", paid: "المدفوع", shortfall: "العجز", status: "الحالة",
          } : undefined;
          onPreview?.({
            type: "csv",
            title: lang === "ar" ? "دورات الإيجار" : "Rent cycles",
            filename,
            rows,
            headerLabels,
            onSave: () => exportToCSV(filename, rows),
          });
        }}
        className="w-full rounded-xl text-sage-500 h-10 text-xs"
      >
        {lang === "ar" ? "تصدير الدورات (CSV)" : "Export cycles (CSV)"}
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          // Full ledger: opening + monthly accruals + every payment (rent/adjustment) with running balance.
          type LedgerRow = {
            date: string;
            type: string;
            description: string;
            charge: number;
            payment: number;
            balance: number;
            kind?: string;
            receipt?: string;
            notes?: string;
          };
          const entries: Array<Omit<LedgerRow, "balance"> & { sortKey: string }> = [];

          // 1) Opening balance (as a charge) — once, on opening date.
          if (arr.openingBalance > 0.009) {
            const openingDate =
              (unit as any).opening_balance_date ||
              (unit as any).contract_start_date ||
              new Date().toISOString().slice(0, 10);
            entries.push({
              date: openingDate,
              type: lang === "ar" ? "رصيد افتتاحي" : "Opening",
              description: lang === "ar" ? "متأخرات سابقة" : "Prior arrears",
              charge: arr.openingBalance,
              payment: 0,
              sortKey: openingDate + "0",
              kind: "opening",
            });
          }

          // 2) Monthly accruals (skip the synthetic "prior arrears" cycle from arr.cycles).
          arr.cycles
            .filter((c) => c.label !== (lang === "ar" ? "متأخرات سابقة" : "Prior arrears"))
            .forEach((c) => {
              entries.push({
                date: c.periodStartIso,
                type: lang === "ar" ? "استحقاق" : "Accrual",
                description: c.label,
                charge: c.rent,
                payment: 0,
                sortKey: c.periodStartIso + "1",
                kind: "accrual",
              });
            });

          // 3) All real payments (rent + adjustment). Opening-kind rows are
          //    already represented by the opening line above.
          // Derive partial-cycle metadata for the active tenancy so legacy
          // receipts (issued before the /1, /D system) visually join the
          // same cycle when shown in the ledger.
          const activeSet = activeTenancyId ? new Set([activeTenancyId]) : new Set<string>();
          const derived = derivePartialMetaForDisplay(payments as any, { activeTenancyIds: activeSet });
          (payments || [])
            .filter((p: any) => !p.deleted_at && (p.kind || "rent") !== "opening")
            .forEach((p: any) => {
              const amt = Number(p.amount) || 0;
              const isAdj = (p.kind || "rent") === "adjustment";
              const date = p.payment_date || p.period_start || "";
              const meta = derived.get(p.id);
              const sfx = meta?.derivedSuffix;
              const sfxLabel = sfx && meta?.isComputed
                ? (lang === "ar"
                    ? ` ‹${sfx === "D" ? "ختامي" : `جزئي ${sfx}`} · محسوب›`
                    : ` ‹${sfx === "D" ? "Final" : `Partial ${sfx}`} · auto›`)
                : "";
              const descBase = isAdj
                ? (lang === "ar" ? "تعديل الرصيد" : "Adjustment")
                : (lang === "ar" ? "دفعة" : "Payment");
              const fullReceipt = p.receipt_number
                ? (sfx && meta?.isComputed && !p.receipt_number.includes("/")
                    ? `${p.receipt_number}/${sfx}`
                    : p.receipt_number)
                : "";
              const desc = descBase +
                (fullReceipt ? ` #${fullReceipt}` : "") +
                sfxLabel +
                (p.notes ? ` — ${p.notes}` : "");
              // Positive adjustment = waiver/credit (reduces balance like a payment).
              // Negative adjustment = extra charge (adds to balance).
              const charge = isAdj && amt < 0 ? -amt : 0;
              const payment = isAdj ? (amt > 0 ? amt : 0) : amt;
              entries.push({
                date,
                type: isAdj
                  ? (amt >= 0 ? (lang === "ar" ? "إعفاء" : "Waiver") : (lang === "ar" ? "رسم إضافي" : "Extra charge"))
                  : (lang === "ar" ? "دفعة" : "Payment"),
                description: desc,
                charge,
                payment,
                sortKey: date + "2",
                kind: p.kind || "rent",
                receipt: fullReceipt,
                notes: p.notes || "",
              });
            });



          entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

          let running = 0;
          const rows: LedgerRow[] = entries.map((e) => {
            running += (e.charge || 0) - (e.payment || 0);
            return {
              date: e.date,
              type: e.type,
              description: e.description,
              charge: e.charge ? Number(e.charge.toFixed(3)) : 0,
              payment: e.payment ? Number(e.payment.toFixed(3)) : 0,
              balance: Number(running.toFixed(3)),
              kind: e.kind || "",
              receipt: (e as any).receipt || "",
              notes: (e as any).notes || "",
            };
          });

          if (!rows.length) {
            toast.info(lang === "ar" ? "لا توجد بيانات لكشف الرصيد" : "No ledger data");
            return;
          }
          const filename = `ledger-${unit.unit_number}-${new Date().toISOString().slice(0, 10)}.csv`;
          const headerLabels = lang === "ar" ? {
            date: "التاريخ", type: "النوع", description: "الوصف",
            charge: "مستحق", payment: "مدفوع", balance: "الرصيد",
            kind: "التصنيف", receipt: "رقم الإيصال", notes: "ملاحظات",
          } : undefined;
          onPreview?.({
            type: "csv",
            title: lang === "ar" ? "كشف الرصيد" : "Ledger",
            filename,
            rows,
            headerLabels,
            onSave: () => exportToCSV(filename, rows),
          });
        }}
        className="w-full rounded-xl text-sage-500 h-10 text-xs"
      >
        {lang === "ar" ? "تنزيل كشف الرصيد (CSV)" : "Download ledger (CSV)"}
      </Button>

      <Button variant="ghost" onClick={onLeasePrint} className="w-full rounded-xl text-sage-500 h-10 text-xs">
        {lang === "ar" ? "طباعة العقد" : "Print contract"}
      </Button>
      <Button variant="outline" onClick={onEnd} className="w-full rounded-xl border-burgundy/40 text-burgundy hover:bg-burgundy/10 h-11">
        {t2("end_tenancy")}
      </Button>
    </>
  );
}

function MaintenanceTab({ unit, lang, t2, format }: any) {
  const ar = lang === "ar";
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("maintenance_requests")
      .select("id,title,status,priority,cost,vendor,created_at,cancelled_at")
      .eq("unit_id", unit.id)
      .order("created_at", { ascending: false });
    setRows((data || []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [unit.id]);

  const active = rows.filter((r) => !r.cancelled_at);
  const open = active.filter((r) => r.status === "open").length;
  const inProgress = active.filter((r) => r.status === "in_progress").length;
  const done = active.filter((r) => r.status === "done").length;
  const totalCost = active.reduce((s, r) => s + (Number(r.cost) || 0), 0);

  const STATUS_CLR: Record<string, string> = {
    open: "bg-terracotta/15 text-terracotta",
    in_progress: "bg-muted/50 text-foreground",
    done: "bg-sage-300/30 text-sage-600",
    cancelled: "bg-muted text-muted-foreground",
  };
  const PRIO_CLR: Record<string, string> = {
    low: "bg-sage-200/40 text-sage-600",
    normal: "bg-muted/40 text-foreground",
    high: "bg-terracotta/15 text-terracotta",
    urgent: "bg-burgundy/15 text-burgundy",
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-card border border-sage-200/40 p-3 text-center">
          <div className="text-lg font-black text-terracotta">{open + inProgress}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{ar ? "قيد المعالجة" : "Active"}</div>
        </div>
        <div className="rounded-2xl bg-card border border-sage-200/40 p-3 text-center">
          <div className="text-lg font-black text-sage-600">{done}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{ar ? "منجزة" : "Completed"}</div>
        </div>
        <div className="rounded-2xl bg-card border border-sage-200/40 p-3 text-center">
          <div className="text-sm font-black text-sage-600 leading-tight">{format(totalCost)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{ar ? "إجمالي التكلفة" : "Total cost"}</div>
        </div>
      </div>

      <Button onClick={() => setAddOpen(true)} className="w-full rounded-xl bg-gradient-sage text-primary-foreground h-11 font-semibold">
        <Plus className="h-4 w-4 me-1.5" />{ar ? "طلب صيانة جديد" : "New maintenance request"}
      </Button>

      <Card>
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-sage-100"><Wrench className="h-6 w-6 text-sage-400" /></div>
            <h3 className="font-bold text-sage-600 text-sm">{ar ? "لا توجد طلبات صيانة" : "No maintenance requests"}</h3>
            <p className="text-xs text-muted-foreground">{ar ? "ابدأ بتسجيل أول طلب لتتبع الأعطال والإصلاحات" : "Log the first request to track issues and repairs"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 8).map((r) => (
              <div key={r.id} className={`py-2.5 border-b border-sage-200/30 last:border-0 ${r.cancelled_at ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-bold text-sage-600 truncate ${r.cancelled_at ? "line-through" : ""}`}>{r.title}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(r.created_at).toLocaleDateString(ar ? "ar" : "en")}
                      {r.vendor ? ` · ${r.vendor}` : ""}
                      {r.cost ? ` · ${format(Number(r.cost))}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PRIO_CLR[r.priority]}`}>{t2(`priority_${r.priority}` as any)}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_CLR[r.cancelled_at ? "cancelled" : r.status]}`}>{t2(`status_${r.cancelled_at ? "cancelled" : r.status}` as any)}</span>
                  </div>
                </div>
              </div>
            ))}
            {rows.length > 8 && (
              <Link to="/maintenance" className="block text-center text-xs text-sage-600 font-semibold pt-2 hover:underline">
                {ar ? `عرض الكل (${rows.length})` : `View all (${rows.length})`} →
              </Link>
            )}
          </div>
        )}
      </Card>

      <AddMaintenanceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        presetBuildingId={unit.building_id}
        presetUnitId={unit.id}
        onCreated={load}
      />
    </>
  );
}

function UtilitiesTab({ unit, reload, lang }: any) {
  const t2 = useT2();
  const ar = lang === "ar";
  const utils = unit.utilities || {};
  const items = [
    { key: "water", label: t2("water"), icon: Droplets, accountKey: "water_account" },
    { key: "electric", label: t2("electric"), icon: Zap, accountKey: "electric_account" },
    { key: "gas", label: t2("gas"), icon: Flame, accountKey: "gas_account" },
    { key: "net", label: t2("internet"), icon: Wifi, accountKey: "internet_account" },
  ];
  const toggle = async (k: string) => {
    const updated = { ...utils, [k]: !utils[k] };
    await supabase.from("units").update({ utilities: updated }).eq("id", unit.id);
    reload();
  };
  const updateAccount = async (col: string, val: string) => {
    await supabase.from("units").update({ [col]: val } as any).eq("id", unit.id);
  };
  const updateMeta = async (k: string, field: "pays" | "provider", val: string) => {
    const updated = { ...utils, [`${k}_${field}`]: val };
    await supabase.from("units").update({ utilities: updated }).eq("id", unit.id);
    reload();
  };
  const copy = async (val: string) => {
    if (!val) return;
    try { await navigator.clipboard.writeText(val); toast.success(ar ? "تم النسخ" : "Copied"); } catch {}
  };
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((it) => {
          const on = utils[it.key];
          const Icon = it.icon;
          return (
            <button key={it.key} onClick={() => toggle(it.key)}
              className={`p-4 rounded-2xl border text-start transition-all ${
                on ? "bg-gradient-sage text-primary-foreground border-transparent shadow-soft" : "bg-card border-sage-200/40 text-sage-500"
              }`}>
              <Icon className="h-5 w-5 mb-2" />
              <p className="font-bold text-sm">{it.label}</p>
              <p className="text-[10px] opacity-80 mt-0.5">{on ? (ar ? "مفعّل" : "Active") : (ar ? "غير مفعّل" : "Inactive")}</p>
            </button>
          );
        })}
      </div>
      <Card>
        <h3 className="text-sage-600 font-bold mb-3 text-sm">{ar ? "تفاصيل الحسابات" : "Account details"}</h3>
        <div className="space-y-4">
          {items.map((it) => {
            const acc = unit[it.accountKey] || "";
            const pays = utils[`${it.key}_pays`] || "tenant";
            const provider = utils[`${it.key}_provider`] || "";
            const Icon = it.icon;
            return (
              <div key={it.key} className="space-y-2 pb-3 border-b border-sage-200/30 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-sage-500" />
                  <span className="text-xs font-bold text-sage-600 flex-1">{it.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Input defaultValue={acc} onBlur={(e) => updateAccount(it.accountKey, e.target.value)}
                      placeholder={ar ? "رقم الحساب" : "Account no."}
                      className="rounded-xl border-sage-200 bg-card h-9 text-sm pe-8" />
                    {acc && (
                      <button type="button" onClick={() => copy(acc)} title={ar ? "نسخ" : "Copy"}
                        className="absolute end-1.5 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded-md text-sage-500 hover:bg-sage-100/60">
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Input defaultValue={provider} onBlur={(e) => updateMeta(it.key, "provider", e.target.value)}
                    placeholder={ar ? "مزوّد الخدمة" : "Provider"}
                    className="rounded-xl border-sage-200 bg-card h-9 text-sm" />
                </div>
                <div className="flex gap-1.5">
                  {[
                    { v: "tenant", l: ar ? "يدفعها المستأجر" : "Tenant pays" },
                    { v: "owner", l: ar ? "يدفعها المالك" : "Owner pays" },
                  ].map((opt) => (
                    <button key={opt.v} type="button" onClick={() => updateMeta(it.key, "pays", opt.v)}
                      className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg border transition ${
                        pays === opt.v ? "bg-sage-500 text-primary-foreground border-transparent" : "bg-card text-sage-600 border-sage-200"
                      }`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function LegalTab({ unit, reload }: any) {
  const t2 = useT2();
  const lc = unit.legal_case || { active: false };
  const [editing, setEditing] = useState(lc.active);
  const [form, setForm] = useState({ case_number: lc.case_number || "", court: lc.court || "", lawyer: lc.lawyer || "", claim_amount: lc.claim_amount || "", notes: lc.notes || "" });

  const save = async () => {
    await supabase.from("units").update({ legal_case: { ...form, active: true, status: "ongoing" } }).eq("id", unit.id);
    toast.success("✓");
    setEditing(true);
    reload();
  };

  if (!editing && !lc.active) {
    return (
      <Card className="text-center py-8">
        <div className="inline-flex p-3 rounded-2xl bg-sage-100 mb-3"><Scale className="h-7 w-7 text-sage-400" /></div>
        <h3 className="font-bold text-sage-600 mb-1">{t2("no_legal_case")}</h3>
        <Button onClick={() => setEditing(true)} className="mt-3 rounded-xl bg-gradient-sage text-primary-foreground h-11 px-5 font-semibold">
          <Plus className="h-4 w-4 me-1.5" />{t2("file_legal_case")}
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-sage-600 font-bold mb-3 text-sm flex items-center justify-between">
        {t2("file_legal_case")}
        {lc.active && <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-terracotta/15 text-terracotta">ongoing</span>}
      </h3>
      <div className="space-y-2.5">
        {[
          { k: "case_number", l: t2("case_number") },
          { k: "court", l: t2("court") },
          { k: "lawyer", l: t2("lawyer") },
          { k: "claim_amount", l: t2("claim_amount") },
          { k: "notes", l: t2("notes") },
        ].map((f) => (
          <div key={f.k} className="space-y-1">
            <label className="text-xs font-semibold text-sage-500">{f.l}</label>
            <Input value={(form as any)[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} className="rounded-xl border-sage-200 bg-card h-10 text-sm" />
          </div>
        ))}
        <Button onClick={save} className="w-full rounded-xl bg-gradient-sage text-primary-foreground h-11 mt-2 font-semibold">{t2("save")}</Button>
      </div>
    </Card>
  );
}

function PhotosTab({ unit, reload }: any) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const photos: string[] = Array.isArray(unit.handover_photos) ? unit.handover_photos : [];
  const labels: Record<string, string> = (unit.photo_labels && typeof unit.photo_labels === "object") ? unit.photo_labels : {};
  const kinds: Record<string, string> = (unit.photo_kinds && typeof unit.photo_kinds === "object") ? unit.photo_kinds : {};
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [classifying, setClassifying] = useState<Record<string, boolean>>({});
  const [detecting, setDetecting] = useState(false);
  const [report, setReport] = useState<any | null>(null);

  const labelText = (k?: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      living: { ar: "صالة", en: "Living" },
      bedroom: { ar: "غرفة نوم", en: "Bedroom" },
      kitchen: { ar: "مطبخ", en: "Kitchen" },
      bathroom: { ar: "حمّام", en: "Bathroom" },
      entrance: { ar: "مدخل", en: "Entrance" },
      exterior: { ar: "خارجي", en: "Exterior" },
      balcony: { ar: "شرفة", en: "Balcony" },
      other: { ar: "أخرى", en: "Other" },
    };
    if (!k) return null;
    return map[k] ? (ar ? map[k].ar : map[k].en) : k;
  };

  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const p of photos) {
        const { data } = await supabase.storage.from("unit-photos").createSignedUrl(p, 3600);
        if (data?.signedUrl) map[p] = data.signedUrl;
      }
      setSigned(map);
    })();
  }, [unit.handover_photos]);

  const classifyOne = async (_p: string, _signedUrl?: string) => {};


  const cycleKind = async (p: string) => {
    const cur = kinds[p];
    const nextVal = cur === "handover" ? "return" : cur === "return" ? "" : "handover";
    const next = { ...kinds };
    if (nextVal) next[p] = nextVal; else delete next[p];
    await supabase.from("units").update({ photo_kinds: next }).eq("id", unit.id);
    reload?.();
  };

  const removePhoto = async (p: string) => {
    await supabase.storage.from("unit-photos").remove([p]);
    const next = photos.filter((x) => x !== p);
    const nextLabels = { ...labels };
    delete nextLabels[p];
    const nextKinds = { ...kinds };
    delete nextKinds[p];
    await supabase.from("units").update({ handover_photos: next, photo_labels: nextLabels, photo_kinds: nextKinds }).eq("id", unit.id);
    reload?.();
  };

  const handoverCount = photos.filter((p) => kinds[p] === "handover").length;
  const returnCount = photos.filter((p) => kinds[p] === "return").length;

  const detectDamage = async () => {};


  const kindBadge = (k?: string) => {
    if (k === "handover") return ar ? "تسليم" : "Handover";
    if (k === "return") return ar ? "استلام" : "Return";
    return ar ? "تحديد" : "Mark";
  };
  const kindClass = (k?: string) =>
    k === "handover"
      ? "bg-sage-500 text-primary-foreground"
      : k === "return"
      ? "bg-burgundy text-primary-foreground"
      : "bg-card/95 border border-sage-200/60 text-sage-600";

  const sevColor = (s: string) =>
    s === "severe" ? "text-burgundy" : s === "moderate" ? "text-amber-600" : s === "minor" ? "text-sage-600" : "text-muted-foreground";

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {photos.map((p) => {
          const lbl = labels[p];
          const kd = kinds[p];
          const isClassifying = classifying[p];
          return (
            <div key={p} className="relative aspect-square rounded-2xl overflow-hidden border border-sage-200/40 bg-muted/40">
              {signed[p] ? <img src={signed[p]} alt={labelText(lbl) || ""} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-sage-400"><Camera className="h-5 w-5" /></div>}
              <button onClick={() => removePhoto(p)} className="absolute top-1 end-1 h-7 w-7 rounded-full bg-burgundy text-primary-foreground grid place-items-center shadow-soft">
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => cycleKind(p)}
                className={`absolute top-1 start-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-soft ${kindClass(kd)}`}
              >
                {kindBadge(kd)}
              </button>
              {lbl ? (
                <button
                  onClick={() => classifyOne(p, signed[p])}
                  disabled={isClassifying}
                  title={ar ? "إعادة التصنيف" : "Reclassify"}
                  className="absolute bottom-1 start-1 px-2 py-0.5 rounded-full bg-card/95 border border-sage-200/60 text-[10px] font-bold text-sage-600 flex items-center gap-1"
                >
                  {isClassifying ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5 text-sage-500" />}
                  {labelText(lbl)}
                </button>
              ) : (
                <button
                  onClick={() => classifyOne(p, signed[p])}
                  disabled={isClassifying}
                  className="absolute bottom-1 start-1 px-2 py-0.5 rounded-full bg-sage-500 text-primary-foreground text-[10px] font-bold flex items-center gap-1 shadow-soft"
                >
                  {isClassifying ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                  {ar ? "تصنيف" : "Classify"}
                </button>
              )}
            </div>
          );
        })}
        {photos.length === 0 && (
          <div className="col-span-2 aspect-[2/1] rounded-2xl border-2 border-dashed border-sage-200 bg-muted/40 grid place-items-center text-sage-400 flex-col gap-2">
            <Camera className="h-6 w-6" />
            <span className="text-[11px] text-muted-foreground">{ar ? "لم تُضَف صور للوحدة بعد" : "No photos added yet"}</span>
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] text-muted-foreground text-center">
            {ar
              ? `صنّف كل صورة: تسليم أو استلام — الحالي: ${handoverCount} تسليم / ${returnCount} استلام`
              : `Mark each photo as Handover or Return — current: ${handoverCount} handover / ${returnCount} return`}
          </div>
          <Button
            onClick={detectDamage}
            disabled={detecting || handoverCount === 0 || returnCount === 0}
            className="w-full rounded-xl bg-gradient-sage text-primary-foreground h-11 font-semibold flex items-center gap-2"
          >
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {ar ? "اكتشاف الأضرار بالذكاء الاصطناعي" : "Detect damage with AI"}
          </Button>
        </div>
      )}

      {report && (
        <div className="mt-3 rounded-2xl border border-sage-200/60 bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-sage-600 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              {ar ? "تقرير الفحص" : "Damage report"}
            </div>
            <button onClick={() => setReport(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          {report.summary && <p className="text-xs text-muted-foreground">{report.summary}</p>}
          <div className={`text-xs font-semibold ${sevColor(report.overall_severity)}`}>
            {ar ? "الخطورة الإجمالية: " : "Overall severity: "}
            {report.overall_severity}
          </div>
          {Array.isArray(report.items) && report.items.length > 0 ? (
            <ul className="space-y-1.5">
              {report.items.map((it: any, i: number) => (
                <li key={i} className="rounded-xl border border-sage-200/40 bg-muted/30 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sage-600">{it.location}</span>
                    <span className={`font-semibold ${sevColor(it.severity)}`}>{it.severity}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">{it.description}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-sage-600 font-semibold">{ar ? "لا توجد أضرار مسجّلة" : "No notable damage"}</div>
          )}
        </div>
      )}

      <FileUpload
        bucket="unit-photos"
        pathPrefix={`${unit.building_id}/${unit.id}`}
        value={null}
        onChange={() => {}}
        multiple
        onMultipleUploaded={async (vals) => {
          if (!vals.length) return;
          const next = [...photos, ...vals];
          await supabase.from("units").update({ handover_photos: next }).eq("id", unit.id);
          reload?.();
          vals.forEach((v) => classifyOne(v));
        }}
        accept="image/*"
        label={ar ? "إضافة صور" : "Add photos"}
      />

    </>
  );
}


function Card({ children, className = "" }: any) {
  return <div className={`bg-card border border-sage-200/40 rounded-2xl p-4 shadow-soft ${className}`}>{children}</div>;
}

function Row({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-sage-200/30 last:border-0">
      <Icon className="h-4 w-4 text-sage-400" />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-sm font-semibold text-sage-600 truncate max-w-[55%] text-end">{value}</span>
    </div>
  );
}

function getDueForMonth(dueDay: number, year: number, month: number): Date {
  // dueDay now reflects the contract-start day-of-month (synced on save).
  const day = Math.max(1, Math.min(28, dueDay || 1));
  const lastOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastOfMonth));
}


function DueDateRow({ unit, t2, lang }: any) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [ym, setYm] = useState<string>(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [y, m] = ym.split("-").map(Number);
  const target = getDueForMonth(unit.due_day, y, m - 1);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  const locale = lang === "ar" ? "ar" : lang === "fr" ? "fr" : lang === "es" ? "es" : lang === "tr" ? "tr" : "en";
  const dateStr = target.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const dayLabel = (t2("due_day_of_month") as string).replace("{n}", String(unit.due_day));

  // Build month options: 6 past + current + 12 future
  const options: { value: string; label: string }[] = [];
  for (let i = -6; i <= 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value: v, label: d.toLocaleDateString(locale, { month: "long", year: "numeric" }) });
  }

  let badgeText: string; let badgeCls: string;
  if (diff < 0) {
    badgeText = (t2("days_overdue") as string).replace("{n}", String(Math.abs(diff)));
    badgeCls = "bg-burgundy/15 text-burgundy";
  } else if (diff === 0) {
    badgeText = t2("due_today") as string;
    badgeCls = "bg-terracotta/15 text-terracotta";
  } else if (diff <= 3) {
    badgeText = (t2("days_left") as string).replace("{n}", String(diff));
    badgeCls = "bg-terracotta/15 text-terracotta";
  } else {
    badgeText = (t2("days_left") as string).replace("{n}", String(diff));
    badgeCls = "bg-sage-300/30 text-sage-600";
  }

  return (
    <div className="py-2 border-b border-sage-200/30 space-y-2">
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4 text-sage-400" />
        <span className="text-xs text-muted-foreground flex-1">{t2("due_day")}</span>
        <span className="text-sm font-semibold text-sage-600 text-end">{dayLabel}</span>
      </div>
      <div className="flex items-center gap-2 ps-7">
        <span className="text-[11px] text-muted-foreground flex-1">{t2("select_month")}</span>
        <select
          value={ym}
          onChange={(e) => setYm(e.target.value)}
          className="h-8 rounded-lg border border-sage-200 bg-card text-xs px-2 text-sage-600 font-semibold focus:outline-none focus:ring-1 focus:ring-sage-400"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 ps-7">
        <span className="text-[11px] text-muted-foreground flex-1">{t2("next_due")}</span>
        <span className="text-xs font-semibold text-sage-600">{dateStr}</span>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeCls}`}>{badgeText}</span>
      </div>
    </div>
  );
}

function LeaseHistoryCard({ unitId, tenancies, payments, format, lang }: { unitId: string; tenancies: any[]; payments: any[]; format: (n: number) => string; lang: string }) {
  const past = (tenancies || []).filter((t) => t.status === "ended");
  if (past.length === 0) return null;
  const ar = lang === "ar";
  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString(ar ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" }) : "—";
  return (
    <div className="rounded-2xl bg-card border border-sage-200/50 p-5 shadow-soft space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-sage-600" />
        <h3 className="text-sage-600 font-bold text-sm">{ar ? "سجل المستأجرين السابقين" : "Lease history"}</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sage-100 text-sage-600">{past.length}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {ar
          ? "الإيصالات أدناه محفوظة بالكامل ومرتبطة بعقود منتهية — لا تؤثر على رصيد المستأجر الحالي."
          : "Receipts below are preserved on ended leases and do not affect the current tenant's balance."}
      </p>
      <div className="space-y-2">
        {past.map((t) => {
          const tPays = (payments || []).filter((p: any) => p.tenancy_id === t.id);
          const totalPaid = tPays.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          return (
            <div key={t.id} className="rounded-xl border border-sage-200/60 bg-sage-50/30 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-sage-700 truncate">{t.tenant_name || "—"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {fmtDate(t.contract_start_date)} <span className="opacity-50">→</span> {fmtDate(t.ended_at || t.contract_end_date)}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-[10px] text-muted-foreground">{ar ? "إجمالي المدفوع" : "Total paid"}</p>
                  <p className="text-sm font-black text-sage-700 tabular-nums">{format(totalPaid)}</p>
                </div>
              </div>
              {(Number(t.outstanding_at_end) > 0.009 || t.deposit_status) && (
                <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                  {Number(t.outstanding_at_end) > 0.009 && (
                    <span className="px-2 py-0.5 rounded-full bg-burgundy/10 text-burgundy font-bold">
                      {ar ? `متبقٍّ عند الإنهاء: ${format(Number(t.outstanding_at_end))}` : `Outstanding at end: ${format(Number(t.outstanding_at_end))}`}
                    </span>
                  )}
                  {t.deposit_status && t.deposit_status !== "none" && (
                    <span className="px-2 py-0.5 rounded-full bg-sage-100 text-sage-600 font-bold">
                      {ar ? "التأمين: " : "Deposit: "}{t.deposit_status}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-sage-100/80 text-sage-600 font-semibold">
                    {tPays.length} {ar ? "إيصال" : "receipts"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
