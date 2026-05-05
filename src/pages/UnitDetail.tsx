import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, User, Phone, FileText, IdCard, Calendar, Wallet, Plus, Receipt, Wrench, Scale, Camera, Droplets, Zap, Flame, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Unit {
  id: string; building_id: string; unit_number: string; floor: number; type: string;
  tenant_name: string | null; tenant_phone: string | null;
  rent_amount: number; rent_type: string; due_day: number; status: string;
  contract_end_date: string | null; last_paid_date: string | null;
  water_account: string | null; electric_account: string | null; gas_account: string | null; internet_account: string | null;
  utilities: any; legal_case: any; handover_photos: any;
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
  const { t } = useI18n();
  const t2 = useT2();
  const { format } = useCurrency();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [buildingName, setBuildingName] = useState<string>("");
  const [tab, setTab] = useState<Tab>("details");
  const [delOpen, setDelOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("units").select("*").eq("id", id).maybeSingle();
    setUnit(data as any);
  };
  useEffect(() => { load(); }, [id]);

  const handleDelete = async () => {
    if (!unit) return;
    const { error } = await supabase.from("units").delete().eq("id", unit.id);
    if (error) return toast.error(error.message);
    toast.success("✓");
    navigate(`/buildings/${unit.building_id}`);
  };

  const registerPayment = async () => {
    if (!unit) return;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("payments").insert({
      unit_id: unit.id,
      amount: unit.rent_amount,
      payment_date: today,
      receipt_number: `R-${Date.now()}`,
    });
    if (error) return toast.error(error.message);
    await supabase.from("units").update({ last_paid_date: today, status: "paid" }).eq("id", unit.id);
    toast.success("✓");
    load();
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
        {tab === "details" && <DetailsTab unit={unit} format={format} t2={t2} onPay={registerPayment} />}
        {tab === "maintenance" && <MaintenanceTab />}
        {tab === "utilities" && <UtilitiesTab unit={unit} reload={load} />}
        {tab === "legal" && <LegalTab unit={unit} reload={load} />}
        {tab === "photos" && <PhotosTab />}
      </div>

      <ConfirmDeleteDialog open={delOpen} onOpenChange={setDelOpen} onConfirm={handleDelete} />
    </div>
  );
}

function DetailsTab({ unit, format, t2, onPay }: any) {
  return (
    <>
      <Card>
        <h3 className="text-sage-600 font-bold mb-3 text-sm">{t2("tenant_name")}</h3>
        <Row icon={User} label={t2("tenant_name")} value={unit.tenant_name || "—"} />
        <Row icon={Phone} label={t2("tenant_phone")} value={unit.tenant_phone || "—"} />
        <Row icon={IdCard} label="ID" value={unit.tenant_id_number || "—"} />
        <Row icon={FileText} label="Contract" value={unit.contract_file_url ? "✓" : "—"} />
      </Card>
      <Card>
        <h3 className="text-sage-600 font-bold mb-3 text-sm">{t2("rent_amount")}</h3>
        <Row icon={Wallet} label={t2("rent_amount")} value={`${format(Number(unit.rent_amount))} / ${t2(unit.rent_type)}`} />
        <Row icon={Calendar} label={t2("due_day")} value={`${unit.due_day}`} />
        <Row icon={Receipt} label={t2("last_payment")} value={unit.last_paid_date || "—"} />
        <Row icon={Calendar} label={t2("contract_end")} value={unit.contract_end_date || "—"} />
      </Card>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="outline" className="rounded-xl border-sage-300 text-sage-600 h-12 font-semibold">
          <Receipt className="h-4 w-4 me-1.5" />{t2("issue_receipt")}
        </Button>
        <Button onClick={onPay} className="rounded-xl bg-gradient-sage text-primary-foreground h-12 font-semibold shadow-soft">
          <Plus className="h-4 w-4 me-1.5" />{t2("register_payment")}
        </Button>
      </div>
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

function PhotosTab() {
  const t2 = useT2();
  const rooms = ["Living room", "Kitchen", "Bedroom", "Bathroom"];
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {rooms.map((r) => (
          <div key={r} className="aspect-square rounded-2xl border-2 border-dashed border-sage-200 bg-muted/40 flex flex-col items-center justify-center text-sage-400">
            <Camera className="h-6 w-6 mb-1" />
            <span className="text-[10px] font-semibold">{r}</span>
          </div>
        ))}
      </div>
      <Button variant="outline" className="w-full rounded-xl border-sage-300 text-sage-600 h-12 font-semibold">
        <Plus className="h-4 w-4 me-1.5" />{t2("add_photo")}
      </Button>
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
