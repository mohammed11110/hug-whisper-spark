import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, FileMinus2, CheckCircle2, ArrowRight, Building2, Loader2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAppSettings, formatReceipt } from "@/lib/appSettings";
import { allocateReceiptNumbers } from "@/lib/receiptNumbering";
import { logActivity } from "@/lib/activityLogger";
import { toast } from "sonner";
import { useLiveData } from "@/lib/useLiveData";

interface DebtRow {
  tenancy_id: string;
  unit_id: string;
  building_id: string;
  building_name: string;
  unit_number: string;
  tenant_name: string;
  contract_number: string | null;
  ended_at: string | null;
  closing_balance: number;
  days_since: number;
}

export default function PreviousBalances() {
  const { lang } = useI18n();
  const { format } = useCurrency();
  const { settings } = useAppSettings();
  const ar = lang === "ar";
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const [collectFor, setCollectFor] = useState<DebtRow | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMethod, setCollectMethod] = useState<"cash" | "transfer" | "cheque" | "card">("cash");
  const [writeOffFor, setWriteOffFor] = useState<DebtRow | null>(null);
  const [writeOffReason, setWriteOffReason] = useState("");
  const [saving, setSaving] = useState(false);

  useLiveData(
    ["tenancies", "payments", "units", "buildings"],
    () => setTick((t) => t + 1),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: ts } = await supabase
        .from("tenancies")
        .select("id,unit_id,building_id,tenant_name,contract_number,official_contract_number,ended_at,closing_balance,debt_resolution,debt_settled")
        .eq("status", "ended")
        .eq("debt_resolution", "kept")
        .eq("debt_settled", false)
        .order("ended_at", { ascending: false });
      if (cancelled) return;
      const unitIds = Array.from(new Set((ts || []).map((t: any) => t.unit_id)));
      const buildingIds = Array.from(new Set((ts || []).map((t: any) => t.building_id)));
      const { data: us } = unitIds.length
        ? await supabase.from("units").select("id,unit_number").in("id", unitIds)
        : { data: [] as any[] };
      const { data: bs } = buildingIds.length
        ? await supabase.from("buildings").select("id,name,name_en").in("id", buildingIds)
        : { data: [] as any[] };
      const uMap = new Map((us || []).map((u: any) => [u.id, u]));
      const bMap = new Map((bs || []).map((b: any) => [b.id, b]));
      const todayMs = Date.now();
      const list: DebtRow[] = (ts || [])
        .filter((t: any) => Number(t.closing_balance || 0) > 0.009)
        .map((t: any) => {
          const u = uMap.get(t.unit_id);
          const b = bMap.get(t.building_id);
          const ended = t.ended_at ? new Date(t.ended_at) : null;
          const days = ended ? Math.max(0, Math.floor((todayMs - ended.getTime()) / 86400000)) : 0;
          return {
            tenancy_id: t.id,
            unit_id: t.unit_id,
            building_id: t.building_id,
            building_name: (ar ? b?.name : b?.name_en || b?.name) || "—",
            unit_number: u?.unit_number || "—",
            tenant_name: t.tenant_name || "—",
            contract_number: t.official_contract_number || t.contract_number || null,
            ended_at: t.ended_at,
            closing_balance: Number(t.closing_balance) || 0,
            days_since: days,
          };
        });
      setRows(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ar, tick]);

  const openCollect = (r: DebtRow) => {
    setCollectFor(r);
    setCollectAmount(r.closing_balance.toFixed(3));
    setCollectMethod("cash");
  };
  const openWriteOff = (r: DebtRow) => {
    setWriteOffFor(r);
    setWriteOffReason("");
  };

  const totalDebt = rows.reduce((s, r) => s + r.closing_balance, 0);

  const submitCollect = async () => {
    if (!collectFor) return;
    const amount = Math.max(0, Number(collectAmount) || 0);
    if (amount <= 0.009) return toast.error(ar ? "أدخل مبلغًا صحيحًا" : "Enter a valid amount");
    setSaving(true);
    const alloc = await allocateReceiptNumbers(1);
    const cfg = alloc
      ? { prefix: alloc.prefix, padding: alloc.padding, startNumber: alloc.startNumber, nextNumber: alloc.startNumber }
      : settings.receipt;
    const startNum = alloc ? alloc.startNumber : (settings.receipt.nextNumber || settings.receipt.startNumber || 1);
    const receiptNumber = formatReceipt(cfg, startNum);
    const { error: pErr } = await supabase.from("payments").insert({
      unit_id: collectFor.unit_id,
      tenancy_id: collectFor.tenancy_id,
      amount,
      expected_amount: collectFor.closing_balance,
      payment_date: new Date().toISOString().slice(0, 10),
      receipt_number: receiptNumber,
      payment_method: collectMethod,
      notes: ar ? "تحصيل ذمّة مستأجر سابق" : "Former-tenant arrears collection",
      period_start: null,
      period_end: null,
      kind: "rent",
    });
    if (pErr) { setSaving(false); return toast.error(pErr.message); }
    const newClosing = Math.max(0, collectFor.closing_balance - amount);
    const settled = newClosing <= 0.009;
    const { error: tErr } = await supabase.from("tenancies").update({
      closing_balance: newClosing,
      outstanding_at_end: newClosing,
      debt_settled: settled,
      debt_settled_at: settled ? new Date().toISOString() : null,
      debt_resolution: settled ? "collected" : "kept",
    }).eq("id", collectFor.tenancy_id);
    if (tErr) { setSaving(false); return toast.error(tErr.message); }
    logActivity({
      entityType: "tenant",
      action: "paid",
      entityId: collectFor.unit_id,
      buildingId: collectFor.building_id,
      entityLabel: collectFor.tenant_name,
      descriptionAr: `تحصيل ذمّة سابقة ${format(amount)} من ${collectFor.tenant_name} — وحدة ${collectFor.unit_number}`,
      descriptionEn: `Collected prior debt ${format(amount)} from ${collectFor.tenant_name} — unit ${collectFor.unit_number}`,
      changes: { amount, closing_balance: newClosing, settled, receipt_number: receiptNumber },
    });
    toast.success(ar ? "تم التحصيل ✓" : "Collected ✓");
    setSaving(false);
    setCollectFor(null);
    setTick((x) => x + 1);
  };

  const submitWriteOff = async () => {
    if (!writeOffFor) return;
    const reason = writeOffReason.trim();
    if (reason.length < 4) return toast.error(ar ? "اكتب سببًا (٤ أحرف على الأقل)" : "Write a reason (≥ 4 chars)");
    setSaving(true);
    const { error: pErr } = await supabase.from("payments").insert({
      unit_id: writeOffFor.unit_id,
      tenancy_id: writeOffFor.tenancy_id,
      amount: writeOffFor.closing_balance,
      expected_amount: null,
      payment_date: new Date().toISOString().slice(0, 10),
      receipt_number: null,
      payment_method: null,
      notes: (ar ? "شطب رصيد — " : "Write-off — ") + reason,
      period_start: null,
      period_end: null,
      kind: "adjustment",
    });
    if (pErr) { setSaving(false); return toast.error(pErr.message); }
    const { error: tErr } = await supabase.from("tenancies").update({
      closing_balance: 0,
      outstanding_at_end: 0,
      debt_settled: true,
      debt_settled_at: new Date().toISOString(),
      debt_resolution: "written_off",
      write_off_amount: writeOffFor.closing_balance,
      write_off_reason: reason,
    }).eq("id", writeOffFor.tenancy_id);
    if (tErr) { setSaving(false); return toast.error(tErr.message); }
    logActivity({
      entityType: "tenant",
      action: "updated",
      entityId: writeOffFor.unit_id,
      buildingId: writeOffFor.building_id,
      entityLabel: writeOffFor.tenant_name,
      descriptionAr: `شطب رصيد ${format(writeOffFor.closing_balance)} — ${writeOffFor.tenant_name} — وحدة ${writeOffFor.unit_number} — ${reason}`,
      descriptionEn: `Wrote off ${format(writeOffFor.closing_balance)} — ${writeOffFor.tenant_name} — unit ${writeOffFor.unit_number} — ${reason}`,
      changes: { write_off_amount: writeOffFor.closing_balance, reason },
    });
    toast.success(ar ? "تم الشطب ✓" : "Written off ✓");
    setSaving(false);
    setWriteOffFor(null);
    setTick((x) => x + 1);
  };

  return (
    <div className="mobile-shell min-h-screen pb-24 bg-background">
      <TopBar />
      <div className="px-5 pt-2 pb-1">
        <h1 className="text-xl font-black">{ar ? "ذمم سابقة" : "Previous balances"}</h1>
      </div>

      {/* Hero summary — midnight + gold */}
      <div className="mx-4 mt-3 rounded-3xl p-5 bg-[#0e1118] border border-gold/25 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/55 font-semibold">
              {ar ? "إجمالي الذمم المعلّقة" : "Total outstanding"}
            </div>
            <div className="text-3xl font-black text-gold-bright tabular-nums mt-1">{format(totalDebt)}</div>
            <div className="text-xs text-white/65 mt-1">
              {ar
                ? `${rows.length} ${rows.length === 1 ? "ذمّة" : "ذمم"} من مستأجرين سابقين`
                : `${rows.length} debt${rows.length === 1 ? "" : "s"} from former tenants`}
            </div>
          </div>
          <Wallet className="h-7 w-7 text-gold-bright/70" />
        </div>
      </div>

      {/* List */}
      <div className="px-3 mt-4 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2 rtl:mr-0 rtl:ml-2" />
            {ar ? "تحميل…" : "Loading…"}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sage-200/60 p-8 text-center">
            <CheckCircle2 className="h-7 w-7 text-sage-500 mx-auto mb-2" />
            <p className="text-sm font-semibold">{ar ? "لا توجد ذمم سابقة" : "No previous balances"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {ar ? "كل المستأجرين السابقين تم تسوية حساباتهم." : "Every former tenant has been settled."}
            </p>
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.tenancy_id} className="rounded-2xl bg-card border border-border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{r.building_name} · {r.unit_number}</span>
                  </div>
                  <div className="text-sm font-bold mt-0.5 truncate">{r.tenant_name}</div>
                  {r.contract_number && (
                    <div className="text-[10px] text-muted-foreground tracking-wide">{r.contract_number}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {ar ? "أُنهي في " : "Ended "}
                    <span className="font-semibold">{r.ended_at || "—"}</span>
                    {r.days_since > 0 && (
                      <span className="ms-1">
                        ({ar ? `قبل ${r.days_since} يومًا` : `${r.days_since} day${r.days_since === 1 ? "" : "s"} ago`})
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {ar ? "الرصيد" : "Balance"}
                  </div>
                  <div className="text-lg font-black text-burgundy tabular-nums">{format(r.closing_balance)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => openCollect(r)}
                  className="rounded-xl bg-gold text-primary-foreground hover:bg-gold/90 gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {ar ? "تم التحصيل" : "Mark collected"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openWriteOff(r)}
                  className="rounded-xl gap-1.5"
                >
                  <FileMinus2 className="h-3.5 w-3.5" />
                  {ar ? "شطب" : "Write off"}
                </Button>
                <Link to={`/units/${r.unit_id}`} className="ml-auto rtl:ml-0 rtl:mr-auto">
                  <Button size="sm" variant="ghost" className="rounded-xl gap-1 text-muted-foreground">
                    {ar ? "كشف الوحدة" : "Unit statement"}
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Collect dialog */}
      <Dialog open={!!collectFor} onOpenChange={(o) => !o && setCollectFor(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{ar ? "تحصيل ذمّة سابقة" : "Collect previous balance"}</DialogTitle>
          </DialogHeader>
          {collectFor && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-sm">
                <div className="font-semibold">{collectFor.tenant_name}</div>
                <div className="text-xs text-muted-foreground">{collectFor.building_name} · {collectFor.unit_number}</div>
                <div className="mt-1 text-xs">
                  {ar ? "الرصيد: " : "Outstanding: "}
                  <span className="font-bold text-burgundy">{format(collectFor.closing_balance)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{ar ? "المبلغ" : "Amount"}</Label>
                  <Input type="number" inputMode="decimal" step="0.001" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{ar ? "طريقة الدفع" : "Method"}</Label>
                  <Select value={collectMethod} onValueChange={(v: any) => setCollectMethod(v)}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{ar ? "نقدًا" : "Cash"}</SelectItem>
                      <SelectItem value="transfer">{ar ? "تحويل" : "Transfer"}</SelectItem>
                      <SelectItem value="cheque">{ar ? "شيك" : "Cheque"}</SelectItem>
                      <SelectItem value="card">{ar ? "بطاقة" : "Card"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCollectFor(null)} className="rounded-xl">{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submitCollect} disabled={saving} className="rounded-xl bg-gold text-primary-foreground hover:bg-gold/90">
              {ar ? "تأكيد" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Write-off dialog */}
      <Dialog open={!!writeOffFor} onOpenChange={(o) => !o && setWriteOffFor(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{ar ? "شطب رصيد" : "Write off balance"}</DialogTitle>
          </DialogHeader>
          {writeOffFor && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-sm">
                <div className="font-semibold">{writeOffFor.tenant_name}</div>
                <div className="text-xs text-muted-foreground">{writeOffFor.building_name} · {writeOffFor.unit_number}</div>
                <div className="mt-1 text-xs">
                  {ar ? "المبلغ المطلوب شطبه: " : "Amount to write off: "}
                  <span className="font-bold text-burgundy">{format(writeOffFor.closing_balance)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{ar ? "سبب الشطب (إلزامي)" : "Reason (required)"}</Label>
                <Textarea
                  rows={3}
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  placeholder={ar ? "مثال: تنازل ودّي، تسوية قضائية…" : "e.g. amicable waiver, settled out of court…"}
                  className="rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setWriteOffFor(null)} className="rounded-xl">{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submitWriteOff} disabled={saving} className="rounded-xl bg-burgundy text-primary-foreground hover:bg-burgundy/90">
              {ar ? "تأكيد الشطب" : "Confirm write-off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
