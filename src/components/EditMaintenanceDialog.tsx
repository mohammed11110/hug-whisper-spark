import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLogger";
import { toast } from "sonner";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

interface Req {
  id: string;
  building_id: string;
  title: string;
  description: string | null;
  priority: string;
  vendor: string | null;
  cost: number | null;
}

export function EditMaintenanceDialog({
  open,
  onOpenChange,
  request,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  request: Req | null;
  onSaved?: () => void;
}) {
  const t2 = useT2();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("normal");
  const [vendor, setVendor] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setTitle(request.title || "");
    setDescription(request.description || "");
    setPriority((request.priority as any) || "normal");
    setVendor(request.vendor || "");
    setCost(request.cost != null ? String(request.cost) : "");
  }, [request]);

  const submit = async () => {
    if (!request) return;
    if (!title.trim()) return toast.error(isAr ? "أكمل البيانات المطلوبة" : "Complete required fields");
    setBusy(true);
    const { error } = await (supabase as any)
      .from("maintenance_requests")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        vendor: vendor.trim() || null,
        cost: cost ? Number(cost) : null,
      })
      .eq("id", request.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isAr ? "تم الحفظ" : "Saved");
    await logActivity({
      entityType: "maintenance",
      action: "updated",
      buildingId: request.building_id,
      entityId: request.id,
      entityLabel: title.trim(),
      descriptionAr: `تعديل طلب الصيانة: ${title.trim()}`,
      descriptionEn: `Updated maintenance request: ${title.trim()}`,
      changes: { priority, cost: cost ? Number(cost) : null, vendor: vendor.trim() || null },
    });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600">{isAr ? "تعديل طلب الصيانة" : "Edit Maintenance Request"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
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
            <Button onClick={submit} disabled={busy || !title.trim()} className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground">{t2("save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
