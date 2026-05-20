import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";

const TYPES = ["tower", "compound", "villa", "commercial", "mixed"] as const;

export function AddBuildingDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void }) {
  const { t } = useI18n();
  const t2 = useT2();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [landlordNameEn, setLandlordNameEn] = useState("");
  const [type, setType] = useState<typeof TYPES[number]>("tower");
  const [floors, setFloors] = useState<string>("1");
  const [unitsCount, setUnitsCount] = useState<string>("0");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const guard = useUnsavedGuard({ open, onOpenChange });

  const submit = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    const { data: created, error } = await supabase.from("buildings").insert({
      user_id: user.id,
      name: name.trim(),
      name_en: nameEn.trim() || null,
      landlord_name: landlordName.trim() || null,
      landlord_name_en: landlordNameEn.trim() || null,
      type,
      floors: Math.max(1, parseInt(floors) || 1),
      city: city.trim() || null,
      address: address.trim() || null,
    } as any).select("id").single();
    if (error || !created) {
      setBusy(false);
      return toast.error(error?.message || "");
    }
    const n = Math.max(0, Math.min(500, parseInt(unitsCount) || 0));
    if (n > 0) {
      const rows = Array.from({ length: n }).map((_, i) => ({
        building_id: created.id,
        unit_number: String(i + 1),
        floor: 1,
        type: "apartment",
        status: "vacant",
        rent_amount: 0,
        rent_type: "monthly",
        due_day: 1,
      }));
      const { error: uErr } = await supabase.from("units").insert(rows);
      if (uErr) {
        if (uErr.message?.includes("unit_quota_exceeded")) {
          toast.error("تم إنشاء المبنى لكن لم تُضف الوحدات: تجاوزت حد الباقة. / Building created but units skipped: plan limit reached.");
        } else {
          toast.error(uErr.message);
        }
      }

    }
    await logActivity({
      entityType: "building",
      action: "created",
      entityId: created.id,
      entityLabel: name.trim(),
      buildingId: created.id,
      descriptionAr: `تمت إضافة مبنى جديد: ${name.trim()}${n > 0 ? ` (${n} وحدة)` : ""}`,
      descriptionEn: `New building added: ${nameEn.trim() || name.trim()}${n > 0 ? ` (${n} units)` : ""}`,
    });
    setBusy(false);
    toast.success("✓");
    setName(""); setNameEn(""); setLandlordName(""); setLandlordNameEn(""); setFloors("1"); setUnitsCount("0"); setCity(""); setAddress(""); setType("tower");
    onCreated?.();
    guard.markSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="max-w-[400px] rounded-3xl border-sage-200 bg-background">
        <DialogHeader>
          <DialogTitle className="text-sage-600 text-xl font-black">{t("add_building")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2" {...guard.formProps}>
          <Field label={t2("building_name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
          </Field>
          <Field label={t2("building_name_en")}>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t2("landlord_name")}>
              <Input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} dir="rtl" placeholder={t2("landlord_name_hint")} className="rounded-xl border-sage-200 bg-card" />
            </Field>
            <Field label={t2("landlord_name_en")}>
              <Input value={landlordNameEn} onChange={(e) => setLandlordNameEn(e.target.value)} dir="ltr" placeholder="Optional" className="rounded-xl border-sage-200 bg-card" />
            </Field>
          </div>
          <Field label={t2("building_type")}>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((tp) => (
                <button key={tp} type="button" onClick={() => setType(tp)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    type === tp ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                  }`}>{t2(tp)}</button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t2("floors")}>
              <Input type="number" inputMode="numeric" min={1} value={floors} onChange={(e) => setFloors(e.target.value)} onBlur={() => { if (!floors || parseInt(floors) < 1) setFloors("1"); }} className="rounded-xl border-sage-200 bg-card" />
            </Field>
            <Field label={t2("city")}>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
            </Field>
          </div>
          <Field label={t2("units_count")}>
            <Input type="number" inputMode="numeric" min={0} max={500} value={unitsCount}
              onChange={(e) => setUnitsCount(e.target.value)}
              onBlur={() => { if (!unitsCount || parseInt(unitsCount) < 0) setUnitsCount("0"); }}
              placeholder="0"
              className="rounded-xl border-sage-200 bg-card" />
            <p className="text-[11px] text-muted-foreground mt-1">{t2("units_count_hint")}</p>
          </Field>
          <Field label={t2("address")}>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
          </Field>
          <div className="flex gap-2 pt-2">
            <Button data-guard-ignore variant="outline" className="flex-1 rounded-xl border-sage-200" onClick={() => guard.handleOpenChange(false)}>{t2("cancel")}</Button>
            <Button data-guard-ignore onClick={submit} disabled={busy || !name.trim()} className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground font-semibold">{t2("save")}</Button>
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
