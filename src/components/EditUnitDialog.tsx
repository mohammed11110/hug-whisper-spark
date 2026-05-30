import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT2 } from "@/lib/i18n2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";
// LastPaymentSection import removed — manual prior-payment entry is now
// only available in AddUnitDialog / NewTenancyDialog (at registration).
import { useI18n } from "@/lib/i18n";

const UNIT_TYPES = ["apartment", "shop", "room", "villa"] as const;
const RENT_TYPES = ["monthly", "daily", "yearly"] as const;
const CONTRACT_TYPES = ["daily", "monthly", "yearly"] as const;
const STATUSES = ["vacant", "soon", "paid", "late"] as const;

interface UnitInput {
  id: string;
  unit_number: string;
  floor: number;
  type: string;
  status: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  tenant_email?: string | null;
  rent_amount: number;
  rent_type: string;
  due_day: number;
  rent_timing?: string | null;

  security_deposit?: number;
  deposit_status?: string;
  contract_type?: string;
  contract_start_date?: string | null;
}

export function EditUnitDialog({
  open, onOpenChange, unit, floors, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unit: UnitInput | null;
  floors: number;
  onSaved?: () => void;
}) {
  const t2 = useT2();
  const { lang } = useI18n();
  const [unitNumber, setUnitNumber] = useState("");
  const [floor, setFloor] = useState("1");
  const [type, setType] = useState<string>("apartment");
  const [status, setStatus] = useState<string>("vacant");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [rentAmount, setRentAmount] = useState("0");
  const [rentType, setRentType] = useState<string>("monthly");
  const [dueDay, setDueDay] = useState("1");
  const [graceDays, setGraceDays] = useState("0");
  const [securityDeposit, setSecurityDeposit] = useState("0");
  const [rentTiming, setRentTiming] = useState<"advance" | "arrears">("advance");


  const [depositStatus, setDepositStatus] = useState<string>("none");
  const [contractType, setContractType] = useState<string>("yearly");
  const [contractStart, setContractStart] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [initialRentTiming, setInitialRentTiming] = useState<"advance" | "arrears">("advance");
  const guard = useUnsavedGuard({ open, onOpenChange });

  useEffect(() => {
    if (!unit) return;
    setUnitNumber(unit.unit_number);
    setFloor(String(unit.floor));
    setType(unit.type);
    setStatus(unit.status);
    setTenantName(unit.tenant_name || "");
    setTenantPhone(unit.tenant_phone || "");
    setTenantEmail(unit.tenant_email || "");
    setRentAmount(String(unit.rent_amount ?? 0));
    setRentType(unit.rent_type);
    setDueDay(String(unit.due_day ?? 1));
    setGraceDays(String((unit as any).grace_days ?? 0));
    setRentTiming(((unit as any).rent_timing === "arrears" ? "arrears" : "advance"));


    setSecurityDeposit(String(unit.security_deposit ?? 0));
    setDepositStatus(unit.deposit_status || "none");
    setContractType(unit.contract_type || "yearly");
    setContractStart(unit.contract_start_date || "");
    setInitialRentTiming(((unit as any).rent_timing === "arrears" ? "arrears" : "advance"));
  }, [unit]);

  if (!unit) return null;

  const occupied = status !== "vacant";

  const submit = async () => {
    if (!unitNumber.trim()) return;
    if (occupied && !tenantName.trim()) return toast.error(t2("tenant_required"));
    setBusy(true);
    const updatePayload: any = {
      unit_number: unitNumber.trim(),
      floor: Math.max(1, parseInt(floor) || 1),
      type,
      status,
      tenant_name: occupied ? tenantName.trim() : null,
      tenant_phone: occupied ? tenantPhone.trim() || null : null,
      tenant_email: occupied ? tenantEmail.trim() || null : null,
      rent_amount: parseFloat(rentAmount) || 0,
      rent_type: rentType,
      due_day: Math.min(28, Math.max(1, parseInt(dueDay) || 1)),
      grace_days: Math.min(30, Math.max(0, parseInt(graceDays) || 0)),
      rent_timing: rentTiming,


      security_deposit: parseFloat(securityDeposit) || 0,
      deposit_status: depositStatus,
      deposit_refunded_at: depositStatus === "refunded" ? new Date().toISOString().slice(0, 10) : null,
      contract_type: contractType,
      contract_start_date: contractStart || null,
      // ملاحظة: لا نُعدّل opening_balance أو opening_balance_date من هنا.
      // المتأخرات الافتتاحية تُدخل فقط عند تسجيل المستأجر، وتُنقَص بعد ذلك
      // حصرًا عبر تسجيل إيصالات الدفع.
    };



    const { error } = await supabase.from("units").update(updatePayload).eq("id", unit.id);
    if (error) { setBusy(false); return toast.error(error.message); }

    setBusy(false);
    const tenantChanged =
      (unit.tenant_name || "") !== tenantName.trim() ||
      (unit.tenant_phone || "") !== tenantPhone.trim() ||
      (unit.tenant_email || "") !== tenantEmail.trim();
    logActivity({
      entityType: tenantChanged ? "tenant" : "unit",
      action: "updated",
      entityId: unit.id,
      entityLabel: tenantName.trim() || unitNumber.trim(),
      buildingId: (unit as any).building_id ?? null,
      descriptionAr: tenantChanged
        ? `تعديل بيانات المستأجر ${tenantName.trim() || "—"} — وحدة ${unitNumber.trim()}`
        : `تعديل بيانات الوحدة ${unitNumber.trim()}`,
      descriptionEn: tenantChanged
        ? `Tenant details updated for ${tenantName.trim() || "—"} — unit ${unitNumber.trim()}`
        : `Unit ${unitNumber.trim()} updated`,
    });
    toast.success("✓");
    onSaved?.();
    guard.markSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="max-w-[400px] rounded-3xl border-sage-200 bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600 text-xl font-black">{t2("edit_unit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2" {...guard.formProps}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t2("unit_number")}>
              <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
            </Field>
            <Field label={t2("floors")}>
              <Input type="number" inputMode="numeric" min={1} max={floors} value={floor}
                onChange={(e) => setFloor(e.target.value)}
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

          <Field label={t2("status")}>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    status === s ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                  }`}>{t2(s as any)}</button>
              ))}
            </div>
          </Field>

          {occupied && (
            <>
              <Field label={`${t2("tenant_name")} *`}>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <Field label={t2("tenant_phone")}>
                <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <Field label="البريد الإلكتروني / Email">
                <Input type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} placeholder="tenant@example.com" className="rounded-xl border-sage-200 bg-card" />
              </Field>
            </>
          )}

          <div className="grid grid-cols-1">
            <Field label={t2("rent_amount")}>
              <Input type="number" inputMode="decimal" min={0} step="0.001" value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
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
            {rentTiming !== initialRentTiming && (
              <div className="mt-2 rounded-xl border border-terracotta/40 bg-terracotta/10 px-3 py-2">
                <p className="text-[11px] font-semibold text-terracotta leading-relaxed">
                  {lang === "ar"
                    ? "⚠ تغيير نمط الدفع سيُعيد احتساب المتأخرات الظاهرة فوراً (دورة الشهر الحالية ستُضاف أو تُحذف). الإيصالات السابقة لن تتأثر."
                    : "⚠ Changing rent timing will immediately recompute visible arrears (current month cycle added/removed). Past receipts are unaffected."}
                </p>
              </div>
            )}
          </Field>



          <Field label="نوع العقد / Contract type">
            <div className="flex gap-1.5">
              {CONTRACT_TYPES.map((ct) => (
                <button key={ct} type="button" onClick={() => setContractType(ct)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                    contractType === ct ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                  }`}>{t2(ct as any)}</button>
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
                  }`}>{t2(rt as any)}</button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-sage-100 mt-1">
            <Field label="عربون / Deposit">
              <Input type="number" inputMode="decimal" min={0} step="0.001" value={securityDeposit}
                onChange={(e) => setSecurityDeposit(e.target.value)}
                className="rounded-xl border-sage-200 bg-card" />
            </Field>
            <Field label="حالة العربون">
              <div className="flex gap-1">
                {(["none", "held", "refunded"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setDepositStatus(s)}
                    className={`flex-1 px-2 py-2 rounded-xl text-[10px] font-semibold ${
                      depositStatus === s ? "bg-gradient-sage text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>{depLabel(s)}</button>
                ))}
              </div>
            </Field>
          </div>

          {/* تنويه: إدخال "آخر دفعة سابقة" و"متأخرات يدوية" متاحان فقط
              عند تسجيل المستأجر لأول مرة. بعد ذلك تنقص المتأخرات حصرًا
              عبر تسجيل إيصالات الدفع. */}


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

function depLabel(s: string) {
  return ({ none: "—", held: "محتجز", refunded: "مسترد" } as Record<string, string>)[s] || s;
}

