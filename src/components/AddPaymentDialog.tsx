import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { FieldHelp } from "@/components/ui/FieldHelp";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAppSettings, formatReceipt } from "@/lib/appSettings";
import { computeReceiptNumber, allocateReceiptNumbers, type CyclePaymentRef } from "@/lib/receiptNumbering";
import type { ReceiptNumbering } from "@/lib/appSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildReceiptHTML, downloadHTMLAsPDF } from "@/lib/pdfDocs";
import { openWhatsApp, fillTemplate } from "@/lib/whatsapp";
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
  tenant_phone?: string | null;

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
  const { settings, update, refreshReceiptCounter, receiptCounterReady } = useAppSettings();
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
  const [allPaid, setAllPaid] = useState(false);
  const [activeRent, setActiveRent] = useState<number>(0);
  
  // Smart payment modes: "auto" (distribute amount oldest→newest, spill into advance)
  // or "manual" (pick a specific cycle from the dropdown).
  const [payMode, setPayMode] = useState<"auto" | "manual">("auto");
  const [distribution, setDistribution] = useState<import("@/lib/balance").PaymentDistribution | null>(null);
  const [cachedArrears, setCachedArrears] = useState<import("@/lib/balance").UnitArrears | null>(null);
  const [cachedUnit, setCachedUnit] = useState<any>(null);
  // Whether to print the arrears table inside the PDF receipt. Default: off
  // (privacy-friendly). User opts in via switch before saving.
  const [includeArrearsInReceipt, setIncludeArrearsInReceipt] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");


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
      // Wait for the server counter before doing anything — guarantees the
      // suggested receipt number is identical on every device.
      await refreshReceiptCounter();

      const { data: us } = await supabase.from("units").select("id, unit_number, tenant_name, tenant_phone, rent_amount, rent_type, rent_timing, building_id, contract_start_date, opening_balance, opening_balance_date").order("unit_number");
      const ids = Array.from(new Set((us || []).map((u: any) => u.building_id)));
      const { data: bs } = ids.length
        ? await supabase.from("buildings").select("id, name, name_en").in("id", ids)
        : { data: [] as any[] };
      const bMap = new Map((bs || []).map((b: any) => [b.id, b]));
      const unitIds = (us || []).map((u: any) => u.id);
      const { data: pays } = unitIds.length
        ? await supabase.from("payments")
            .select("unit_id, amount, deleted_at, payment_date, period_start, period_end, tenancy_id, kind")
            .in("unit_id", unitIds)
            .is("deleted_at", null)
        : { data: [] as any[] };
      // Active-lease map — outstanding shown next to each unit must be the
      // current tenant's balance only, not an inherited one from an old lease.
      const { data: activeTs } = unitIds.length
        ? await supabase.from("tenancies").select("id, unit_id").in("unit_id", unitIds).eq("status", "active")
        : { data: [] as any[] };
      const activeMap = new Map<string, string>((activeTs || []).map((t: any) => [t.unit_id, t.id]));
      // مصدر الحقيقة الوحيد للمتأخرات
      const { getUnitArrears, parseLocalDate } = await import("@/lib/balance");
      const outstandingMap = new Map<string, number>();
      (us || []).forEach((u: any) => {
        if (!u.tenant_name) return;
        const { totalShortfall } = getUnitArrears(u as any, (pays || []) as any, new Date(), lang as "ar" | "en", activeMap.get(u.id) || null);
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
          const anchorParsed = parseLocalDate(anchorSrc);
          const anchorDay = anchorParsed ? Math.min(28, Math.max(1, anchorParsed.getDate() || 1)) : 1;
          return {
            id: u.id,
            unit_number: u.unit_number,
            building_id: u.building_id,
            tenant_name: u.tenant_name,
            tenant_phone: u.tenant_phone,
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
      // Receipt suggestion is filled by a separate effect that reacts to the
      // refreshed server counter — avoids using a stale snapshot here.
      setReceipt("");
      const today = new Date();
      setPeriodYear(today.getFullYear());
      setPeriodMonthNum(today.getMonth() + 1);
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetUnitId]);

  // Fill the suggested receipt number from the latest server counter.
  // Runs whenever the refreshed counter arrives, so the suggestion is the
  // same on every device (browser / iPhone / iPad). Skips when the user
  // has typed a custom value.
  useEffect(() => {
    if (!open) return;
    // Only fill once the real counter has loaded from the server.
    // Prevents stale "R-01" appearing on a new device for an old account.
    if (!receiptCounterReady) return;
    setReceipt((cur) => (cur && cur.trim().length > 0 ? cur : formatReceipt(settings.receipt)));
  }, [open, receiptCounterReady, settings.receipt.prefix, settings.receipt.padding, settings.receipt.nextNumber]);

  // Unified arrears for the selected unit — single source of truth via getUnitArrears.
  useEffect(() => {
    if (!open || !unitId) {
      setUnpaidMonths([]); setAllPaid(false);
      setArrearsBefore(0); setSelectedEntry(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase
        .from("units")
        .select("id, rent_amount, rent_type, rent_timing, contract_start_date, opening_balance, opening_balance_date, paid_up_to")
        .eq("id", unitId)
        .maybeSingle();
      const { data: ps } = await supabase
        .from("payments")
        .select("unit_id, amount, deleted_at, payment_date, period_start, period_end, tenancy_id, kind")
        .eq("unit_id", unitId)
        .is("deleted_at", null);
      const { data: activeT } = await supabase
        .from("tenancies").select("id").eq("unit_id", unitId).eq("status", "active").maybeSingle();
      if (cancelled || !u) return;

      const { getUnitArrears, getNextDueInfo } = await import("@/lib/balance");
      // Scope: only payments of the active tenancy contribute to next-due
      // calculations for the *current* tenant — old leases must not advance
      // the period.
      const activeTId: string | null = (activeT as any)?.id || null;
      const scopedPays = activeTId
        ? (ps || []).filter((p: any) => !p.tenancy_id || p.tenancy_id === activeTId)
        : (ps || []);
      const arr = getUnitArrears(u as any, scopedPays as any, new Date(), lang as "ar" | "en", activeTId);
      const rentAmt = Number((u as any).rent_amount) || 0;
      if (cancelled) return;

      setActiveRent(rentAmt);
      setArrearsBefore(arr.totalShortfall);
      setCachedArrears(arr);
      setCachedUnit(u);

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




      setUnpaidMonths(entries);
      setAllPaid(entries.length === 0);
      setPayMode("manual");
      const first = entries[0];
      if (first) {
        setSelectedEntry(first);
        setPeriodYear(first.year);
        setPeriodMonthNum(first.month);
        setExpected(String(first.isPrior ? first.remaining : (rentAmt || first.remaining)));
        setAmount(String(rentAmt || first.remaining));
      } else {
        // No arrears → derive the next-due cycle from the CONTRACT (never
        // today's date). This prevents recording, e.g., "May 2026" rent
        // when the contract starts 1/6/2026.
        const nxt = getNextDueInfo(u as any, scopedPays as any, lang as "ar" | "en");
        if (nxt) {
          setPeriodYear(nxt.periodStart.getFullYear());
          setPeriodMonthNum(nxt.periodStart.getMonth() + 1);
        }
        setSelectedEntry(null);
        if (rentAmt > 0) {
          setExpected(String(rentAmt));
          setAmount(String(rentAmt));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, unitId, lang]);



  const onPickUnit = (id: string) => {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u) { setAmount(String(u.rent_amount)); setExpected(String(u.rent_amount)); }
  };

  // Live distribution preview (auto mode only).
  useEffect(() => {
    if (payMode !== "auto" || !cachedArrears || !cachedUnit) { setDistribution(null); return; }
    const amt = Number(amount) || 0;
    if (amt <= 0) { setDistribution(null); return; }
    let cancelled = false;
    (async () => {
      const { distributePayment } = await import("@/lib/balance");
      const dist = distributePayment(cachedUnit, cachedArrears, amt, lang as "ar" | "en");
      if (!cancelled) setDistribution(dist);
    })();
    return () => { cancelled = true; };
  }, [amount, payMode, cachedArrears, cachedUnit, lang]);

  // Keep `expected` in sync with the active pay mode:
  // - auto   → إجمالي المتأخرات (مصدر الحقيقة الوحيد)
  // - manual → قيمة الدورة المختارة فقط
  useEffect(() => {
    if (!unitId) return;
    if (payMode === "auto") {
      if (arrearsBefore > 0) setExpected(String(arrearsBefore));
      else if (activeRent > 0) setExpected(String(activeRent));
    } else {
      if (selectedEntry) {
        setExpected(String(selectedEntry.isPrior ? selectedEntry.remaining : (activeRent || selectedEntry.remaining)));
      } else if (activeRent > 0) {
        setExpected(String(activeRent));
      }
    }
  }, [payMode, arrearsBefore, activeRent, selectedEntry, unitId]);






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

  // Build the args for buildReceiptHTML based on CURRENT (pre-save) state.
  // Used by both the live preview button and the save flow so the preview
  // matches the final printed receipt exactly.
  const buildReceiptArgs = () => {
    if (!unitId || !(Number(amount) > 0)) return null;
    const u = units.find((x) => x.id === unitId);
    const monthLabel = anchorDay === 1
      ? `${(lang === "ar" ? AR_MONTHS : EN_MONTHS)[periodMonthNum - 1]} ${periodYear}`
      : (lang === "ar"
          ? `إيجار الفترة من ${cycleStart.getDate()}/${cycleStart.getMonth() + 1}/${cycleStart.getFullYear()} إلى ${cycleEnd.getDate()}/${cycleEnd.getMonth() + 1}/${cycleEnd.getFullYear()}`
          : `Rent ${cycleStart.getDate()}/${cycleStart.getMonth() + 1}/${cycleStart.getFullYear()} – ${cycleEnd.getDate()}/${cycleEnd.getMonth() + 1}/${cycleEnd.getFullYear()}`);
      let collectedArrearsList: Array<{ label: string; amount: number }> = [];
      let primaryAmount = Number(amount);
      let primaryPeriodLabel = monthLabel;
      let upTo: Array<{ label: string; remaining: number }>;
      if (payMode === "auto" && distribution && distribution.allocations.length > 0) {
        const allocs = distribution.allocations;
        primaryAmount = allocs[0].amount;
        primaryPeriodLabel = allocs[0].label;
        collectedArrearsList = allocs.slice(1).map((a) => ({
          label: (a.isAdvance ? (lang === "ar" ? "دفعة مقدمة — " : "Advance — ") : "") + a.label,
          amount: a.amount,
        }));
        const arrearsCovered = allocs.filter((a) => !a.isAdvance).reduce((s, a) => s + a.amount, 0);
        const remainingArrears = Math.max(0, arrearsBefore - arrearsCovered);
        upTo = remainingArrears > 0.009
          ? [{ label: lang === "ar" ? "متأخرات متبقية" : "Remaining arrears", remaining: remainingArrears }]
          : [];
      } else {
        upTo = unpaidMonths
          .filter((m) => m.periodStartIso <= submitPeriodStartIso)
          .map((m) => {
            const isCurrent = m.periodStartIso === submitPeriodStartIso;
            const isPriorPaidNow = collectPriorArrears && !isCurrent;
            const remaining = isCurrent
              ? Math.max(0, m.remaining - Number(amount))
              : (isPriorPaidNow ? 0 : m.remaining);
            return { label: m.label, remaining };
          })
          .filter((m) => m.remaining > 0.009);
        collectedArrearsList = collectPriorArrears
          ? priorArrears.map((m) => ({ label: m.label, amount: m.remaining }))
          : [];
      }
      const unpaidTotal = upTo.reduce((s, m) => s + m.remaining, 0);
      const grandTotal = primaryAmount + collectedArrearsList.reduce((s, a) => s + a.amount, 0);
      const baseArgs = {
        brand: settings.brand,
        receiptNumber: receipt.trim() || formatReceipt(settings.receipt),
        paymentDate: date,
        amount: collectedArrearsList.length ? grandTotal : primaryAmount,
        expectedAmount: Number(expected) || null,
        method: methodLabel(method, lang),
        periodLabel: primaryPeriodLabel,
        building: u?.building_name || "—",
        unitNumber: u?.unit_number || "—",
        tenantName: u?.tenant_name || "—",
        notes: [settlementNote, notes.trim()].filter(Boolean).join(" — ") || null,
        currency: format(0).replace(/[\d.,\s]/g, "").trim() || "",
        lang: (lang === "ar" ? "ar" : "en") as "ar" | "en",
        settlementNote,
        collectedArrears: collectedArrearsList,
        grandTotal: collectedArrearsList.length ? grandTotal : null,
      };
      return { baseArgs, upTo, unpaidTotal, monthLabel: primaryPeriodLabel };
  };

  const openPreview = () => {
    const args = buildReceiptArgs();
    if (!args) {
      toast.error(lang === "ar" ? "أدخل المبلغ واختر الوحدة أولاً" : "Enter amount and select a unit first");
      return;
    }
    const html = buildReceiptHTML({
      ...args.baseArgs,
      unpaidMonths: includeArrearsInReceipt ? args.upTo : [],
      unpaidTotal: includeArrearsInReceipt ? args.unpaidTotal : 0,
      unpaidUpToLabel: includeArrearsInReceipt ? args.monthLabel : undefined,
    });
    setPreviewHtml(html);
    setPreviewOpen(true);
  };

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
    // Per-row receipt numbers are computed below from cycle context.
    const rows: any[] = [];

    if (payMode === "auto" && distribution && distribution.allocations.length > 0) {
      // Build one row per allocation cycle (single source of truth for arrears link).
      for (const a of distribution.allocations) {
        const noteParts: string[] = [];
        if (a.isAdvance) noteParts.push(lang === "ar" ? "دفعة مقدمة" : "Advance");
        else if (a.isPrior) noteParts.push(lang === "ar" ? "متأخرات سابقة" : "Prior arrears");
        else if (a.amount + 0.009 < a.expected) noteParts.push(lang === "ar" ? "دفعة جزئية" : "Partial");
        noteParts.push(a.label);
        if (notes.trim()) noteParts.push(notes.trim());
        rows.push({
          unit_id: unitId,
          tenancy_id: (activeT as any)?.id || null,
          amount: a.amount,
          expected_amount: a.expected || null,
          payment_date: date,
          receipt_number: null,
          payment_method: method,
          notes: noteParts.join(" — "),
          period_start: a.periodStartIso,
          period_end: a.periodEndIso,
        });
      }
      // If user typed more than distribution could absorb, attach the remainder
      // as an unallocated credit on the latest period (rare; only when no rent).
      if (distribution.remainder > 0.009) {
        rows.push({
          unit_id: unitId,
          tenancy_id: (activeT as any)?.id || null,
          amount: distribution.remainder,
          expected_amount: null,
          payment_date: date,
          receipt_number: null,
          payment_method: method,
          notes: (lang === "ar" ? "رصيد دائن" : "Credit balance") + (notes.trim() ? ` — ${notes.trim()}` : ""),
          period_start: null,
          period_end: null,
        });
      }
    } else {
      // Manual mode — single row tied to the chosen cycle.
      rows.push({
        unit_id: unitId,
        tenancy_id: (activeT as any)?.id || null,
        amount: Number(amount),
        expected_amount: Number(expected) || null,
        payment_date: date,
        receipt_number: null,
        payment_method: method,
        notes: mergedNotes,
        period_start: submitPeriodStartIso || null,
        period_end: submitPeriodEndIso || null,
      });
      if (collectPriorArrears && priorArrears.length > 0) {
        for (const m of priorArrears) {
          rows.push({
            unit_id: unitId,
            tenancy_id: (activeT as any)?.id || null,
            amount: m.remaining,
            expected_amount: activeRent || null,
            payment_date: date,
            receipt_number: null,
            payment_method: method,
            notes: (lang === "ar" ? "تحصيل متأخرات" : "Arrears collection") + ` — ${m.label}`,
            period_start: m.periodStartIso,
            period_end: m.periodEndIso,
          });
        }
      }
    }

    // === Assign receipt numbers per row with /1, /2, /D suffixes. ===
    // Fetch all current non-deleted payments for this unit, then derive
    // prior-in-cycle context per row (existing DB + earlier rows in this batch).
    const { data: existingForUnit } = await supabase
      .from("payments")
      .select("amount, expected_amount, receipt_number, period_start, period_end")
      .eq("unit_id", unitId)
      .is("deleted_at", null);
    const cycleKey = (s: string | null, e: string | null) => `${s || ""}|${e || ""}`;
    const priorByCycle: Record<string, CyclePaymentRef[]> = {};
    (existingForUnit || []).forEach((p: any) => {
      const k = cycleKey(p.period_start, p.period_end);
      (priorByCycle[k] ||= []).push({
        amount: Number(p.amount) || 0,
        expected_amount: p.expected_amount != null ? Number(p.expected_amount) : null,
        receipt_number: p.receipt_number || null,
      });
    });
    // Honor user override only if they typed something different from the
    // suggested next number — and only apply it to the FIRST row.
    const suggested = formatReceipt(settings.receipt);
    const typed = receipt.trim();
    const userOverride = typed && typed !== suggested && !typed.includes("/") ? typed : null;

    // ---- DRY RUN: count how many fresh numbers we need ----
    const dryPriors: Record<string, CyclePaymentRef[]> = JSON.parse(JSON.stringify(priorByCycle));
    let needed = 0;
    rows.forEach((r, idx) => {
      const k = cycleKey(r.period_start, r.period_end);
      const prior = dryPriors[k] || [];
      const res = computeReceiptNumber({
        receipt: settings.receipt,
        nextCounter: 0,
        rowAmount: Number(r.amount) || 0,
        rowExpected: r.expected_amount,
        priorInCycle: prior,
        userOverride: idx === 0 ? userOverride : null,
      });
      (dryPriors[k] ||= []).push({
        amount: Number(r.amount) || 0,
        expected_amount: r.expected_amount,
        receipt_number: res.receiptNumber,
      });
      if (res.consumesNewNumber) needed += 1;
    });

    // ---- Atomic server-side reservation (shared across devices) ----
    let receiptConfig: ReceiptNumbering = settings.receipt;
    let localCounter = settings.receipt.nextNumber || settings.receipt.startNumber || 1;
    if (needed > 0) {
      const alloc = await allocateReceiptNumbers(needed);
      if (!alloc) {
        setSaving(false);
        return toast.error(lang === "ar" ? "تعذّر حجز رقم الإيصال — حاول مرة أخرى" : "Failed to reserve receipt number — try again");
      }
      receiptConfig = { prefix: alloc.prefix, padding: alloc.padding, startNumber: alloc.startNumber, nextNumber: alloc.startNumber };
      localCounter = alloc.startNumber;
    }

    rows.forEach((r, idx) => {
      const k = cycleKey(r.period_start, r.period_end);
      const prior = priorByCycle[k] || [];
      const res = computeReceiptNumber({
        receipt: receiptConfig,
        nextCounter: localCounter,
        rowAmount: Number(r.amount) || 0,
        rowExpected: r.expected_amount,
        priorInCycle: prior,
        userOverride: idx === 0 ? userOverride : null,
      });
      r.receipt_number = res.receiptNumber;
      // Append this row into the per-cycle prior list so the NEXT row in this
      // same batch (same cycle) sees it as already-paid.
      (priorByCycle[k] ||= []).push({
        amount: Number(r.amount) || 0,
        expected_amount: r.expected_amount,
        receipt_number: res.receiptNumber,
      });
      if (res.consumesNewNumber) {
        localCounter += 1;
      }
    });

    const { error } = await supabase.from("payments").insert(rows);
    // Unit state (last_paid_date + status) is recomputed automatically by the
    // DB trigger `sync_unit_state_from_payments_trg` — no client-side recompute
    // is needed. This keeps a single source of truth and avoids races.

    setSaving(false);
    if (error) return toast.error(error.message);
    // Show before→after arrears + advance hint.
    const totalSaved = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const advanceTotal = payMode === "auto" && distribution
      ? distribution.allocations.filter((a) => a.isAdvance).reduce((s, a) => s + a.amount, 0)
      : 0;
    const arrearsCollected = totalSaved - advanceTotal;
    const arrearsAfter = Math.max(0, arrearsBefore - arrearsCollected);
    const advanceMsg = advanceTotal > 0
      ? (lang === "ar" ? `  ·  دفعة مقدمة: ${format(advanceTotal)}` : `  ·  Advance: ${format(advanceTotal)}`)
      : "";
    toast.success(
      arrearsBefore > 0 || advanceTotal > 0
        ? (lang === "ar"
            ? `تم الحفظ ✓  المتأخرات: ${format(arrearsBefore)} ← ${format(arrearsAfter)}${advanceMsg}`
            : `Saved ✓  Arrears: ${format(arrearsBefore)} → ${format(arrearsAfter)}${advanceMsg}`)
        : "✓",
    );

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
    // Server already advanced the counter atomically via allocate_receipt_numbers.
    void refreshReceiptCounter();
    // Prepare receipt args; ask user whether to include arrears if any remain
    try {
      const u = units.find((x) => x.id === unitId);
      const monthLabel = anchorDay === 1
        ? `${(lang === "ar" ? AR_MONTHS : EN_MONTHS)[periodMonthNum - 1]} ${periodYear}`
        : (lang === "ar"
            ? `إيجار الفترة من ${cycleStart.getDate()}/${cycleStart.getMonth() + 1}/${cycleStart.getFullYear()} إلى ${cycleEnd.getDate()}/${cycleEnd.getMonth() + 1}/${cycleEnd.getFullYear()}`
            : `Rent ${cycleStart.getDate()}/${cycleStart.getMonth() + 1}/${cycleStart.getFullYear()} – ${cycleEnd.getDate()}/${cycleEnd.getMonth() + 1}/${cycleEnd.getFullYear()}`);
      // Build receipt breakdown.
      let collectedArrearsList: Array<{ label: string; amount: number }> = [];
      let primaryAmount = Number(amount);
      let primaryPeriodLabel = monthLabel;

      if (payMode === "auto" && distribution && distribution.allocations.length > 0) {
        const allocs = distribution.allocations;
        primaryAmount = allocs[0].amount;
        primaryPeriodLabel = allocs[0].label;
        collectedArrearsList = allocs.slice(1).map((a) => ({
          label: (a.isAdvance ? (lang === "ar" ? "دفعة مقدمة — " : "Advance — ") : "") + a.label,
          amount: a.amount,
        }));
      } else {
        collectedArrearsList = collectPriorArrears
          ? priorArrears.map((m) => ({ label: m.label, amount: m.remaining }))
          : [];
      }

      // ====== المصدر الواحد للمتبقي ======
      // أعد القراءة من قاعدة البيانات وأعد حساب المتأخرات بنفس دالة العرض،
      // حتى يتطابق رقم الإيصال مع شارة الوحدة دائمًا بدون أي اشتقاق جانبي.
      const { data: freshUnit } = await supabase
        .from("units")
        .select("id, rent_amount, rent_type, rent_timing, contract_start_date, opening_balance, opening_balance_date, paid_up_to")
        .eq("id", unitId)
        .maybeSingle();
      const { data: freshPays } = await supabase
        .from("payments")
        .select("unit_id, amount, deleted_at, payment_date, period_start, period_end, tenancy_id, kind")
        .eq("unit_id", unitId)
        .is("deleted_at", null);
      const { getUnitArrears } = await import("@/lib/balance");
      const freshArr = freshUnit
        ? getUnitArrears(freshUnit as any, (freshPays || []) as any, new Date(), lang as "ar" | "en", (activeT as any)?.id || null)
        : null;
      const unpaidTotal = freshArr ? freshArr.totalShortfall : 0;
      const upTo: Array<{ label: string; remaining: number }> = freshArr
        ? freshArr.cycles
            .filter((c) => c.shortfall > 0.009)
            .map((c) => ({ label: c.label, remaining: c.shortfall }))
        : [];
      const grandTotal = primaryAmount + collectedArrearsList.reduce((s, a) => s + a.amount, 0);
      // Use the ACTUAL receipt number assigned to the first inserted row —
      // this is the number the server reserved atomically, so PDF + WhatsApp
      // + DB record always match across all devices.
      const actualReceiptNumber = rows[0]?.receipt_number || receipt.trim() || formatReceipt(settings.receipt);
      const baseArgs = {
        brand: settings.brand,
        receiptNumber: actualReceiptNumber,
        paymentDate: date,
        amount: collectedArrearsList.length ? grandTotal : primaryAmount,
        expectedAmount: Number(expected) || null,
        method: methodLabel(method, lang),
        periodLabel: primaryPeriodLabel,
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
      const filename = `receipt-${actualReceiptNumber}.pdf`;
      const payload = { baseArgs, upTo, unpaidTotal, monthLabel: primaryPeriodLabel, filename };


      if (upTo.length > 0) {
        await emitReceipt(payload, includeArrearsInReceipt);
        finishAndClose();
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
    // Auto-open WhatsApp with the receipt message if enabled.
    try {
      if (!settings.autoSendReceiptWhatsApp) return;
      const u = units.find((x) => x.id === unitId);
      const phone = u?.tenant_phone || "";
      if (!phone) {
        toast.message(lang === "ar" ? "لا يوجد رقم واتساب للمستأجر" : "No WhatsApp number for tenant");
        return;
      }
      const ba = payload.baseArgs;
      const remaining = Number(payload.unpaidTotal) || 0;
      const msg = fillTemplate(settings.templates.receipt, {
        tenant: ba.tenantName || "",
        unit: ba.unitNumber || "",
        building: ba.building || "",
        amount: format(Number(ba.amount) || 0),
        date: ba.paymentDate || "",
        remaining: format(remaining),
      });
      // Slight delay so the PDF download finishes/UI updates first.
      setTimeout(() => openWhatsApp(phone, msg), 300);
    } catch (e: any) {
      console.warn("whatsapp open failed", e);
    }
  };


  const finishAndClose = () => {
    setAmount(""); setReceipt(""); setNotes(""); setCollectPriorArrears(false); setIncludeArrearsInReceipt(false); if (!presetUnitId) setUnitId("");
    guard.markSaved();
    onOpenChange(false);
    // Broadcast first so every subscribed page (Tenants, UnitDetail,
    // BuildingDetail, Notifications, Reports, Payments…) refreshes instantly.
    import("@/lib/paymentsBus").then(({ paymentsBus }) => paymentsBus.emit(unitId || null));
    onSaved?.();
  };

  const handleArrearsChoice = async (include: boolean) => {
    const payload = pendingReceipt;
    setArrearsPromptOpen(false);
    if (payload) await emitReceipt(payload, include);
    setPendingReceipt(null);
    finishAndClose();
  };

  

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="rounded-2xl max-w-md md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
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
          {/* Prominent arrears alert — always visible after unit selection */}
          {unitId && unpaidMonths.length === 0 && (
            <div className="rounded-2xl border-2 border-sage-300 bg-sage-100/50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-sage-600 text-lg leading-none">✓</span>
                <span className="text-sm font-extrabold text-sage-700">
                  {lang === "ar" ? "لا توجد متأخرات على هذا المستأجر" : "No outstanding arrears for this tenant"}
                </span>
              </div>
              <span className="text-lg font-extrabold text-sage-600 tabular-nums">{format(0)}</span>
            </div>
          )}
          {unitId && unpaidMonths.length > 0 && (
            <div className="rounded-2xl border-2 border-burgundy/50 bg-burgundy/10 px-4 py-3.5 shadow-[0_4px_16px_-8px_rgba(168,93,93,0.35)]">
              <div className="flex items-start gap-2.5">
                <span className="text-burgundy text-lg leading-none mt-0.5">⚠</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-extrabold text-burgundy uppercase tracking-wide">
                    {lang === "ar" ? "إجمالي المتأخرات المستحقة" : "Total outstanding arrears"}
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-3xl font-extrabold text-burgundy tabular-nums">
                      {format(arrearsBefore)}
                    </span>
                    <span className="text-[11px] text-burgundy/80 font-semibold whitespace-nowrap">
                      {lang === "ar"
                        ? `${unpaidMonths.length} ${unpaidMonths.length === 1 ? "سطر غير مسدد" : "أسطر غير مسددة"}`
                        : `${unpaidMonths.length} unpaid ${unpaidMonths.length === 1 ? "item" : "items"}`}
                    </span>
                  </div>
                  {/* Mode toggle: auto distribution vs manual cycle pick */}
                  <div className="mt-3 inline-flex rounded-xl border border-burgundy/25 bg-card p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => { setPayMode("auto"); setAmount(String(arrearsBefore)); }}
                      className={`px-3 py-1.5 rounded-lg transition ${payMode === "auto" ? "bg-burgundy text-primary-foreground" : "text-burgundy/80 hover:text-burgundy"}`}
                    >
                      {lang === "ar" ? "توزيع تلقائي" : "Auto-distribute"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMode("manual")}
                      className={`px-3 py-1.5 rounded-lg transition ${payMode === "manual" ? "bg-burgundy text-primary-foreground" : "text-burgundy/80 hover:text-burgundy"}`}
                    >
                      {lang === "ar" ? "اختيار يدوي" : "Manual pick"}
                    </button>
                  </div>
                  {unpaidMonths.length > 0 && (
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

          {/* Rent month — manual mode only (auto mode distributes automatically) */}
          {payMode === "manual" && (


          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500 inline-flex items-center gap-1">
              {t2("rent_month")}
              <FieldHelp content={lang === "ar" ? "الشهر/الفترة التي تغطيها هذه الدفعة. اختياره يضبط المتوقع والمدفوع تلقائياً." : "The period this payment covers. Selecting it auto-fills Expected and Paid."} />
            </Label>

            {unitId && unpaidMonths.length > 0 ? (
              <Select
                value={selectedEntry?.periodStartIso || ""}
                onValueChange={(v) => {
                  const entry = unpaidMonths.find((u) => u.periodStartIso === v);
                  if (!entry) return;
                  setSelectedEntry(entry);
                  setPeriodYear(entry.year);
                  setPeriodMonthNum(entry.month);
                  if (payMode === "manual" && activeRent > 0) setExpected(String(entry.isPrior ? entry.remaining : activeRent));
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
            ) : unitId ? (
              <div className="rounded-xl border border-dashed border-sage-200 bg-sage-100/40 px-3 py-3 text-xs text-sage-600">
                <p className="font-semibold">
                  {lang === "ar" ? "سيتم تسجيل دفعة مُقدَّمة عن:" : "Will record an advance payment for:"}
                </p>
                <p className="mt-0.5 font-bold text-sage-700">{cyclePeriodLabel}</p>
                <p className="text-[10px] text-sage-400 mt-1.5 leading-relaxed">
                  {lang === "ar"
                    ? "لا توجد متأخرات. الفترة تُحدَّد تلقائياً من تاريخ بداية العقد ودورة الدفع."
                    : "No arrears. Period is set automatically from contract start and payment cycle."}
                </p>
              </div>
            ) : null}
          </div>
          )}










          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500 flex items-center gap-1.5">
                <span>
                  {payMode === "auto"
                    ? (lang === "ar" ? "المستحق لهذه العملية" : "Operation due")
                    : (lang === "ar" ? "المتوقع" : "Expected")}
                </span>
                {payMode === "auto" && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-sage-100 text-sage-600 border border-sage-200">
                    {lang === "ar" ? "محسوب" : "AUTO"}
                  </span>
                )}
                <FieldHelp content={lang === "ar" ? "المبلغ المستحق على المستأجر لهذه الفترة. الفرق بينه وبين المدفوع يصبح متأخرات أو رصيد دائن." : "Amount due for this period. Difference with Paid becomes arrears or credit."} />
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                readOnly={payMode === "auto"}
                aria-readonly={payMode === "auto"}
                className={`rounded-xl border-sage-200 bg-card h-11 ${payMode === "auto" ? "opacity-80 cursor-not-allowed" : ""}`}
                title={payMode === "auto" ? (lang === "ar" ? "محسوب تلقائياً من إجمالي المتأخرات. للتعديل اليدوي بدّل إلى \"اختيار يدوي\"." : "Computed automatically from total arrears. Switch to Manual to edit.") : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500 inline-flex items-center gap-1">
                {lang === "ar" ? "المدفوع" : "Paid"}
                <FieldHelp content={lang === "ar" ? "المبلغ المستلم فعلياً من المستأجر. إن كان أقل من المتوقع يُسجَّل كدفعة جزئية." : "Amount actually received. If less than Expected it's recorded as a partial payment."} />
              </Label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
            </div>
          </div>

          {/* Quick-fill chip: one-month rent (auto-distribute mode uses its own button) */}
          {unitId && activeRent > 0 && payMode === "manual" && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAmount(String(activeRent))}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sage-100 text-sage-700 border border-sage-200 hover:bg-sage-200/50"
              >
                {lang === "ar" ? "= إيجار شهر" : "= 1 month rent"} ({format(activeRent)})
              </button>
            </div>
          )}

          {/* Live distribution preview (auto mode) */}
          {payMode === "auto" && distribution && distribution.allocations.length > 0 && (
            <div className="rounded-2xl border border-sage-200 bg-sage-100/30 px-3.5 py-3">
              <div className="text-[11px] font-extrabold text-sage-600 uppercase tracking-wide mb-2 flex items-center justify-between">
                <span>{lang === "ar" ? "توزيع الدفعة" : "Payment distribution"}</span>
                <span className="text-sage-500">
                  {distribution.allocations.length} {lang === "ar" ? (distribution.allocations.length === 1 ? "بند" : "بنود") : (distribution.allocations.length === 1 ? "item" : "items")}
                </span>
              </div>
              <div className="space-y-1">
                {distribution.allocations.map((a, i) => {
                  const full = a.amount + 0.009 >= a.expected;
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {a.isAdvance && <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/30">{lang === "ar" ? "مقدمة" : "ADV"}</span>}
                        {a.isPrior && <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-burgundy/15 text-burgundy border border-burgundy/30">{lang === "ar" ? "سابق" : "PRIOR"}</span>}
                        <span className="font-semibold text-sage-700 truncate">{a.label}</span>
                      </span>
                      <span className={`tabular-nums font-bold ${full ? "text-sage-600" : "text-terracotta"}`}>
                        {format(a.amount)}{!full && <span className="text-[10px] opacity-70"> / {format(a.expected)}</span>}
                        {full && <span className="ms-1">✓</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              {distribution.remainder > 0.009 && (
                <div className="mt-2 pt-2 border-t border-sage-200 flex items-center justify-between text-xs text-slate">
                  <span className="font-semibold">{lang === "ar" ? "رصيد دائن غير موزَّع" : "Unallocated credit"}</span>
                  <span className="font-extrabold tabular-nums">{format(distribution.remainder)}</span>
                </div>
              )}
            </div>
          )}
          {isPartial && payMode === "manual" && (
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
              <Label className="text-xs text-sage-500 inline-flex items-center gap-1">
                {lang === "ar" ? "الطريقة" : "Method"}
                <FieldHelp content={lang === "ar" ? "طريقة استلام المبلغ (نقد، تحويل، شيك...). لأغراض السجل فقط ولا تؤثر على الحساب." : "How the payment was received. For records only, doesn't affect calculations."} />
              </Label>
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
            <Label className="text-xs text-sage-500 inline-flex items-center gap-1">
              {t2("receipt_number")}
              <FieldHelp content={lang === "ar" ? "رقم الإيصال أو المرجع البنكي. اختياري — يُستخدم للبحث والمطابقة." : "Receipt or bank reference number. Optional — used for search and reconciliation."} />
            </Label>
            <Input
              value={receiptCounterReady ? receipt : ""}
              onChange={(e) => setReceipt(e.target.value)}
              maxLength={50}
              disabled={!receiptCounterReady}
              placeholder={!receiptCounterReady ? (lang === "ar" ? "جارٍ تجهيز الرقم…" : "Preparing number…") : undefined}
              className="rounded-xl border-sage-200 bg-card h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl border-sage-200 bg-card" />
          </div>
          {payMode === "manual" && unitId && priorArrears.length > 0 && (
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

          {/* Auto-send via WhatsApp toggle */}
          {unitId && (
            <label className="flex items-start gap-2.5 rounded-xl border border-sage-200 bg-sage-100/30 px-3 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.autoSendReceiptWhatsApp}
                onChange={(e) => update({ autoSendReceiptWhatsApp: e.target.checked })}
                className="h-4 w-4 mt-0.5 rounded border-sage-300 accent-[hsl(var(--primary))]"
              />
              <span className="text-xs flex-1">
                <span className="font-extrabold text-sage-700 block">
                  {lang === "ar" ? "فتح واتساب تلقائياً بعد الحفظ" : "Open WhatsApp automatically after save"}
                </span>
                <span className="text-sage-500 block mt-0.5 text-[11px] leading-relaxed">
                  {lang === "ar"
                    ? "يفتح واتساب على رقم المستأجر مع رسالة الإيصال جاهزة، وينزّل ملف PDF لإرفاقه."
                    : "Opens WhatsApp to the tenant with the receipt message ready; the PDF downloads to attach."}
                </span>
              </span>
            </label>
          )}

          {/* Include arrears in printed receipt — explicit pre-save choice */}
          {unitId && unpaidMonths.length > 0 && (
            <label className="flex items-start gap-2.5 rounded-xl border border-sage-200 bg-sage-100/30 px-3 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeArrearsInReceipt}
                onChange={(e) => setIncludeArrearsInReceipt(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-sage-300 accent-[hsl(var(--primary))]"
              />
              <span className="text-xs flex-1">
                <span className="font-extrabold text-sage-700 block">
                  {lang === "ar" ? "أدرج تفاصيل المتأخرات في الإيصال" : "Include arrears details on the receipt"}
                </span>
                <span className="text-sage-500 block mt-0.5 text-[11px] leading-relaxed">
                  {lang === "ar"
                    ? "عند التفعيل، سيظهر جدول الأشهر المتأخرة في الإيصال المطبوع."
                    : "When enabled, the unpaid months table will appear on the printed receipt."}
                </span>
              </span>
            </label>
          )}

          {/* Pre-save summary */}
          {unitId && (
            <div className="text-[11px] text-sage-500 bg-sage-100/40 border border-sage-200/60 rounded-xl px-3 py-2 leading-relaxed">
              <span className="font-bold text-sage-600">{lang === "ar" ? "ملخّص الحفظ:" : "Summary:"}</span>{" "}
              {lang === "ar" ? "الإيصال" : "Receipt"}: <b className="text-sage-700">{lang === "ar" ? "سند استلام" : "Receipt voucher"}</b>
              {" · "}
              {lang === "ar" ? "المتأخرات في الإيصال" : "Arrears on receipt"}:{" "}
              <b className={includeArrearsInReceipt && unpaidMonths.length > 0 ? "text-burgundy" : "text-sage-700"}>
                {unpaidMonths.length === 0
                  ? (lang === "ar" ? "لا توجد" : "none")
                  : includeArrearsInReceipt
                  ? (lang === "ar" ? "ستُدرج" : "will be included")
                  : (lang === "ar" ? "لن تُدرج" : "will not be included")}
              </b>
              {" · "}
              {lang === "ar" ? "عدد البنود" : "Items"}:{" "}
              <b className="text-sage-700">
                {payMode === "auto" && distribution ? distribution.allocations.length : (collectPriorArrears ? 1 + priorArrears.length : 1)}
              </b>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button data-guard-ignore variant="outline" onClick={() => guard.handleOpenChange(false)} className="rounded-xl">{t2("cancel")}</Button>
          <Button
            data-guard-ignore
            type="button"
            variant="outline"
            onClick={openPreview}
            disabled={!unitId || !(Number(amount) > 0)}
            className="rounded-xl border-sage-300 text-sage-700 hover:bg-sage-100/50"
          >
            {lang === "ar" ? "معاينة الإيصال" : "Preview receipt"}
          </Button>
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
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="rounded-2xl max-w-3xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sage-700 flex items-center justify-between gap-2">
              <span>{lang === "ar" ? "معاينة الإيصال" : "Receipt preview"}</span>
              {unpaidMonths.length > 0 && (
                <span
                  className={
                    "text-[11px] font-bold rounded-full px-2.5 py-1 " +
                    (includeArrearsInReceipt
                      ? "bg-burgundy/10 text-burgundy"
                      : "bg-sage-100 text-sage-600")
                  }
                >
                  {includeArrearsInReceipt
                    ? (lang === "ar" ? "المتأخرات مُدرجة" : "Arrears included")
                    : (lang === "ar" ? "المتأخرات غير مُدرجة" : "Arrears hidden")}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScaledReceiptPreview html={previewHtml} rtl={lang === "ar"} />

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            {unpaidMonths.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIncludeArrearsInReceipt((v) => {
                    const next = !v;
                    // re-render preview with the new flag
                    setTimeout(() => {
                      const args = buildReceiptArgs();
                      if (!args) return;
                      const html = buildReceiptHTML({
                        ...args.baseArgs,
                        unpaidMonths: next ? args.upTo : [],
                        unpaidTotal: next ? args.unpaidTotal : 0,
                        unpaidUpToLabel: next ? args.monthLabel : undefined,
                      });
                      setPreviewHtml(html);
                    }, 0);
                    return next;
                  });
                }}
                className="rounded-xl border-sage-300 text-sage-700"
              >
                {includeArrearsInReceipt
                  ? (lang === "ar" ? "إخفاء المتأخرات" : "Hide arrears")
                  : (lang === "ar" ? "إظهار المتأخرات" : "Show arrears")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              className="rounded-xl"
            >
              {lang === "ar" ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function ScaledReceiptPreview({ html, rtl }: { html: string; rtl: boolean }) {
  // Source page is rendered at 794px (A4 @96dpi). We scale it down to fit
  // the available container width on mobile/tablet while keeping desktop 1:1.
  const PAGE_W = 794;
  const PAGE_H = 1123; // A4 height @96dpi
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / PAGE_W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scaledH = PAGE_H * scale;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto rounded-xl border border-sage-200 bg-sage-100/30 relative"
      style={{
        height: `min(${scaledH}px, 70svh)`,
        WebkitOverflowScrolling: "touch",
      }}
    >
      <iframe
        title="receipt-preview"
        srcDoc={html}
        scrolling="no"
        className="bg-white border-0"
        style={{
          width: `${PAGE_W}px`,
          height: `${PAGE_H}px`,
          transform: `scale(${scale})`,
          transformOrigin: rtl ? "top right" : "top left",
        }}
      />
    </div>
  );
}

function methodLabel(m: string, lang: string) {
  const ar: Record<string, string> = { cash: "نقدي", transfer: "تحويل", cheque: "شيك", card: "بطاقة" };
  const en: Record<string, string> = { cash: "Cash", transfer: "Transfer", cheque: "Cheque", card: "Card" };
  return (lang === "ar" ? ar : en)[m] || m;
}
