import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  tenant_name: string | null;
  arrears_note?: string | null;
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
  const [unpaidMonths, setUnpaidMonths] = useState<{ year: number; month: number; remaining: number }[]>([]);
  const [includeArrears, setIncludeArrears] = useState(true);
  const [collectPriorArrears, setCollectPriorArrears] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [allPaid, setAllPaid] = useState(false);
  const [activeRent, setActiveRent] = useState<number>(0);

  const { start: periodStart, end: periodEnd } = monthRange(periodYear, periodMonthNum);
  const monthNames = lang === "ar" ? AR_MONTHS : EN_MONTHS;

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: us } = await supabase.from("units").select("id, unit_number, tenant_name, rent_amount, building_id").order("unit_number");
      const ids = Array.from(new Set((us || []).map((u: any) => u.building_id)));
      const { data: bs } = ids.length
        ? await supabase.from("buildings").select("id, name, name_en").in("id", ids)
        : { data: [] as any[] };
      const bMap = new Map((bs || []).map((b: any) => [b.id, b]));
      const unitIds = (us || []).map((u: any) => u.id);
      const { data: ts } = unitIds.length
        ? await supabase.from("tenancies")
            .select("unit_id, status, tenant_name, outstanding_at_end, ended_at")
            .in("unit_id", unitIds)
        : { data: [] as any[] };
      const arrearsMap = new Map<string, { name: string; amount: number }>();
      (ts || []).forEach((t: any) => {
        if (t.status === "ended" && Number(t.outstanding_at_end) > 0) {
          const cur = arrearsMap.get(t.unit_id);
          const amt = Number(t.outstanding_at_end);
          if (!cur || amt > cur.amount) arrearsMap.set(t.unit_id, { name: t.tenant_name || "—", amount: amt });
        }
      });
      const opts: UnitOpt[] = (us || [])
        .filter((u: any) => !!u.tenant_name || arrearsMap.has(u.id) || u.id === presetUnitId)
        .map((u: any) => {
          const ar = arrearsMap.get(u.id);
          const isVacantWithArrears = !u.tenant_name && !!ar;
          return {
            id: u.id,
            unit_number: u.unit_number,
            building_id: u.building_id,
            tenant_name: u.tenant_name || (isVacantWithArrears ? ar!.name : null),
            rent_amount: Number(u.rent_amount),
            building_name: bMap.get(u.building_id)?.name || bMap.get(u.building_id)?.name_en || "—",
            arrears_note: isVacantWithArrears
              ? (lang === "ar" ? `متأخرات سابقة: ${ar!.amount}` : `Prior arrears: ${ar!.amount}`)
              : null,
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

  // Load unpaid months for the selected unit (based on contract + prior payments)
  useEffect(() => {
    if (!open || !unitId) { setUnpaidMonths([]); setAllPaid(false); return; }
    let cancelled = false;
    (async () => {
      const { data: tn } = await supabase
        .from("tenancies")
        .select("contract_start_date, contract_end_date, rent_amount, rent_type, status")
        .eq("unit_id", unitId)
        .eq("status", "active")
        .maybeSingle();
      if (cancelled) return;
      if (!tn) { setUnpaidMonths([]); setAllPaid(false); setActiveRent(0); return; }
      const startStr = (tn as any).contract_start_date as string | null;
      const endStr = (tn as any).contract_end_date as string | null;
      const rentAmt = Number((tn as any).rent_amount) || 0;
      const rentType = (tn as any).rent_type as string;
      setActiveRent(rentAmt);
      if (!startStr || rentAmt <= 0) { setUnpaidMonths([]); setAllPaid(false); return; }

      const { data: ps } = await supabase
        .from("payments")
        .select("amount, period_start")
        .eq("unit_id", unitId)
        .is("deleted_at", null);
      const paidByMonth = new Map<string, number>();
      (ps || []).forEach((p: any) => {
        if (!p.period_start) return;
        const k = String(p.period_start).slice(0, 7);
        paidByMonth.set(k, (paidByMonth.get(k) || 0) + Number(p.amount));
      });

      const today = new Date();
      const start = new Date(startStr);
      const horizonByToday = new Date(today.getFullYear(), today.getMonth() + 2, 1);
      const horizonByContract = endStr ? new Date(endStr) : horizonByToday;
      const horizon = horizonByContract < horizonByToday ? horizonByContract : horizonByToday;
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const out: { year: number; month: number; remaining: number }[] = [];
      while (cursor <= horizon) {
        const y = cursor.getFullYear();
        const m = cursor.getMonth() + 1;
        const k = `${y}-${String(m).padStart(2, "0")}`;
        const paid = paidByMonth.get(k) || 0;
        const isContractAnchor = rentType !== "yearly" || m === start.getMonth() + 1;
        if (isContractAnchor && paid + 0.01 < rentAmt) {
          out.push({ year: y, month: m, remaining: rentAmt - paid });
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
      if (cancelled) return;
      setUnpaidMonths(out);
      setAllPaid(out.length === 0);
      if (out.length > 0) {
        setPeriodYear(out[0].year);
        setPeriodMonthNum(out[0].month);
      }
    })();
    return () => { cancelled = true; };
  }, [open, unitId]);

  const onPickUnit = (id: string) => {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u) { setAmount(String(u.rent_amount)); setExpected(String(u.rent_amount)); }
  };


  const remaining = Math.max(0, (Number(expected) || 0) - (Number(amount) || 0));
  const isPartial = Number(amount) > 0 && Number(expected) > 0 && Number(amount) < Number(expected);

  // Other outstanding months besides the one this payment is for
  const priorArrears = unpaidMonths.filter((m) => !(m.year === periodYear && m.month === periodMonthNum));
  const priorArrearsTotal = priorArrears.reduce((s, m) => s + m.remaining, 0);
  const grandCollected = Number(amount || 0) + (collectPriorArrears ? priorArrearsTotal : 0);

  // Total arrears up to and including the selected month (pre-payment)
  const arrearsUpToSelected = unpaidMonths.filter(
    (m) => m.year < periodYear || (m.year === periodYear && m.month <= periodMonthNum)
  );
  const arrearsUpToTotal = arrearsUpToSelected.reduce((s, m) => s + m.remaining, 0);
  const selectedMonthLabel = `${monthNames[periodMonthNum - 1]} ${periodYear}`;


  // Detect "final installment of a partially-paid month"
  const currentMonthEntry = unpaidMonths.find((m) => m.year === periodYear && m.month === periodMonthNum);
  const hasPriorPartial = !!currentMonthEntry && activeRent > 0 && currentMonthEntry.remaining + 0.01 < activeRent;
  const settlesMonth = !!currentMonthEntry && Number(amount) + 0.01 >= currentMonthEntry.remaining;
  const isFinalSettlement = hasPriorPartial && settlesMonth;
  const monthLabelForNote = `${monthNames[periodMonthNum - 1]} ${periodYear}`;
  const settlementNote = isFinalSettlement
    ? (lang === "ar"
        ? `تم سداد الجزء الأخير من المبلغ المتبقي عن شهر ${monthLabelForNote}.`
        : `Final installment of the outstanding balance for ${monthLabelForNote} has been settled.`)
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
      period_start: periodStart || null,
      period_end: periodEnd || null,
    }];
    if (collectPriorArrears && priorArrears.length > 0) {
      for (const m of priorArrears) {
        const { start: ps, end: pe } = monthRange(m.year, m.month);
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
      await supabase.from("units").update({ last_paid_date: date, status: newStatus }).eq("id", unitId);
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
    // Auto-generate branded PDF receipt
    try {
      const u = units.find((x) => x.id === unitId);
      const monthLabel = `${(lang === "ar" ? AR_MONTHS : EN_MONTHS)[periodMonthNum - 1]} ${periodYear}`;
      // Remaining unpaid months up to and including the selected month
      // (subtract the amount just paid from the chosen month's remaining)
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
      const html = buildReceiptHTML({
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
        lang: lang === "ar" ? "ar" : "en",
        unpaidMonths: includeArrears ? upTo : [],
        unpaidTotal: includeArrears ? unpaidTotal : 0,
        unpaidUpToLabel: includeArrears ? monthLabel : undefined,
        settlementNote,
        collectedArrears: collectedArrearsList,
        grandTotal: collectedArrearsList.length ? grandTotal : null,
      });
      await downloadHTMLAsPDF(html, `receipt-${(receipt.trim() || formatReceipt(settings.receipt))}.pdf`, settings);
    } catch (e: any) {
      console.warn("receipt PDF failed", e);
    }
    setAmount(""); setReceipt(""); setNotes(""); setCollectPriorArrears(false); if (!presetUnitId) setUnitId("");
    guard.markSaved();
    onOpenChange(false);
    onSaved?.();
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
                value={`${periodYear}-${periodMonthNum}`}
                onValueChange={(v) => {
                  const [y, m] = v.split("-").map(Number);
                  setPeriodYear(y);
                  setPeriodMonthNum(m);
                  const entry = unpaidMonths.find((u) => u.year === y && u.month === m);
                  if (entry) {
                    if (activeRent > 0) setExpected(String(activeRent));
                    setAmount(String(entry.remaining));
                  }
                }}
              >
                <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {unpaidMonths.map((u) => (
                    <SelectItem key={`${u.year}-${u.month}`} value={`${u.year}-${u.month}`}>
                      {monthNames[u.month - 1]} {u.year} · {format(u.remaining)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Select value={String(periodMonthNum)} onValueChange={(v) => setPeriodMonthNum(Number(v))}>
                  <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {monthNames.map((n, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>
                    ))}
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
            )}
          </div>

          {unitId && arrearsUpToTotal > 0.009 && (
            <div className="rounded-2xl border border-burgundy/20 bg-burgundy/10 px-4 py-3">
              <div className="text-[11px] font-bold text-burgundy/80 uppercase tracking-wide">
                {lang === "ar"
                  ? `إجمالي المتأخرات حتى ${selectedMonthLabel}`
                  : `Total arrears up to ${selectedMonthLabel}`}
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-xl font-extrabold text-burgundy tabular-nums">{format(arrearsUpToTotal)}</span>
                <span className="text-[11px] text-burgundy/70 font-semibold">
                  {lang === "ar"
                    ? `${arrearsUpToSelected.length} ${arrearsUpToSelected.length === 1 ? "شهر غير مسدد" : "أشهر غير مسددة"}`
                    : `${arrearsUpToSelected.length} unpaid ${arrearsUpToSelected.length === 1 ? "month" : "months"}`}
                </span>
              </div>
            </div>
          )}


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
          {unitId && priorArrears.length > 0 && (
            <div className="rounded-xl border border-terracotta/25 bg-terracotta/[0.04] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-terracotta">
                  {lang === "ar" ? "تفاصيل المتأخرات" : "Arrears details"}
                </span>
                <span className="text-[10px] text-sage-500 font-semibold">
                  {lang === "ar"
                    ? `${priorArrears.length} ${priorArrears.length === 1 ? "شهر" : "أشهر"}`
                    : `${priorArrears.length} ${priorArrears.length === 1 ? "month" : "months"}`}
                </span>
              </div>
              <div className="divide-y divide-terracotta/15">
                {priorArrears.map((m) => (
                  <div key={`${m.year}-${m.month}`} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-sage-700 font-semibold">
                      {monthNames[m.month - 1]} {m.year}
                    </span>
                    <span className="text-terracotta font-bold tabular-nums">{format(m.remaining)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-terracotta/25 text-xs">
                <span className="text-sage-700 font-bold">
                  {lang === "ar" ? "الإجمالي" : "Total"}
                </span>
                <span className="text-terracotta font-extrabold tabular-nums">{format(priorArrearsTotal)}</span>
              </div>
            </div>
          )}
          {unitId && unpaidMonths.length > 0 && (
            <label className="flex items-center gap-2 rounded-xl border border-sage-200 bg-card px-3 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeArrears}
                onChange={(e) => setIncludeArrears(e.target.checked)}
                className="h-4 w-4 rounded border-sage-300 accent-[hsl(var(--primary))]"
              />
              <span className="text-xs text-sage-600 font-semibold">
                {lang === "ar" ? "إظهار إجمالي المتأخرات في الفاتورة" : "Show total arrears on receipt"}
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
    </Dialog>
  );
}

function methodLabel(m: string, lang: string) {
  const ar: Record<string, string> = { cash: "نقدي", transfer: "تحويل", cheque: "شيك", card: "بطاقة" };
  const en: Record<string, string> = { cash: "Cash", transfer: "Transfer", cheque: "Cheque", card: "Card" };
  return (lang === "ar" ? ar : en)[m] || m;
}
