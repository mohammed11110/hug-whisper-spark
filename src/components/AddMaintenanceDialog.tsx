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
import { logActivity } from "@/lib/activityLogger";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { toast } from "sonner";
import { Camera, X, Loader2 } from "lucide-react";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export function AddMaintenanceDialog({ open, onOpenChange, onCreated, presetBuildingId, presetUnitId }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void; presetBuildingId?: string; presetUnitId?: string }) {
  const t2 = useT2();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; unit_number: string; building_id: string; tenant_name: string | null }[]>([]);
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("normal");
  const [vendor, setVendor] = useState("");
  const [cost, setCost] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const guard = useUnsavedGuard({ open, onOpenChange });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: bs } = await supabase.from("buildings").select("id,name,name_en").order("name");
      setBuildings(((bs || []) as any[]).map((b) => ({ id: b.id, name: b.name || b.name_en })));
      const { data: us } = await supabase.from("units").select("id, unit_number, building_id, tenant_name");
      setUnits((us || []) as any);
      if (presetBuildingId) setBuildingId(presetBuildingId);
      if (presetUnitId) setUnitId(presetUnitId);
    })();
  }, [open, presetBuildingId, presetUnitId]);

  const filteredUnits = buildingId ? units.filter((u) => u.building_id === buildingId) : [];

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const { data: ud } = await supabase.auth.getUser();
    const uid = ud.user?.id;
    if (!uid) { setUploading(false); return; }
    const paths: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("maintenance-photos").upload(path, file, { upsert: false });
      if (error) { toast.error(error.message); continue; }
      // Store the storage path (bucket is private). Display code resolves a
      // short-lived signed URL via resolveMaintenancePhotoUrl().
      paths.push(path);
    }
    setPhotos((p) => [...p, ...paths]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePhoto = (url: string) => setPhotos((p) => p.filter((x) => x !== url));

  const submit = async () => {
    if (!buildingId || !title.trim()) return toast.error(isAr ? "أكمل البيانات المطلوبة" : "Complete required fields");
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
      photos,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isAr ? "تم حفظ الطلب" : "Request saved");
    await logActivity({
      entityType: "maintenance",
      action: "created",
      buildingId,
      entityLabel: title.trim(),
      descriptionAr: `طلب صيانة جديد: ${title.trim()}${u?.unit_number ? ` — وحدة ${u.unit_number}` : ""}`,
      descriptionEn: `New maintenance request: ${title.trim()}${u?.unit_number ? ` — unit ${u.unit_number}` : ""}`,
      changes: { priority, cost: cost ? Number(cost) : null },
    });
    setTitle(""); setDescription(""); setVendor(""); setCost(""); setPriority("normal"); setUnitId(""); setPhotos([]);
    onCreated?.();
    guard.markSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="rounded-2xl max-w-md md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600">{t2("new_request")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2" {...guard.formProps}>
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
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{isAr ? "صور المشكلة" : "Photos"}</Label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadPhotos(e.target.files)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full h-11 rounded-xl border-2 border-dashed border-sage-300/60 bg-sage-100/30 text-sage-600 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-sage-100/60 disabled:opacity-60">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploading ? (isAr ? "جاري الرفع..." : "Uploading...") : (isAr ? "إضافة صور" : "Add photos")}
            </button>
            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {photos.map((url) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-sage-200">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(url)}
                      className="absolute top-0.5 end-0.5 h-5 w-5 rounded-full bg-burgundy text-white flex items-center justify-center">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button data-guard-ignore variant="outline" className="flex-1 rounded-xl" onClick={() => guard.handleOpenChange(false)}>{t2("cancel")}</Button>
            <Button data-guard-ignore onClick={submit} disabled={busy || !buildingId || !title.trim()} className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground">{t2("save")}</Button>
          </div>
        </div>
        {guard.ConfirmDiscardUI}
      </DialogContent>
    </Dialog>
  );
}
