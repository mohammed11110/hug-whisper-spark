import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, X, Loader2 } from "lucide-react";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export function AddMaintenanceDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void }) {
  const t2 = useT2();
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; unit_number: string; building_id: string; tenant_name: string | null }[]>([]);
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("normal");
  const [vendor, setVendor] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: bs } = await supabase.from("buildings").select("id,name,name_en").order("name");
      setBuildings(((bs || []) as any[]).map((b) => ({ id: b.id, name: b.name || b.name_en })));
      const { data: us } = await supabase.from("units").select("id, unit_number, building_id, tenant_name");
      setUnits((us || []) as any);
    })();
  }, [open]);

  const filteredUnits = buildingId ? units.filter((u) => u.building_id === buildingId) : [];

  const submit = async () => {
    if (!buildingId || !title.trim()) return toast.error("…");
    setBusy(true);
    const u = units.find((x) => x.id === unitId);
    const { error } = await (supabase as any).from("maintenance_requests").insert({
      building_id: buildingId,
      unit_id: unitId || null,
      tenant_name: u?.tenant_name || null,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      vendor: vendor.trim() || null,
      cost: cost ? Number(cost) : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    setTitle(""); setDescription(""); setVendor(""); setCost(""); setPriority("normal"); setUnitId("");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600">{t2("new_request")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("building_name")}</Label>
            <Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setUnitId(""); }}>
              <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {buildingId && (
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("unit_number")}</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{filteredUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_number}{u.tenant_name ? ` — ${u.tenant_name}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("request_title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("request_description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-xl border-sage-200 bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("priority")}</Label>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold ${priority === p ? "bg-gradient-sage text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {t2(`priority_${p}` as any)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("vendor")}</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("cost")}</Label>
              <Input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>{t2("cancel")}</Button>
            <Button onClick={submit} disabled={busy || !buildingId || !title.trim()} className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground">{t2("save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
