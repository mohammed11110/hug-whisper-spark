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
import { buildLeaseHTML, downloadHTMLAsPDF, downloadLeasePDF, printHTML, buildTenantStatementHTML, type StatementRow } from "@/lib/pdfDocs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { EndTenancyDialog } from "@/components/EndTenancyDialog";
import { NewTenancyDialog } from "@/components/NewTenancyDialog";
import { AddMaintenanceDialog } from "@/components/AddMaintenanceDialog";
import { FileUpload } from "@/components/FileUpload";
import { computeBalance, type PaymentForBalance } from "@/lib/balance";

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
  const [priorArrears, setPriorArrears] = useState<{ count: number; total: number }>({ count: 0, total: 0 });

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("units").select("*").eq("id", id).maybeSingle();
    setUnit(data as any);
    if (data?.building_id) {
      const { data: b } = await supabase.from("buildings").select("name, name_en").eq("id", data.building_id).maybeSingle();
      if (b) setBuildingName((b as any).name || (b as any).name_en || "");
    }
    const { data: ps } = await supabase.from("payments").select("unit_id,amount,deleted_at").eq("unit_id", id).is("deleted_at", null);
    setPayments((ps || []) as any);
    const { data: ts } = await supabase.from("tenancies").select("id,status,outstanding_at_end").eq("unit_id", id);
    const active = (ts || []).find((t: any) => t.status === "active");
    setActiveTenancyId(active?.id || null);
    const ended = (ts || []).filter((t: any) => t.status === "ended" && Number(t.outstanding_at_end) > 0);
    setPriorArrears({ count: ended.length, total: ended.reduce((s: number, t: any) => s + Number(t.outstanding_at_end), 0) });
  };
  useEffect(() => { load(); }, [id]);

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

  const exportLease = async (mode: "download" | "print") => {
    if (!unit) return;
    const leaseData = {
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
      lang: lang === "ar" ? "ar" : "en",
    } as const;

    if (mode === "print") {
      const html = buildLeaseHTML(leaseData);
      printHTML(html);
    } else {
      try {
        await downloadLeasePDF(leaseData, `lease-${unit.unit_number}-${unit.tenant_name || "tenant"}.pdf`);
        toast.success("PDF ✓");
      } catch (e: any) { toast.error(e.message || "PDF error"); }
    }
  };

  const exportStatement = async () => {
    if (!unit) return;
    // Build statement timeline: opening balance + monthly charges from contract start + actual payments
    const { data: ps } = await supabase
      .from("payments")
      .select("amount, payment_date, period_start, receipt_number, notes")
      .eq("unit_id", unit.id)
      .is("deleted_at", null)
      .order("payment_date", { ascending: true });

    type Entry = { date: string; description: string; charge: number; payment: number; sortKey: string };
    const entries: Entry[] = [];
    const opening = Number((unit as any).opening_balance || 0);
    const openingDate = (unit as any).opening_balance_date || (unit as any).contract_start_date || new Date().toISOString().slice(0, 10);
    if (opening > 0) {
      entries.push({
        date: openingDate,
        description: lang === "ar" ? "رصيد افتتاحي (متأخرات سابقة)" : "Opening balance (prior arrears)",
        charge: opening,
        payment: 0,
        sortKey: openingDate + "0",
      });
    }
    // Monthly rent charges
    const rent = Number(unit.rent_amount) || 0;
    const startStr = (unit as any).contract_start_date;
    if (rent > 0 && startStr && unit.rent_type === "monthly") {
      const start = new Date(startStr);
      const now = new Date();
      const cursor = new Date(start.getFullYear(), start.getMonth(), Math.min(start.getDate(), 28));
      while (cursor <= now) {
        const d = cursor.toISOString().slice(0, 10);
        const monthLbl = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
        entries.push({
          date: d,
          description: (lang === "ar" ? "إيجار شهر " : "Rent ") + monthLbl,
          charge: rent,
          payment: 0,
          sortKey: d + "1",
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    (ps || []).forEach((p: any) => {
      entries.push({
        date: p.payment_date,
        description: (lang === "ar" ? "دفعة" : "Payment") + (p.receipt_number ? ` #${p.receipt_number}` : "") + (p.notes ? ` — ${p.notes}` : ""),
        charge: 0,
        payment: Number(p.amount),
        sortKey: p.payment_date + "2",
      });
    });
    entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    let bal = 0;
    const rows: StatementRow[] = entries.map((e) => {
      bal += e.charge - e.payment;
      return { date: e.date, description: e.description, charge: e.charge, payment: e.payment, balance: bal };
    });
    const totalCharges = entries.reduce((s, e) => s + e.charge, 0);
    const totalPaid = entries.reduce((s, e) => s + e.payment, 0);

    const html = buildTenantStatementHTML({
      brand: settings.brand,
      currency: currency.symbol,
      generatedAt: new Date().toISOString().slice(0, 10),
      tenantName: unit.tenant_name || "—",
      tenantPhone: unit.tenant_phone,
      building: buildingName || "—",
      unitNumber: unit.unit_number,
      contractStart: (unit as any).contract_start_date,
      contractEnd: unit.contract_end_date,
      rentAmount: rent,
      rentType: t2(unit.rent_type as any),
      rows,
      totals: {
        totalCharges,
        totalPaid,
        outstanding: Math.max(0, totalCharges - totalPaid),
        openingBalance: opening,
        securityDeposit: Number((unit as any).security_deposit || 0),
      },
    });
    try {
      await downloadHTMLAsPDF(html, `statement-${unit.unit_number}-${(unit.tenant_name || "tenant").replace(/\s+/g, "_")}.pdf`, settings);
      toast.success("PDF ✓");
    } catch (e: any) { toast.error(e.message || "PDF error"); }
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
        {priorArrears.count > 0 && (
          <div className="rounded-2xl border border-burgundy/30 bg-burgundy/10 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-burgundy">⚠️ {t2("previous_tenant_arrears")}</span>
            <span className="text-sm font-black text-burgundy">{format(priorArrears.total)}</span>
          </div>
        )}
        {tab === "details" && (
          unit.tenant_name ? (
            <DetailsTab unit={unit} payments={payments} format={format} t2={t2} lang={lang}
              onPay={() => setPayOpen(true)} onLeasePDF={() => exportLease("download")} onLeasePrint={() => exportLease("print")}
              onStatement={exportStatement}
              onEnd={() => setEndOpen(true)} reload={load} />
          ) : (
            <VacantState t2={t2} onAdd={() => setNewTenantOpen(true)} />
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

function DetailsTab({ unit, payments, format, t2, lang, onPay, onLeasePDF, onLeasePrint, onStatement, onEnd, reload }: any) {
  const bal = computeBalance(unit, payments);
  const [editingArrears, setEditingArrears] = useState(false);
  const [arrearsVal, setArrearsVal] = useState<string>(String(unit.opening_balance ?? 0));
  const [arrearsDate, setArrearsDate] = useState<string>(unit.opening_balance_date || new Date().toISOString().slice(0, 10));
  const [savingArrears, setSavingArrears] = useState(false);

  const saveArrears = async () => {
    setSavingArrears(true);
    const val = parseFloat(arrearsVal) || 0;
    const { error } = await supabase.from("units").update({
      opening_balance: val,
      opening_balance_date: val > 0 ? arrearsDate : null,
    }).eq("id", unit.id);
    setSavingArrears(false);
    if (error) return toast.error(error.message);
    logActivity({
      entityType: "unit",
      action: "updated",
      entityId: unit.id,
      entityLabel: unit.unit_number,
      buildingId: unit.building_id,
      descriptionAr: `تعديل المتأخرات الافتتاحية — وحدة ${unit.unit_number}`,
      descriptionEn: `Opening arrears updated — unit ${unit.unit_number}`,
      changes: { opening_balance: val },
    });
    toast.success("✓");
    setEditingArrears(false);
    reload?.();
  };

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
        <DueDateRow unit={unit} t2={t2} lang={lang} />
        <Row icon={Receipt} label={t2("last_payment")} value={unit.last_paid_date || "—"} />
        <Row icon={Calendar} label={t2("contract_end")} value={unit.contract_end_date || "—"} />
      </Card>
      {unit.tenant_name && (
        <Card>
          <h3 className="text-sage-600 font-bold mb-3 text-sm">{t2("payment_summary")}</h3>
          {/* Editable arrears row */}
          {!editingArrears ? (
            <div className="flex items-center justify-between py-2 border-b border-sage-200/30">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5" />{t2("arrears")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-sage-600">{format(bal.opening)}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-sage-500 hover:text-sage-600"
                  onClick={() => { setArrearsVal(String(unit.opening_balance ?? 0)); setEditingArrears(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-2 border-b border-sage-200/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5" />{t2("arrears_amount")}
                </span>
                <Input type="number" inputMode="decimal" min={0} step="0.001" value={arrearsVal}
                  onChange={(e) => setArrearsVal(e.target.value)}
                  className="h-9 w-32 text-end rounded-lg border-sage-200" autoFocus />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{lang === "ar" ? "تاريخ الرصيد" : "Balance date"}</span>
                <Input type="date" value={arrearsDate} onChange={(e) => setArrearsDate(e.target.value)}
                  className="h-9 w-40 rounded-lg border-sage-200" />
              </div>
              <p className="text-[11px] text-muted-foreground">{t2("arrears_hint")}</p>
              <div className="flex gap-1.5 justify-end">
                <Button size="sm" variant="ghost" className="h-8 rounded-lg text-muted-foreground"
                  onClick={() => setEditingArrears(false)} disabled={savingArrears}>
                  <X className="h-3.5 w-3.5 me-1" />{t2("cancel")}
                </Button>
                <Button size="sm" className="h-8 rounded-lg bg-gradient-sage text-primary-foreground"
                  onClick={saveArrears} disabled={savingArrears}>
                  <Check className="h-3.5 w-3.5 me-1" />{t2("save")}
                </Button>
              </div>
            </div>
          )}
          <Row icon={Wallet} label={t2("total_due")} value={format(bal.totalDue)} />
          <Row icon={Wallet} label={t2("total_received")} value={format(bal.paid)} />
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-sage-200/40">
            <span className="text-sm font-bold text-sage-600">{t2("outstanding_balance")}</span>
            <span className={`text-base font-black ${bal.outstanding > 0 ? "text-burgundy" : "text-sage-600"}`}>{format(bal.outstanding)}</span>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="outline" onClick={onLeasePDF} className="rounded-xl border-sage-300 text-sage-600 h-12 font-semibold">
          <FileSignature className="h-4 w-4 me-1.5" />{lang === "ar" ? "عقد PDF" : "Lease PDF"}
        </Button>
        <Button onClick={onPay} className="rounded-xl bg-gradient-sage text-primary-foreground h-12 font-semibold shadow-soft">
          <Plus className="h-4 w-4 me-1.5" />{t2("register_payment")}
        </Button>
      </div>
      <Button variant="outline" onClick={onStatement} className="w-full rounded-xl border-sage-300 text-sage-600 h-11 font-semibold">
        <Receipt className="h-4 w-4 me-1.5" />{t2("tenant_statement")} PDF
      </Button>
      <Button variant="ghost" onClick={onLeasePrint} className="w-full rounded-xl text-sage-500 h-10 text-xs">
        {lang === "ar" ? "🖨️ طباعة العقد" : "🖨️ Print contract"}
      </Button>
      <Button variant="outline" onClick={onEnd} className="w-full rounded-xl border-burgundy/40 text-burgundy hover:bg-burgundy/10 h-11">
        {t2("end_tenancy")}
      </Button>
    </>
  );
}

function MaintenanceTab() {
  const items = [
    { name: "AC", status: "good", icon: "❄️" },
    { name: "Heater", status: "good", icon: "🔥" },
    { name: "Fan", status: "needs", icon: "🌀" },
    { name: "Lighting", status: "good", icon: "💡" },
    { name: "Exhaust", status: "good", icon: "🌬" },
    { name: "Faucet", status: "replace", icon: "🚰" },
  ];
  const colorMap: Record<string, string> = { good: "bg-sage-300/25 text-sage-600", needs: "bg-terracotta/15 text-terracotta", replace: "bg-burgundy/15 text-burgundy" };
  return (
    <Card>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-3 py-2 border-b border-sage-200/40 last:border-0">
            <span className="text-xl">{it.icon}</span>
            <span className="flex-1 font-semibold text-sage-600">{it.name}</span>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${colorMap[it.status]}`}>{it.status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function UtilitiesTab({ unit, reload }: any) {
  const t2 = useT2();
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
              <p className="text-[10px] opacity-80 uppercase mt-0.5">{on ? t2("active") : t2("inactive")}</p>
            </button>
          );
        })}
      </div>
      <Card>
        <h3 className="text-sage-600 font-bold mb-3 text-sm">{t2("account_number")}</h3>
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sage-500 w-16">{it.label}</span>
              <Input defaultValue={unit[it.accountKey] || ""} onBlur={(e) => updateAccount(it.accountKey, e.target.value)}
                className="rounded-xl border-sage-200 bg-card h-9 text-sm" placeholder="—" />
            </div>
          ))}
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

  const classifyOne = async (p: string, signedUrl?: string) => {
    let url = signedUrl;
    if (!url) {
      const { data } = await supabase.storage.from("unit-photos").createSignedUrl(p, 3600);
      url = data?.signedUrl;
    }
    if (!url) return;
    setClassifying((c) => ({ ...c, [p]: true }));
    try {
      const resp = await supabase.functions.invoke("classify-photo", { body: { imageUrl: url } });
      if (resp.error) throw resp.error;
      const label = (resp.data as any)?.label || "other";
      const next = { ...labels, [p]: label };
      await supabase.from("units").update({ photo_labels: next }).eq("id", unit.id);
      reload?.();
    } catch (e: any) {
      toast.error(e?.message || (ar ? "تعذّر التصنيف" : "Classify failed"));
    } finally {
      setClassifying((c) => ({ ...c, [p]: false }));
    }
  };

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

  const detectDamage = async () => {
    const handoverPaths = photos.filter((p) => kinds[p] === "handover");
    const returnPaths = photos.filter((p) => kinds[p] === "return");
    if (handoverPaths.length === 0 || returnPaths.length === 0) {
      toast.error(ar ? "حدّد صور تسليم وصور استلام أولاً" : "Mark handover and return photos first");
      return;
    }
    setDetecting(true);
    setReport(null);
    try {
      const sign = async (paths: string[]) => {
        const out: string[] = [];
        for (const p of paths) {
          const { data } = await supabase.storage.from("unit-photos").createSignedUrl(p, 3600);
          if (data?.signedUrl) out.push(data.signedUrl);
        }
        return out;
      };
      const [handoverUrls, returnUrls] = await Promise.all([sign(handoverPaths), sign(returnPaths)]);
      const resp = await supabase.functions.invoke("detect-damage", { body: { handoverUrls, returnUrls, lang } });
      if (resp.error) throw resp.error;
      setReport(resp.data);
    } catch (e: any) {
      toast.error(e?.message || (ar ? "تعذّر الفحص" : "Detection failed"));
    } finally {
      setDetecting(false);
    }
  };

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
          <div className="col-span-2 aspect-[2/1] rounded-2xl border-2 border-dashed border-sage-200 bg-muted/40 grid place-items-center text-sage-400">
            <Camera className="h-6 w-6" />
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] text-muted-foreground text-center">
            {ar
              ? `حدّد كل صورة كـ "تسليم" أو "استلام" — الحالي: ${handoverCount} تسليم / ${returnCount} استلام`
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
            <div className="text-xs text-sage-600 font-semibold">{ar ? "لا توجد أضرار ملحوظة" : "No notable damage"}</div>
          )}
        </div>
      )}

      <FileUpload
        bucket="unit-photos"
        pathPrefix={`${unit.building_id}/${unit.id}`}
        value={null}
        onChange={async (v) => {
          if (!v) return;
          const next = [...photos, v];
          await supabase.from("units").update({ handover_photos: next }).eq("id", unit.id);
          reload?.();
          // Auto-classify in background
          classifyOne(v);
        }}
        accept="image/*"
        label={ar ? "إضافة صورة" : "Add photo"}
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
  const day = Math.max(1, Math.min(31, dueDay || 1));
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
