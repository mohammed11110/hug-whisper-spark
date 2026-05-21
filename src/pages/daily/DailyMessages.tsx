import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDailyCtx } from "./DailyLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DEFAULT_DAILY_TEMPLATES } from "@/lib/daily/templates";

interface Tpl { id?: string; key: string; title_ar: string; body_ar: string }

export default function DailyMessages() {
  const { buildingId } = useDailyCtx();
  const [items, setItems] = useState<Tpl[]>([]);

  const load = async () => {
    if (!buildingId) return;
    const { data } = await supabase.from("daily_message_templates").select("*").eq("building_id", buildingId);
    const existing = (data || []) as Tpl[];
    const merged = DEFAULT_DAILY_TEMPLATES.map((d) => {
      const ex = existing.find((e) => e.key === d.key);
      return ex || { ...d };
    });
    setItems(merged);
  };
  useEffect(() => { load(); }, [buildingId]);

  const save = async (tpl: Tpl) => {
    if (!buildingId) return;
    const payload = { building_id: buildingId, key: tpl.key, title_ar: tpl.title_ar, body_ar: tpl.body_ar };
    const { error } = tpl.id
      ? await supabase.from("daily_message_templates").update(payload).eq("id", tpl.id)
      : await supabase.from("daily_message_templates").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    load();
  };

  const update = (key: string, patch: Partial<Tpl>) => setItems((prev) => prev.map((t) => t.key === key ? { ...t, ...patch } : t));

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {items.map((t) => (
        <div key={t.key} className="bg-white rounded-2xl border border-sage-200/40 p-5">
          <div className="mb-3">
            <Label>العنوان</Label>
            <Input value={t.title_ar} onChange={(e) => update(t.key, { title_ar: e.target.value })} />
          </div>
          <div className="mb-3">
            <Label>الرسالة</Label>
            <Textarea rows={6} value={t.body_ar} onChange={(e) => update(t.key, { body_ar: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">المتغيرات: {"{guest} {unit} {check_in} {check_out} {nights} {total} {door_code} {address}"}</p>
          </div>
          <Button onClick={() => save(t)} className="bg-sage-400 hover:bg-sage-500 text-white">حفظ</Button>
        </div>
      ))}
    </div>
  );
}
