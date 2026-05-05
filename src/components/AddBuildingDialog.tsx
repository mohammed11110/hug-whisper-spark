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

const TYPES = ["tower", "compound", "villa", "commercial", "mixed"] as const;

export function AddBuildingDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void }) {
  const { t } = useI18n();
  const t2 = useT2();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [type, setType] = useState<typeof TYPES[number]>("tower");
  const [floors, setFloors] = useState(1);
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("buildings").insert({
      user_id: user.id,
      name: name.trim(),
      name_en: nameEn.trim() || null,
      type,
      floors,
      city: city.trim() || null,
      address: address.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    setName(""); setNameEn(""); setFloors(1); setCity(""); setAddress(""); setType("tower");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] rounded-3xl border-sage-200 bg-background">
        <DialogHeader>
          <DialogTitle className="text-sage-600 text-xl font-black">{t("add_building")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Field label={t2("building_name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
          </Field>
          <Field label={t2("building_name_en")}>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
          </Field>
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
              <Input type="number" min={1} value={floors} onChange={(e) => setFloors(parseInt(e.target.value) || 1)} className="rounded-xl border-sage-200 bg-card" />
            </Field>
            <Field label={t2("city")}>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
            </Field>
          </div>
          <Field label={t2("address")}>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
          </Field>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl border-sage-200" onClick={() => onOpenChange(false)}>{t2("cancel")}</Button>
            <Button onClick={submit} disabled={busy || !name.trim()} className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground font-semibold">{t2("save")}</Button>
          </div>
        </div>
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
