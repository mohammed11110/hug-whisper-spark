import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAppSettings, formatReceipt } from "@/lib/appSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildReceiptHTML, downloadHTMLAsPDF } from "@/lib/pdfDocs";
import { logActivity } from "@/lib/activityLogger";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { z } from "zod";

interface UnitOpt {
  id: string;
  unit_number: string;
  building_id: string;
  building_name: string;
  rent_amount: number;
  rent_type?: string;
  tenant_name: string | null;
  arrears_note?: string | null;
  anchor_day?: number;
  rent_timing?: "advance" | "arrears";
  contract_start_date?: string | null;
  opening_balance?: number;
  opening_balance_date?: string | null;
}

interface UnpaidEntry {
  year: number;
  month: number;
  remaining: number;
  periodStartIso: string;
  periodEndIso: string;
  label: string;
  isPrior: boolean;
}

interface BuildingOpt { id: string; name: string; }


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  presetUnitId?: string;
}

const PAYMENT_METHODS = ["cash", "transfer", "cheque", "card"] as const;

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthRange(year: number, month1to12: number) {
  const y = year, m = month1to12 - 1;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function yearOptions() {
  const cur = new Date().getFullYear();
  const out: number[] = [];
  for (let y = cur + 2; y >= 2020; y--) out.push(y);
  return out;
}

const schema = z.object({
  unit_id: z.string().uuid({ message: "Select a unit" }),
  amount: z.number().positive().max(10_000_000),
  payment_date: z.string().min(1),
  receipt_number: z.string().trim().max(50).optional().or(z.literal("")),
});

export function AddPaymentDialog({ open, onOpenChange, onSaved, presetUnitId }: Props) {
  const t2 = useT2();
  const { lang } = useI18n();
  const { format } = useCurrency();
  const { settings, bumpReceiptNumber } = useAppSettings();
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [buildings, setBuildings] = useState<BuildingOpt[]>([]);
  const [buildingId, setBuildingId] = useState<string>("");
  const [unitId, setUnitId] = useState(presetUnitId || "");
  const [expected, setExpected] = useState("");


  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");
  const [periodYear, setPeriodYear] = useState<number>(() => new Date().getFullYear());
  const [periodMonthNum, setPeriodMonthNum] = useState<number>(() => new Date().getMonth() + 1);
  const [saving, setSaving] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const guard = useUnsavedGuard({ open, onOpenChange });
  const [unpaidMonths, setUnpaidMonths] = useState<UnpaidEntry[]>([]);
  const [arrearsBefore, setArrearsBefore] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<UnpaidEntry | null>(null);
  const [arrearsPromptOpen, setArrearsPromptOpen] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState<any>(null);
  const [collectPriorArrears, setCollectPriorArrears] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [allPaid, setAllPaid] = useState(false);
  const [activeRent, setActiveRent] = useState<number>(0);
  const [showArrearsList, setShowArrearsList] = useState(false);
  const [paidMonthsKeys, setPaidMonthsKeys] = useState<Set<string>>(new Set());

  const { start: periodStart, end: periodEnd } = monthRange(periodYear, periodMonthNum);
  const monthNames = lang === "ar" ? AR_MONTHS : EN_MONTHS;

  // Anchor-aware cycle for the currently selected unit/month.
  const selectedUnit = units.find((x) => x.id === unitId);
  const anchorDay = selectedUnit?.anchor_day || 1;
  const timing = selectedUnit?.rent_timing || "advance";
  const cycleStart = new Date(periodYear, periodMonthNum - 1, anchorDay);
  const cycleEnd = anchorDay === 1
    ? new Date(periodYear, periodMonthNum, 0)
    : new Date(periodYear, periodMonthNum, anchorDay - 1);
  const cycleStartIso = `${cycleStart.getFullYear()}-${String(cycleStart.getMonth() + 1).padStart(2, "0")}-${String(cycleStart.getDate()).padStart(2, "0")}`;
  const cycleEndIso = `${cycleEnd.getFullYear()}-${String(cycleEnd.getMonth() + 1).padStart(2, "0")}-${String(cycleEnd.getDate()).padStart(2, "0")}`;
  const cyclePeriodLabel = (() => {
    if (anchorDay === 1) return `${monthNames[periodMonthNum - 1]} ${periodYear}`;
    const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    return lang === "ar"
      ? `${fmt(cycleStart)} → ${fmt(cycleEnd)}`
      : `${fmt(cycleStart)} – ${fmt(cycleEnd)}`;
  })();


  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: us } = await supabase.from("units").select("id, unit_number, tenant_name, rent_amount, rent_type, rent_timing, building_id, contract_start_date, opening_balance, opening_balance_date").order("unit_number");
      const ids = Array.from(new Set((us || []).map((u: any) => u.building_id)));
      const { data: bs } = ids.length
        ? await supabase.from("buildings").select("id, name, name_en").in("id", ids)
        : { data: [] as any[] };
      const bMap = new Map((bs || []).map((b: any) => [b.id, b]));
      const unitIds = (us || []).map((u: any) => u.id);
      const { data: pays } = unitIds.length
        ? await supabase.from("payments")
            .select("unit_id, amount, deleted_at, payment_date, period_start, period_end")
            .in("unit_id", unitIds)
            .is("deleted_at", null)
        : { data: [] as any[] };
      // مصدر الحقيقة الوحيد للمتأخرات
      const { getUnitArrears } = await import("@/lib/balance");
      const outstandingMap = new Map<string, number>();
      (us || []).forEach((u: any) => {
        if (!u.tenant_name) return;
        const { totalShortfall } = getUnitArrears(u as any, (pays || []) as any, new Date(), lang as "ar" | "en");
        if (totalShortfall > 0.009) outstandingMap.set(u.id, totalShortfall);
      });
      const fmtAmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar" : "en", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
      const opts: UnitOpt[] = (us || [])
        .filter((u: any) => !!u.tenant_name || u.id === presetUnitId)
        .map((u: any) => {
          const activeOut = outstandingMap.get(u.id) || 0;
          const note = activeOut > 0
            ? (lang === "ar" ? `متأخرات: ${fmtAmt(activeOut)}` : `Arrears: ${fmtAmt(activeOut)}`)
            : null;
          const anchorSrc = u.opening_balance_date || u.contract_start_date;
          const anchorDay = anchorSrc ? Math.min(28, Math.max(1, new Date(anchorSrc).getDate() || 1)) : 1;
          return {
            id: u.id,
            unit_number: u.unit_number,
            building_id: u.building_id,
            tenant_name: u.tenant_name,
            rent_amount: Number(u.rent_amount),
            rent_type: u.rent_type || "monthly",
            building_name: bMap.get(u.building_id)?.name || bMap.get(u.building_id)?.name_en || "—",
            arrears_note: note,
            anchor_day: anchorDay,
            rent_timing: (u.rent_timing === "arrears" ? "arrears" : "advance") as "advance" | "arrears",
            contract_start_date: u.contract_start_date,
            opening_balance: Number(u.opening_balance) || 0,
            opening_balance_date: u.opening_balance_date,
          };
        });
      setUnits(opts);
      // Build buildings list from units the user can see (deduped)
      const bSeen = new Set<string>();
      const bList: BuildingOpt[] = [];
      opts.forEach((o) => {
        if (bSeen.has(o.building_id)) return;
        bSeen.add(o.building_id);
        bList.push({ id: o.building_id, name: o.building_name });
      });
      bList.sort((a, b) => a.name.localeCompare(b.name));
      setBuildings(bList);
      if (presetUnitId) {
        setUnitId(presetUnitId);
        const u = opts.find((x) => x.id === presetUnitId);
        if (u) {
          setBuildingId(u.building_id);
          setExpected(String(u.rent_amount));
          if (!amount) setAmount(String(u.rent_amount));
        }
      } else {
        setBuildingId("");
        setUnitId("");
      }
      if (!receipt) setReceipt(formatReceipt(settings.receipt));
      const today = new Date();
      setPeriodYear(today.getFullYear());
      setPeriodMonthNum(today.getMonth() + 1);
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetUnitId]);

  // Unified arrears for the selected unit — single source of truth via getUnitArrears.
  useEffect(() => {
    if (!open || !unitId) {
      setUnpaidMonths([]); setAllPaid(false); setPaidMonthsKeys(new Set());
      setArrearsBefore(0); setSelectedEntry(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase
        .from("units")
        .select("id, rent_amount, rent_type, rent_timing, contract_start_date, opening_balance, opening_balance_date")
        .eq("id", unitId)
        .maybeSingle();
      const { data: ps } = await supabase
        .from("payments")
        .select("unit_id, amount, deleted_at, payment_date, period_start, period_end")
        .eq("unit_id", unitId)
        .is("deleted_at", null);
      if (cancelled || !u) return;

      const { getUnitArrears } = await import("@/lib/balance");
      const arr = getUnitArrears(u as any, (ps || []) as any, new Date(), lang as "ar" | "en");
      const rentAmt = Number((u as any).rent_amount) || 0;
      if (cancelled) return;

      setActiveRent(rentAmt);
      setArrearsBefore(arr.totalShortfall);

      const priorLabel = lang === "ar" ? "متأخرات سابقة" : "Prior arrears";
      const entries: UnpaidEntry[] = arr.cycles
        .filter((c) => c.shortfall > 0.009)
        .map((c) => ({
          year: c.periodStart.getFullYear(),
          month: c.periodStart.getMonth() + 1,
          remaining: c.shortfall,
          periodStartIso: c.periodStartIso,
          periodEndIso: c.periodEndIso,
          label: c.label,
          isPrior: c.label === priorLabel,
        }));

      // Set of fully-paid month keys for "show all" fallback dropdown filtering.
      const fullyPaid = new Set<string>();
      arr.cycles.forEach((c) => {
        if (c.status === "paid" && c.label !== priorLabel) {
          fullyPaid.add(
            `${c.periodStart.getFullYear()}-${String(c.periodStart.getMonth() + 1).padStart(2, "0")}`,
          );
        }
      });
      setPaidMonthsKeys(fullyPaid);

      setUnpaidMonths(entries);
      setAllPaid(entries.length === 0);
      // Auto-select the oldest unpaid entry and prefill amount/expected.
      const first = entries[0];
      if (first) {
        setSelectedEntry(first);
        setPeriodYear(first.year);
        setPeriodMonthNum(first.month);
        if (rentAmt > 0) setExpected(String(first.isPrior ? first.remaining : rentAmt));
        setAmount(String(first.remaining));
      } else {
        setSelectedEntry(null);
      }
    })();
    return () => { cancelled = true; };
  }, [open, unitId, lang]);

  const onPickUnit = (id: string) => {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u) { setAmount(String(u.rent_amount)); setExpected(String(u.rent_amount)); }
  };


  const remaining = Math.max(0, (Number(expected) || 0) - (Number(amount) || 0));
  const isPartial = Number(amount) > 0 && Number(expected) > 0 && Number(amount) < Number(expected);

  // Selected period (ISO) — prefer the cycle the user picked from the arrears
  // dropdown so partial payments are linked to the exact cycle the badge shows.
  const submitPeriodStartIso = selectedEntry?.periodStartIso || cycleStartIso;
  const submitPeriodEndIso = selectedEntry?.periodEndIso || cycleEndIso;

  // Other outstanding cycles besides the one this payment is for.
  const priorArrears = unpaidMonths.filter(
    (m) => m.periodStartIso !== submitPeriodStartIso,
  );
  const priorArrearsTotal = priorArrears.reduce((s, m) => s + m.remaining, 0);
  const grandCollected = Number(amount || 0) + (collectPriorArrears ? priorArrearsTotal : 0);

  // Total arrears up to and including the selected cycle (pre-payment).
  const arrearsUpToSelected = unpaidMonths.filter(
    (m) => m.periodStartIso <= submitPeriodStartIso,
  );
  const arrearsUpToTotal = arrearsUpToSelected.reduce((s, m) => s + m.remaining, 0);
  const selectedMonthLabel = selectedEntry?.label || `${monthNames[periodMonthNum - 1]} ${periodYear}`;

  // Detect "final installment of a partially-paid cycle".
  const currentMonthEntry = unpaidMonths.find((m) => m.periodStartIso === submitPeriodStartIso);
  const hasPriorPartial = !!currentMonthEntry && activeRent > 0 && !currentMonthEntry.isPrior && currentMonthEntry.remaining + 0.01 < activeRent;
  const settlesMonth = !!currentMonthEntry && Number(amount) + 0.01 >= currentMonthEntry.remaining;
  const isFinalSettlement = hasPriorPartial && settlesMonth;
  const settlementNote = isFinalSettlement
    ? (lang === "ar"
        ? `تم سداد الجزء الأخير من المبلغ المتبقي عن ${selectedMonthLabel}.`
        : `Final installment of the outstanding balance for ${selectedMonthLabel} has been settled.`)
    : null;

  const submit = async () => {
    const parsed = schema.safeParse({
      unit_id: unitId,
      amount: Number(amount),
      payment_date: date,
      receipt_number: receipt.trim(),
    });
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0].message);
    }
    setSaving(true);
    const { data: activeT } = await supabase.from("tenancies").select("id").eq("unit_id", unitId).eq("status", "active").maybeSingle();
    const mergedNotes = [settlementNote, notes.trim()].filter(Boolean).join(" — ") || null;
    const sharedReceipt = receipt.trim() || null;
    const rows: any[] = [{
      unit_id: unitId,
      tenancy_id: (activeT as any)?.id || null,
      amount: Number(amount),
      expected_amount: Number(expected) || null,
      payment_date: date,
      receipt_number: sharedReceipt,
      payment_method: method,
      notes: mergedNotes,
      period_start: cycleStartIso || null,
      period_end: cycleEndIso || null,

    }];
    if (collectPriorArrears && priorArrears.length > 0) {
      for (const m of priorArrears) {
        const ps = anchorDay === 1
          ? monthRange(m.year, m.month).start
          : `${m.year}-${String(m.month).padStart(2, "0")}-${String(anchorDay).padStart(2, "0")}`;
        const peDate = anchorDay === 1
          ? new Date(m.year, m.month, 0)
          : new Date(m.year, m.month, anchorDay - 1);
        const pe = `${peDate.getFullYear()}-${String(peDate.getMonth() + 1).padStart(2, "0")}-${String(peDate.getDate()).padStart(2, "0")}`;
        rows.push({
          unit_id: unitId,
          tenancy_id: (activeT as any)?.id || null,
          amount: m.remaining,
          expected_amount: activeRent || null,
          payment_date: date,
          receipt_number: sharedReceipt,
          payment_method: method,
          notes: (lang === "ar" ? "تحصيل متأخرات" : "Arrears collection") + ` — ${monthNames[m.month - 1]} ${m.year}`,
          period_start: ps,
          period_end: pe,
        });
      }
    }
    const { error } = await supabase.from("payments").insert(rows);
    if (!error) {
      const newStatus = isPartial && !collectPriorArrears ? "soon" : "paid";
      // Advance the unit anchor (opening_balance_date) to the day AFTER the
      // latest covered period among the just-inserted rows. This keeps the
      // "next due cycle" accurate without requiring the user to edit the unit.
      const ends = rows.map((r) => r.period_end).filter(Boolean) as string[];
      const latestEnd = ends.length ? ends.slice().sort().pop()! : null;
      const upd: any = { last_paid_date: date, status: newStatus };
      if (latestEnd) {
        const [ly, lm, ld] = latestEnd.split("-").map(Number);
        const nd = new Date(ly, (lm || 1) - 1, (ld || 1) + 1);
        upd.opening_balance_date = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-${String(nd.getDate()).padStart(2, "0")}`;
        upd.opening_balance = 0;
      }
      await supabase.from("units").update(upd).eq("id", unitId);
    }

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    const _u = units.find((x) => x.id === unitId);
    const _tenant = _u?.tenant_name || "";
    const _unitNum = _u?.unit_number || "";
    const _bldg = _u?.building_name || "";
    await logActivity({
      entityType: "payment",
      action: "paid",
      entityId: unitId,
      buildingId: (_u as any)?.building_id || null,
      entityLabel: `${_bldg} - ${_unitNum}`,
      descriptionAr: `تم تحصيل ${Number(amount).toLocaleString()} من ${_tenant || "مستأجر"} — وحدة ${_unitNum}${isPartial ? " (دفعة جزئية)" : ""}`,
      descriptionEn: `Collected ${Number(amount).toLocaleString()} from ${_tenant || "tenant"} — unit ${_unitNum}${isPartial ? " (partial)" : ""}`,
      changes: { amount: Number(amount), expected: Number(expected) || null, partial: isPartial },
    });
    bumpReceiptNumber();
    // Prepare receipt args; ask user whether to include arrears if any remain
    try {
      const u = units.find((x) => x.id === unitId);
      const monthLabel = anchorDay === 1
        ? `${(lang === "ar" ? AR_MONTHS : EN_MONTHS)[periodMonthNum - 1]} ${periodYear}`
        : (lang === "ar"
            ? `إيجار الفترة من ${cycleStart.getDate()}/${cycleStart.getMonth() + 1}/${cycleStart.getFullYear()} إلى ${cycleEnd.getDate()}/${cycleEnd.getMonth() + 1}/${cycleEnd.getFullYear()}`
            : `Rent ${cycleStart.getDate()}/${cycleStart.getMonth() + 1}/${cycleStart.getFullYear()} – ${cycleEnd.getDate()}/${cycleEnd.getMonth() + 1}/${cycleEnd.getFullYear()}`);
      const upTo = unpaidMonths
        .filter((m) => m.year < periodYear || (m.year === periodYear && m.month <= periodMonthNum))
        .map((m) => {
          const isCurrent = m.year === periodYear && m.month === periodMonthNum;
          const isPriorPaidNow = collectPriorArrears && !isCurrent;
          const remaining = isCurrent
            ? Math.max(0, m.remaining - Number(amount))
            : (isPriorPaidNow ? 0 : m.remaining);
          return {
            label: `${(lang === "ar" ? AR_MONTHS : EN_MONTHS)[m.month - 1]} ${m.year}`,
            remaining,
          };
        })
        .filter((m) => m.remaining > 0.009);
      const unpaidTotal = upTo.reduce((s, m) => s + m.remaining, 0);
      const collectedArrearsList = collectPriorArrears
        ? priorArrears.map((m) => ({
            label: `${(lang === "ar" ? AR_MONTHS : EN_MONTHS)[m.month - 1]} ${m.year}`,
            amount: m.remaining,
          }))
        : [];
      const grandTotal = Number(amount) + collectedArrearsList.reduce((s, a) => s + a.amount, 0);
      const baseArgs = {
        brand: settings.brand,
        receiptNumber: receipt.trim() || formatReceipt(settings.receipt),
        paymentDate: date,
        amount: collectedArrearsList.length ? grandTotal : Number(amount),
        expectedAmount: Number(expected) || null,
        method: methodLabel(method, lang),
        periodLabel: monthLabel,
        building: u?.building_name || "—",
        unitNumber: u?.unit_number || "—",
        tenantName: u?.tenant_name || "—",
        notes: mergedNotes,
        currency: format(0).replace(/[\d.,\s]/g, "").trim() || "",
        lang: (lang === "ar" ? "ar" : "en") as "ar" | "en",
        settlementNote,
        collectedArrears: collectedArrearsList,
        grandTotal: collectedArrearsList.length ? grandTotal : null,
      };
      const filename = `receipt-${(receipt.trim() || formatReceipt(settings.receipt))}.pdf`;
      const payload = { baseArgs, upTo, unpaidTotal, monthLabel, filename };
      if (upTo.length > 0) {
        // Defer: ask the user before generating the receipt
        setPendingReceipt(payload);
        setArrearsPromptOpen(true);
        return;
      }
      await emitReceipt(payload, false);
    } catch (e: any) {
      console.warn("receipt PDF failed", e);
    }
    finishAndClose();
  };

  const emitReceipt = async (payload: any, includeArrears: boolean) => {
    try {
      const html = buildReceiptHTML({
        ...payload.baseArgs,
        unpaidMonths: includeArrears ? payload.upTo : [],
        unpaidTotal: includeArrears ? payload.unpaidTotal : 0,
        unpaidUpToLabel: includeArrears ? payload.monthLabel : undefined,
      });
      await downloadHTMLAsPDF(html, payload.filename, settings);
    } catch (e: any) {
      console.warn("receipt PDF failed", e);
    }
  };

  const finishAndClose = () => {
    setAmount(""); setReceipt(""); setNotes(""); setCollectPriorArrears(false); if (!presetUnitId) setUnitId("");
    guard.markSaved();
    onOpenChange(false);
    onSaved?.();
  };

  const handleArrearsChoice = async (include: boolean) => {
    const payload = pendingReceipt;
    setArrearsPromptOpen(false);
    if (payload) await emitReceipt(payload, include);
    setPendingReceipt(null);
    finishAndClose();
  };

  const years = yearOptions();

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600">{t2("register_payment")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3" {...guard.formProps}>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{lang === "ar" ? "المبنى" : "Building"}</Label>
            <Select
              value={buildingId}
              onValueChange={(v) => {
                setBuildingId(v);
                setUnitId("");
                setExpected("");
                setAmount("");
              }}
              disabled={!!presetUnitId}
            >
              <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11 disabled:opacity-50">
                <SelectValue placeholder={lang === "ar" ? "اختر المبنى" : "Select building"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{lang === "ar" ? "الوحدة" : "Unit"}</Label>
            {(() => {
              const filtered = buildingId
                ? units.filter((u) => u.building_id === buildingId && !!u.tenant_name)
                : [];
              const selected = units.find((u) => u.id === unitId);
              const label = selected
                ? `${selected.unit_number}${selected.tenant_name ? ` — ${selected.tenant_name}` : ""}`
                : (buildingId ? (lang === "ar" ? "اختر الوحدة" : "Select unit") : (lang === "ar" ? "اختر المبنى أولاً" : "Select a building first"));
              return (
                <Popover open={unitOpen} onOpenChange={setUnitOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!!presetUnitId || !buildingId}
                      className="flex h-11 w-full items-center justify-between rounded-xl border border-sage-200 bg-card px-3 text-sm disabled:opacity-50"
                    >
                      <span className={selected ? "" : "text-muted-foreground"}>{label}</span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command
                      filter={(value, search) =>
                        value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                      }
                    >
                      <CommandInput placeholder={lang === "ar" ? "ابحث..." : "Search..."} />
                      <CommandList>
                        <CommandEmpty>{lang === "ar" ? "لا توجد وحدات مؤجَّرة" : "No occupied units"}</CommandEmpty>
                        <CommandGroup>
                          {filtered.map((u) => {
                            const text = `${u.unit_number} ${u.tenant_name || ""}`;
                            return (
                              <CommandItem
                                key={u.id}
                                value={text}
                                onSelect={() => { onPickUnit(u.id); setUnitOpen(false); }}
                              >
                                <Check className={`me-2 h-4 w-4 ${unitId === u.id ? "opacity-100" : "opacity-0"}`} />
                                {u.unit_number}{u.tenant_name ? ` — ${u.tenant_name}` : ""}{u.arrears_note ? ` · ${u.arrears_note}` : ""}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>

                    </Command>
                  </PopoverContent>
                </Popover>
              );
            })()}
          </div>
          {/* Prominent arrears alert — visible immediately after unit selection */}
          {unitId && unpaidMonths.length > 0 && (
            <div className="rounded-2xl border-2 border-burgundy/40 bg-burgundy/10 px-4 py-3.5 shadow-[0_4px_16px_-8px_rgba(168,93,93,0.3)]">
              <div className="flex items-start gap-2.5">
                <span className="text-burgundy text-lg leading-none mt-0.5">⚠</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-extrabold text-burgundy uppercase tracking-wide">
                    {lang === "ar" ? "هذه الوحدة عليها متأخرات" : "This unit has outstanding arrears"}
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-extrabold text-burgundy tabular-nums">
                      {format(arrearsBefore)}
                    </span>
                    <span className="text-[11px] text-burgundy/80 font-semibold whitespace-nowrap">
                      {lang === "ar"
                        ? `${unpaidMonths.length} ${unpaidMonths.length === 1 ? "سطر غير مسدد" : "أسطر غير مسددة"}`
                        : `${unpaidMonths.length} unpaid ${unpaidMonths.length === 1 ? "item" : "items"}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowArrearsList((s) => !s)}
                    className="mt-2 text-[11px] font-bold text-burgundy/90 hover:text-burgundy underline underline-offset-2"
                  >
                    {showArrearsList
                      ? (lang === "ar" ? "إخفاء التفاصيل ▴" : "Hide details ▴")
                      : (lang === "ar" ? "عرض التفاصيل ▾" : "Show details ▾")}
                  </button>
                  {showArrearsList && (
                    <div className="mt-2 divide-y divide-burgundy/15 border-t border-burgundy/20 pt-1">
                      {unpaidMonths.map((m) => (
                        <div key={m.periodStartIso + (m.isPrior ? "-prior" : "")} className="flex items-center justify-between py-1.5 text-xs">
                          <span className="text-burgundy/85 font-semibold">{m.label}</span>
                          <span className="text-burgundy font-extrabold tabular-nums">{format(m.remaining)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Rent month — unpaid only by default */}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-sage-500">{t2("rent_month")}</Label>
              {unitId && unpaidMonths.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllMonths((s) => !s)}
                  className="text-[11px] text-sage-500 hover:text-sage-600 font-semibold"
                >
                  {showAllMonths
                    ? (lang === "ar" ? "غير المدفوعة فقط" : "Unpaid only")
                    : (lang === "ar" ? "عرض كل الأشهر" : "Show all months")}
                </button>
              )}
            </div>
            {unitId && allPaid && !showAllMonths ? (
              <div className="rounded-xl border border-dashed border-sage-200 bg-sage-100/40 px-3 py-3 text-xs text-sage-600 flex items-center justify-between">
                <span className="font-semibold">{lang === "ar" ? "كل الأشهر مدفوعة ✓" : "All months paid ✓"}</span>
                <button type="button" onClick={() => setShowAllMonths(true)} className="font-bold text-sage-500 hover:underline">
                  {lang === "ar" ? "اختيار شهر آخر" : "Pick another month"}
                </button>
              </div>
            ) : unitId && !showAllMonths && unpaidMonths.length > 0 ? (
              <Select
                value={selectedEntry?.periodStartIso || ""}
                onValueChange={(v) => {
                  const entry = unpaidMonths.find((u) => u.periodStartIso === v);
                  if (!entry) return;
                  setSelectedEntry(entry);
                  setPeriodYear(entry.year);
                  setPeriodMonthNum(entry.month);
                  if (activeRent > 0) setExpected(String(entry.isPrior ? entry.remaining : activeRent));
                  setAmount(String(entry.remaining));
                }}
              >
                <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {unpaidMonths.map((u) => (
                    <SelectItem key={u.periodStartIso + (u.isPrior ? "-prior" : "")} value={u.periodStartIso}>
                      {u.label} · {format(u.remaining)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              (() => {
                const allMonthsForYear = monthNames.map((n, i) => ({ n, m: i + 1 }));
                const paidInYear = allMonthsForYear.filter(({ m }) =>
                  paidMonthsKeys.has(`${periodYear}-${String(m).padStart(2, "0")}`)
                );
                const visible = showAllMonths
                  ? allMonthsForYear
                  : allMonthsForYear.filter(({ m }) => !paidMonthsKeys.has(`${periodYear}-${String(m).padStart(2, "0")}`));
                const selectedKey = `${periodYear}-${String(periodMonthNum).padStart(2, "0")}`;
                const selectedIsPaid = paidMonthsKeys.has(selectedKey);
                // Auto-shift selection off a paid month when not showing all
                if (!showAllMonths && selectedIsPaid && visible.length > 0) {
                  const todayM = new Date().getMonth() + 1;
                  const next = visible.find((x) => x.m === todayM) || visible[0];
                  setTimeout(() => setPeriodMonthNum(next.m), 0);
                }
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={String(periodMonthNum)} onValueChange={(v) => setPeriodMonthNum(Number(v))}>
                        <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {visible.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-sage-500">
                              {lang === "ar" ? "جميع أشهر هذه السنة مُسدَّدة" : "All months of this year are paid"}
                            </div>
                          ) : visible.map(({ n, m }) => {
                            const isPaid = paidMonthsKeys.has(`${periodYear}-${String(m).padStart(2, "0")}`);
                            return (
                              <SelectItem key={m} value={String(m)}>
                                <span className="flex items-center gap-2">
                                  <span>{n}</span>
                                  {isPaid && (
                                    <span className="text-[10px] font-bold text-sage-500 bg-sage-100 px-1.5 py-0.5 rounded">
                                      {lang === "ar" ? "مدفوع ✓" : "Paid ✓"}
                                    </span>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Select value={String(periodYear)} onValueChange={(v) => setPeriodYear(Number(v))}>
                        <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {years.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {unitId && paidInYear.length > 0 && !showAllMonths && (
                      <button
                        type="button"
                        onClick={() => setShowAllMonths(true)}
                        className="mt-1.5 text-[11px] text-sage-500 hover:text-sage-600 font-semibold flex items-center gap-1"
                      >
                        <span>✓</span>
                        <span>
                          {lang === "ar"
                            ? `تم إخفاء ${paidInYear.length} ${paidInYear.length === 1 ? "شهر مسدَّد" : "أشهر مسدَّدة"} · إظهار الكل`
                            : `${paidInYear.length} paid ${paidInYear.length === 1 ? "month" : "months"} hidden · Show all`}
                        </span>
                      </button>
                    )}
                    {unitId && paidMonthsKeys.size === 0 && (
                      <div className="mt-1.5 text-[11px] text-sage-400">
                        {lang === "ar" ? "لا توجد دفعات سابقة لهذه الوحدة" : "No prior payments for this unit"}
                      </div>
                    )}
                    {showAllMonths && unitId && paidInYear.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllMonths(false)}
                        className="mt-1.5 text-[11px] text-sage-500 hover:text-sage-600 font-semibold"
                      >
                        {lang === "ar" ? "إخفاء الأشهر المسدَّدة" : "Hide paid months"}
                      </button>
                    )}
                  </>
                );
              })()
            )}
          </div>




          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "المتوقع" : "Expected"}</Label>
              <Input type="number" inputMode="decimal" value={expected} onChange={(e) => setExpected(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "المدفوع" : "Paid"}</Label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
            </div>
          </div>
          {isPartial && (
            <div className="bg-terracotta/10 border border-terracotta/30 rounded-xl px-3 py-2 text-xs text-terracotta font-semibold flex justify-between">
              <span>{lang === "ar" ? "متبقي" : "Remaining"}</span>
              <span>{format(remaining)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("payment_date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "الطريقة" : "Method"}</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{methodLabel(m, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("receipt_number")}</Label>
            <Input value={receipt} onChange={(e) => setReceipt(e.target.value)} maxLength={50} className="rounded-xl border-sage-200 bg-card h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl border-sage-200 bg-card" />
          </div>
          {unitId && priorArrears.length > 0 && (
            <label className="flex items-start gap-2 rounded-xl border border-terracotta/30 bg-terracotta/5 px-3 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={collectPriorArrears}
                onChange={(e) => setCollectPriorArrears(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-sage-300 accent-[hsl(var(--primary))]"
              />
              <span className="text-xs font-semibold flex-1">
                <span className="text-terracotta">
                  {lang === "ar"
                    ? `تحصيل المتأخرات السابقة مع هذه الدفعة (${priorArrears.length} ${priorArrears.length === 1 ? "شهر" : "أشهر"} · ${format(priorArrearsTotal)})`
                    : `Collect prior arrears with this payment (${priorArrears.length} months · ${format(priorArrearsTotal)})`}
                </span>
                {collectPriorArrears && (
                  <span className="block text-sage-600 mt-1">
                    {lang === "ar" ? "الإجمالي المحصَّل" : "Total to collect"}: <b>{format(grandCollected)}</b>
                  </span>
                )}
              </span>
            </label>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button data-guard-ignore variant="outline" onClick={() => guard.handleOpenChange(false)} className="rounded-xl">{t2("cancel")}</Button>
          <Button data-guard-ignore onClick={submit} disabled={saving} className="rounded-xl bg-gradient-sage text-primary-foreground">{t2("save")}</Button>
        </DialogFooter>
        {guard.ConfirmDiscardUI}
      </DialogContent>
      <AlertDialog open={arrearsPromptOpen} onOpenChange={setArrearsPromptOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sage-700">
              {lang === "ar" ? "إظهار المتأخرات في الإيصال؟" : "Show arrears on the receipt?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sage-600">
              {pendingReceipt && (lang === "ar"
                ? `هذا المستأجر عليه متأخرات بقيمة ${format(pendingReceipt.unpaidTotal)}. هل ترغب بإدراجها في الإيصال المطبوع؟`
                : `This tenant has outstanding arrears of ${format(pendingReceipt.unpaidTotal)}. Include them in the printed receipt?`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={() => handleArrearsChoice(false)}
              className="rounded-xl"
            >
              {lang === "ar" ? "بدون متأخرات" : "Without arrears"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleArrearsChoice(true)}
              className="rounded-xl bg-gradient-sage text-primary-foreground"
            >
              {lang === "ar" ? "نعم، أدرجها" : "Yes, include"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function methodLabel(m: string, lang: string) {
  const ar: Record<string, string> = { cash: "نقدي", transfer: "تحويل", cheque: "شيك", card: "بطاقة" };
  const en: Record<string, string> = { cash: "Cash", transfer: "Transfer", cheque: "Cheque", card: "Card" };
  return (lang === "ar" ? ar : en)[m] || m;
}
