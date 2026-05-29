import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { BuyAddonUnitsDialog } from "@/components/BuyAddonUnitsDialog";

const UNIT_TYPES = ["apartment", "shop", "room", "villa"] as const;
const RENT_TYPES = ["monthly", "daily", "yearly"] as const;
const CONTRACT_TYPES = ["daily", "monthly", "yearly"] as const;
const PAYMENT_METHODS = ["cash", "transfer", "cheque", "card"] as const;

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonthOptions(lang: string) {
  const names = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  const opts: { label: string; value: string; start: string; end: string }[] = [];
  const today = new Date();
  for (let i = -2; i <= 1; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    opts.push({ label: `${names[m]} ${y}`, value: `${y}-${String(m + 1).padStart(2, "0")}`, start, end });
  }
  return opts;
}

export function AddUnitDialog({ open, onOpenChange, buildingId, floors, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; buildingId: string; floors: number; onCreated?: () => void;
}) {
  const t2 = useT2();
  const { lang } = useI18n();
  const { format } = useCurrency();
  const [showAddons, setShowAddons] = useState(false);
  const [unitNumber, setUnitNumber] = useState("");
  const [floor, setFloor] = useState<string>("1");
  const [type, setType] = useState<typeof UNIT_TYPES[number]>("apartment");
  const [occupied, setOccupied] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantNameEn, setTenantNameEn] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [rentAmount, setRentAmount] = useState<string>("0");
  const [rentType, setRentType] = useState<typeof RENT_TYPES[number]>("monthly");
  const [contractType, setContractType] = useState<typeof CONTRACT_TYPES[number]>("yearly");
  const [contractStart, setContractStart] = useState<string>("");
  const [dueDay, setDueDay] = useState<string>("1");
  const [rentTiming, setRentTiming] = useState<"advance" | "arrears">("advance");

  const [arrears, setArrears] = useState<string>("0");
  const [recordPay, setRecordPay] = useState(false);
  const monthOpts = useMemo(() => getMonthOptions(lang), [lang]);
  const defaultMonth = monthOpts.find((o) => {
    const t = new Date();
    return o.value === `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
  })?.value || monthOpts[2]?.value;
  const [payMonth, setPayMonth] = useState<string>(defaultMonth || "");
  const [payAmount, setPayAmount] = useState<string>("0");
  const [payMethod, setPayMethod] = useState<typeof PAYMENT_METHODS[number]>("cash");
  const [busy, setBusy] = useState(false);
  const guard = useUnsavedGuard({ open, onOpenChange });

  const reset = () => {
    setUnitNumber(""); setFloor("1"); setType("apartment"); setOccupied(false);
    setTenantName(""); setTenantNameEn(""); setTenantPhone(""); setTenantEmail(""); setRentAmount("0"); setRentType("monthly");
    setContractType("yearly"); setContractStart(""); setDueDay("1"); setRentTiming("advance");
    setArrears("0"); setRecordPay(false); setPayAmount("0"); setPayMethod("cash");
  };

  const arrN = parseFloat(arrears) || 0;
  const rentN = parseFloat(rentAmount) || 0;
  const payN = recordPay ? (parseFloat(payAmount) || 0) : 0;
  const remaining = Math.max(0, arrN + rentN - payN);

  const submit = async () => {
    if (!unitNumber.trim()) return;
    if (occupied && (!tenantName.trim() || !tenantPhone.trim())) {
      return toast.error(t2("tenant_required"));
    }
    setBusy(true);
    const { data: created, error } = await supabase.from("units").insert({
      building_id: buildingId,
      unit_number: unitNumber.trim(),
      floor: Math.max(1, parseInt(floor) || 1),
      type,
      tenant_name: occupied ? tenantName.trim() : null,
      tenant_name_en: occupied ? (tenantNameEn.trim() || null) : null,
      tenant_phone: occupied ? tenantPhone.trim() : null,
      tenant_email: occupied ? tenantEmail.trim() || null : null,
      rent_amount: occupied ? rentN : 0,
      rent_type: rentType,
      due_day: Math.min(28, Math.max(1, parseInt(dueDay) || 1)),
      rent_timing: rentTiming,

      status: occupied ? "soon" : "vacant",
      contract_type: contractType,
      contract_start_date: contractStart || null,
      ...(occupied && arrN > 0 && rentN > 0 && rentType === "monthly"
        ? (() => {
            const dueInt = Math.min(28, Math.max(1, parseInt(dueDay) || 1));
            // floor + remainder كي لا يتم تقريب المتأخرات لأعلى.
            const months = Math.floor(arrN / rentN);
            const remainder = Math.max(0, arrN - months * rentN);
            const monthsBack = rentTiming === "arrears" ? months : Math.max(0, months - 1);
            const today = new Date();
            const anchor = new Date(today.getFullYear(), today.getMonth() - monthsBack, dueInt);
            const iso = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-${String(anchor.getDate()).padStart(2, "0")}`;
            return { opening_balance: remainder, opening_balance_date: iso };
          })()
        : {
            opening_balance: occupied ? arrN : 0,
            opening_balance_date: occupied && arrN > 0 ? (contractStart || new Date().toISOString().slice(0, 10)) : null,
          }),
    }).select("id").single();

    if (error || !created) {
      setBusy(false);
      if (error?.message?.includes("unit_quota_exceeded")) {
        setShowAddons(true);
        return;
      }
      return toast.error(error?.message || "");
    }


    if (occupied && recordPay && payN > 0) {
      const sel = monthOpts.find((o) => o.value === payMonth);
      const today = new Date().toISOString().slice(0, 10);
      const { error: pErr } = await supabase.from("payments").insert({
        unit_id: created.id,
        amount: payN,
        payment_method: payMethod,
        payment_date: today,
        period_start: sel?.start || null,
        period_end: sel?.end || null,
        expected_amount: rentN,
      });
      if (pErr) toast.error(pErr.message);
      else if (payN >= rentN) {
        await supabase.from("units").update({ status: "paid", last_paid_date: today }).eq("id", created.id);
      }
    }

    await logActivity({
      entityType: "unit",
      action: "created",
      entityId: created.id,
      buildingId,
      entityLabel: `${unitNumber.trim()}${occupied && tenantName.trim() ? ` — ${tenantName.trim()}` : ""}`,
      descriptionAr: `إضافة وحدة جديدة رقم ${unitNumber.trim()}${occupied ? ` للمستأجر ${tenantName.trim()}` : " (شاغرة)"}`,
      descriptionEn: `New unit ${unitNumber.trim()} added${occupied ? ` for ${tenantName.trim()}` : " (vacant)"}`,
    });
    if (occupied && tenantName.trim()) {
      await logActivity({
        entityType: "tenant",
        action: "created",
        entityId: created.id,
        buildingId,
        entityLabel: tenantName.trim(),
        descriptionAr: `إضافة مستأجر جديد: ${tenantName.trim()} — وحدة ${unitNumber.trim()}`,
        descriptionEn: `New tenant added: ${tenantName.trim()} — unit ${unitNumber.trim()}`,
      });
    }
    setBusy(false);
    toast.success("✓");
    reset();
    onCreated?.();
    guard.markSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="max-w-[400px] rounded-3xl border-sage-200 bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600 text-xl font-black">{t2("add_unit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2" {...guard.formProps}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t2("unit_number")}>
              <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
            </Field>
            <Field label={t2("floors")}>
              <Input type="number" inputMode="numeric" min={1} max={floors} value={floor}
                onChange={(e) => setFloor(e.target.value)}
                onBlur={() => { const n = parseInt(floor); if (!floor || isNaN(n) || n < 1) setFloor("1"); }}
                className="rounded-xl border-sage-200 bg-card" />
            </Field>
          </div>
          <Field label={t2("unit_type")}>
            <div className="flex flex-wrap gap-1.5">
              {UNIT_TYPES.map((tp) => (
                <button key={tp} type="button" onClick={() => setType(tp)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    type === tp ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                  }`}>{t2(tp as any)}</button>
              ))}
            </div>
          </Field>

          <Field label={t2("occupancy_status")}>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setOccupied(false)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                  !occupied ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                }`}>{t2("vacant")}</button>
              <button type="button" onClick={() => setOccupied(true)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                  occupied ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                }`}>{t2("rented")}</button>
            </div>
          </Field>

          {occupied && (
            <>
              <Field label={`${t2("tenant_name")} *`}>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} dir="rtl" className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <Field label={t2("tenant_name_en")}>
                <Input value={tenantNameEn} onChange={(e) => setTenantNameEn(e.target.value)} dir="ltr" placeholder="Optional" className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <Field label={`${t2("tenant_phone")} *`}>
                <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <Field label="البريد الإلكتروني / Email">
                <Input type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} placeholder="tenant@example.com" className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <div className="grid grid-cols-1">
                <Field label={t2("rent_amount")}>
                  <Input type="number" inputMode="decimal" min={0} step="0.001" value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    onBlur={() => { if (!rentAmount) setRentAmount("0"); }}
                    className="rounded-xl border-sage-200 bg-card" />
                </Field>
              </div>
              <Field label={t2("rent_timing")}>
                <div className="flex gap-1.5">
                  {(["advance", "arrears"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setRentTiming(m)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                        rentTiming === m ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                      }`}>{t2(m === "advance" ? "rent_timing_advance" : "rent_timing_arrears")}</button>
                  ))}
                </div>
                <p className="text-[11px] text-sage-500 mt-1.5 leading-relaxed">
                  {t2(rentTiming === "advance" ? "rent_timing_advance_hint" : "rent_timing_arrears_hint")}
                </p>
                <p className="text-[11px] text-sage-400 mt-1 leading-relaxed">
                  ⓘ {t2("due_auto_hint")}
                </p>
              </Field>


              <Field label="نوع العقد / Contract type">
                <div className="flex gap-1.5">
                  {CONTRACT_TYPES.map((ct) => (
                    <button key={ct} type="button" onClick={() => setContractType(ct)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                        contractType === ct ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                      }`}>{t2(ct)}</button>
                  ))}
                </div>
              </Field>
              <Field label="تاريخ بداية العقد / Contract start">
                <Input type="date" value={contractStart} onChange={(e) => {
                  const v = e.target.value;
                  setContractStart(v);
                  if (v) {
                    const d = new Date(v).getDate();
                    if (d >= 1 && d <= 28) setDueDay(String(d));
                  }
                }}
                  className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <Field label={lang === "ar" ? "يوم الاستحقاق الشهري (١–٢٨)" : "Monthly due day (1–28)"}>
                <Input type="number" inputMode="numeric" min={1} max={28} value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  onBlur={() => {
                    const n = parseInt(dueDay);
                    if (!dueDay || isNaN(n) || n < 1) setDueDay("1");
                    else if (n > 28) setDueDay("28");
                  }}
                  className="rounded-xl border-sage-200 bg-card" />
                <p className="text-[11px] text-sage-500 mt-1 leading-relaxed">
                  {lang === "ar"
                    ? "اليوم من كل شهر الذي يستحق فيه الإيجار. إذا لم يُدفع بعده تظهر الوحدة في المتأخرات تلقائياً."
                    : "Day of each month rent is due. If unpaid after this day, the unit appears in arrears automatically."}
                </p>
              </Field>
              <Field label={`${t2("rent_type")} (دورة الدفع)`}>
                <div className="flex gap-1.5">
                  {RENT_TYPES.map((rt) => (
                    <button key={rt} type="button" onClick={() => setRentType(rt)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                        rentType === rt ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                      }`}>{t2(rt)}</button>
                  ))}
                </div>
              </Field>

              {/* Arrears */}
              <div className="pt-2 border-t border-sage-100">
                <Field label={t2("arrears_amount")}>
                  <Input type="number" inputMode="decimal" min={0} step="0.001" value={arrears}
                    onChange={(e) => setArrears(e.target.value)}
                    onBlur={() => { if (!arrears) setArrears("0"); }}
                    placeholder="0"
                    className="rounded-xl border-sage-200 bg-card" />
                  <p className="text-[11px] text-muted-foreground mt-1">{t2("arrears_hint")}</p>
                  {arrN > 0 && rentN > 0 && rentType === "monthly" && (() => {
                    const months = Math.max(1, Math.round(arrN / rentN));
                    const remainder = Math.max(0, arrN - months * rentN);
                    const names = lang === "ar" ? AR_MONTHS : EN_MONTHS;
                    const dueInt = Math.min(28, Math.max(1, parseInt(dueDay) || 1));
                    const monthsBack = rentTiming === "arrears" ? months : Math.max(0, months - 1);
                    const today = new Date();
                    const list: string[] = [];
                    for (let i = 0; i < months; i++) {
                      const d = new Date(today.getFullYear(), today.getMonth() - monthsBack + i, dueInt);
                      list.push(`${names[d.getMonth()]} ${d.getFullYear()}`);
                    }
                    return (
                      <div className="mt-2 rounded-xl border border-sage-200 bg-sage-50/60 px-2.5 py-2 text-[11px] text-sage-600">
                        <p className="font-bold">
                          {lang === "ar" ? `= ${months} ${months === 1 ? "شهر متأخّر" : months === 2 ? "شهران متأخّران" : "أشهر متأخّرة"}` : `= ${months} overdue ${months === 1 ? "month" : "months"}`}
                        </p>
                        <p className="mt-0.5 opacity-80 leading-relaxed">{list.join(lang === "ar" ? " · " : " · ")}</p>
                        {remainder > 0.009 && (
                          <p className="mt-1 text-terracotta font-semibold">
                            {lang === "ar" ? `+ رصيد جزئي: ${format(remainder)}` : `+ partial balance: ${format(remainder)}`}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </Field>
              </div>


              {/* Initial payment */}
              <div className="pt-2 border-t border-sage-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={recordPay} onChange={(e) => setRecordPay(e.target.checked)}
                    className="h-4 w-4 accent-sage-500" />
                  <span className="text-xs font-semibold text-sage-600">{t2("record_payment_now")}</span>
                </label>
                {recordPay && (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={t2("amount")}>
                        <Input type="number" inputMode="decimal" min={0} step="0.001" value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="rounded-xl border-sage-200 bg-card" />
                      </Field>
                      <Field label={t2("rent_month")}>
                        <Select value={payMonth} onValueChange={setPayMonth}>
                          <SelectTrigger className="rounded-xl border-sage-200 bg-card h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {monthOpts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field label={t2("rent_type")}>
                      <div className="flex gap-1">
                        {PAYMENT_METHODS.map((m) => (
                          <button key={m} type="button" onClick={() => setPayMethod(m)}
                            className={`flex-1 px-2 py-2 rounded-xl text-[11px] font-semibold ${
                              payMethod === m ? "bg-gradient-sage text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>{m}</button>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}
              </div>

              {/* Live summary */}
              {(arrN > 0 || rentN > 0 || payN > 0) && (
                <div className="rounded-2xl bg-sage-50 border border-sage-200/60 p-3 text-xs space-y-1.5">
                  <p className="font-bold text-sage-600 mb-1">{t2("payment_summary")}</p>
                  <SummaryRow label={t2("arrears")} value={format(arrN)} />
                  <SummaryRow label={t2("current_period_rent")} value={`+ ${format(rentN)}`} />
                  {recordPay && <SummaryRow label={t2("total_received")} value={`− ${format(payN)}`} />}
                  <div className="border-t border-sage-200 pt-1.5 mt-1.5 flex items-center justify-between font-black text-sage-600">
                    <span>{t2("remaining_after_payment")}</span>
                    <span className={remaining > 0 ? "text-burgundy" : "text-sage-600"}>{format(remaining)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button data-guard-ignore variant="outline" className="flex-1 rounded-xl border-sage-200" onClick={() => guard.handleOpenChange(false)}>{t2("cancel")}</Button>
            <Button data-guard-ignore onClick={submit} disabled={busy || !unitNumber.trim()} className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground font-semibold">{t2("save")}</Button>
          </div>
        </div>
        {guard.ConfirmDiscardUI}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-sage-600 font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sage-600">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
