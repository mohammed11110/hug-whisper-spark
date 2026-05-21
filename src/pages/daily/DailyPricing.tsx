import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDailyCtx } from "./DailyLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Rule {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  price_per_night: number;
  priority: number;
  min_stay: number;
  unit_id: string | null;
}
interface Unit { id: string; name: string }

export default function DailyPricing() {
  const { buildingId } = useDailyCtx();
  const [rules, setRules] = useState<Rule[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", start_date: "", end_date: "", price_per_night: 30, priority: 1, min_stay: 1, unit_id: "all",
  });

  const load = async () => {
    if (!buildingId) return;
    const [rRes, uRes] = await Promise.all([
      supabase.from("daily_pricing_rules").select("*").eq("building_id", buildingId).order("priority", { ascending: false }),
      supabase.from("daily_units").select("id,name").eq("building_id", buildingId).eq("active", true),
    ]);
    setRules((rRes.data || []) as Rule[]);
    setUnits((uRes.data || []) as Unit[]);
  };
  useEffect(() => { load(); }, [buildingId]);

  const save = async () => {
    if (!buildingId || !form.name || !form.start_date || !form.end_date) {
      toast.error("أكمل الحقول"); return;
    }
    const { error } = await supabase.from("daily_pricing_rules").insert({
      building_id: buildingId,
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      price_per_night: Number(form.price_per_night),
      priority: Number(form.priority),
      min_stay: Number(form.min_stay),
      unit_id: form.unit_id === "all" ? null : form.unit_id,
    });
    if (error) return toast.error(error.message);
    toast.success("تمت الإضافة");
    setOpen(false);
    setForm({ ...form, name: "", start_date: "", end_date: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("daily_pricing_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const unitName = (id: string | null) => id ? units.find((u) => u.id === id)?.name || "—" : "كل الوحدات";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-sage-400 hover:bg-sage-500 text-white"><Plus className="w-4 h-4 ml-1" /> قاعدة تسعير</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>قاعدة تسعير جديدة</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="col-span-2"><Label>الاسم (مثال: عطلة العيد)</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>من</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>إلى</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <div><Label>السعر/ليلة</Label><Input type="number" step="0.5" value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: Number(e.target.value) })} /></div>
              <div><Label>الأولوية</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
              <div><Label>أقل إقامة</Label><Input type="number" value={form.min_stay} onChange={(e) => setForm({ ...form, min_stay: Number(e.target.value) })} /></div>
              <div><Label>الوحدة</Label>
                <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الوحدات</SelectItem>
                    {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={save} className="bg-sage-400 hover:bg-sage-500 text-white">حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-2xl border border-sage-200/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sage-100/60 text-sage-700">
            <tr>
              <th className="text-right p-3">الاسم</th>
              <th className="text-right p-3">الفترة</th>
              <th className="text-right p-3">الوحدة</th>
              <th className="text-right p-3">السعر</th>
              <th className="text-right p-3">الأولوية</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-sage-100">
                <td className="p-3 font-bold">{r.name}</td>
                <td className="p-3">{r.start_date} → {r.end_date}</td>
                <td className="p-3">{unitName(r.unit_id)}</td>
                <td className="p-3 font-bold text-sage-700">{r.price_per_night} ر.ع</td>
                <td className="p-3">{r.priority}</td>
                <td className="p-3"><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-burgundy" /></Button></td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد قواعد تسعير</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
