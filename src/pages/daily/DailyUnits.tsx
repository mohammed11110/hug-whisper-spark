import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDailyCtx } from "./DailyLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

interface Unit {
  id: string;
  name: string;
  type: string;
  bedrooms: number;
  max_guests: number;
  base_price: number;
  weekend_multiplier: number;
  door_code: string | null;
  notes: string | null;
  active: boolean;
  source_unit_id?: string | null;
}

const emptyForm: Partial<Unit> = {
  name: "",
  type: "apartment",
  bedrooms: 1,
  max_guests: 2,
  base_price: 25,
  weekend_multiplier: 1.3,
  door_code: "",
  notes: "",
  active: true,
};

interface VacantUnit {
  id: string;
  unit_number: string;
  type: string;
  floor: number;
  rent_amount: number;
}

export default function DailyUnits() {
  const { buildingId } = useDailyCtx();
  const [rows, setRows] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Unit>>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [vacant, setVacant] = useState<VacantUnit[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  const load = async () => {
    if (!buildingId) return;
    const { data } = await supabase
      .from("daily_units")
      .select("*")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false });
    setRows((data || []) as Unit[]);
  };
  useEffect(() => {
    load();
  }, [buildingId]);

  const save = async () => {
    if (!buildingId || !form.name) return;
    const payload: any = {
      building_id: buildingId,
      name: form.name,
      type: form.type,
      bedrooms: Number(form.bedrooms) || 1,
      max_guests: Number(form.max_guests) || 2,
      base_price: Number(form.base_price) || 0,
      weekend_multiplier: Number(form.weekend_multiplier) || 1,
      door_code: form.door_code || null,
      notes: form.notes || null,
      active: form.active !== false,
    };
    const { error } = editId
      ? await supabase.from("daily_units").update(payload).eq("id", editId)
      : await supabase.from("daily_units").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editId ? "تم التحديث" : "تمت إضافة الوحدة");
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    load();
  };

  const edit = (u: Unit) => {
    setForm(u);
    setEditId(u.id);
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("حذف الوحدة؟")) return;
    const { error } = await supabase.from("daily_units").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    load();
  };

  const openImport = async () => {
    if (!buildingId) return;
    setPicked({});
    setImportOpen(true);
    // Vacant units = status='vacant' AND not already imported as daily_unit
    const alreadyImported = new Set(rows.map((r: any) => r.source_unit_id).filter(Boolean));
    const { data, error } = await supabase
      .from("units")
      .select("id,unit_number,type,floor,rent_amount,status")
      .eq("building_id", buildingId)
      .eq("status", "vacant")
      .order("unit_number");
    if (error) return toast.error(error.message);
    setVacant(((data || []) as any[]).filter((u) => !alreadyImported.has(u.id)) as VacantUnit[]);
  };

  const importVacant = async () => {
    if (!buildingId) return;
    const ids = Object.entries(picked).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return toast.error("اختر وحدة واحدة على الأقل");
    setImporting(true);
    const payload = vacant
      .filter((u) => ids.includes(u.id))
      .map((u) => ({
        building_id: buildingId,
        source_unit_id: u.id,
        name: u.unit_number,
        type: u.type || "apartment",
        floor: u.floor || 1,
        bedrooms: 1,
        max_guests: 2,
        base_price: u.rent_amount ? Math.max(5, Math.round((Number(u.rent_amount) / 30) * 1.5)) : 25,
        weekend_multiplier: 1.3,
        active: true,
      }));
    const { error } = await supabase.from("daily_units").insert(payload);
    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`تمت إضافة ${ids.length} وحدة`);
    setImportOpen(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          className="border-sage-300 text-sage-700 hover:bg-sage-100"
          onClick={openImport}
        >
          <Download className="w-4 h-4 ml-1" /> استيراد من الشاغرة
        </Button>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>

          <DialogTrigger asChild>
            <Button className="bg-sage-400 hover:bg-sage-500 text-white">
              <Plus className="w-4 h-4 ml-1" /> وحدة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "تعديل الوحدة" : "وحدة جديدة"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="col-span-2">
                <Label>الاسم</Label>
                <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>النوع</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="studio">استوديو</option>
                  <option value="apartment">شقة</option>
                  <option value="villa">فيلا</option>
                  <option value="chalet">شاليه</option>
                </select>
              </div>
              <div>
                <Label>غرف النوم</Label>
                <Input type="number" value={form.bedrooms ?? 1} onChange={(e) => setForm({ ...form, bedrooms: Number(e.target.value) })} />
              </div>
              <div>
                <Label>أقصى عدد ضيوف</Label>
                <Input type="number" value={form.max_guests ?? 2} onChange={(e) => setForm({ ...form, max_guests: Number(e.target.value) })} />
              </div>
              <div>
                <Label>سعر الليلة (ر.ع)</Label>
                <Input type="number" step="0.5" value={form.base_price ?? 0} onChange={(e) => setForm({ ...form, base_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>مضاعِف نهاية الأسبوع</Label>
                <Input type="number" step="0.1" value={form.weekend_multiplier ?? 1.3} onChange={(e) => setForm({ ...form, weekend_multiplier: Number(e.target.value) })} />
              </div>
              <div>
                <Label>رمز الباب</Label>
                <Input value={form.door_code || ""} onChange={(e) => setForm({ ...form, door_code: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>ملاحظات</Label>
                <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} className="bg-sage-400 hover:bg-sage-500 text-white">حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>استيراد وحدات شاغرة</DialogTitle>
            </DialogHeader>
            <div className="py-2 max-h-[60vh] overflow-y-auto">
              {vacant.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-sage-200/60 rounded-2xl">
                  لا توجد وحدات شاغرة قابلة للاستيراد
                </div>
              ) : (
                <ul className="space-y-2">
                  {vacant.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-3 bg-cream rounded-xl px-3 py-2 border border-sage-200/40"
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <Checkbox
                          checked={!!picked[u.id]}
                          onCheckedChange={(v) => setPicked((p) => ({ ...p, [u.id]: !!v }))}
                        />
                        <div className="text-sm">
                          <div className="font-bold text-sage-700">{u.unit_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.type} · الطابق {u.floor}
                            {u.rent_amount > 0 && ` · شهري ${u.rent_amount} ر.ع`}
                          </div>
                        </div>
                      </label>
                      {u.rent_amount > 0 && (
                        <span className="text-xs text-sage-600 font-bold">
                          ≈ {Math.max(5, Math.round((Number(u.rent_amount) / 30) * 1.5))} ر.ع/ليلة
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {vacant.length > 0 && (
                <p className="text-[11px] text-muted-foreground mt-3">
                  السعر المقترح = (الإيجار الشهري ÷ 30) × 1.5، قابل للتعديل لاحقاً.
                </p>
              )}
            </div>
            {vacant.length > 0 && (
              <DialogFooter>
                <Button
                  onClick={importVacant}
                  disabled={importing}
                  className="bg-sage-400 hover:bg-sage-500 text-white"
                >
                  استيراد المختارة
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>


      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((u) => (
          <div key={u.id} className="bg-card rounded-2xl border border-sage-200/40 p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-sage-700">{u.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{u.type} · {u.bedrooms} غرفة · حتى {u.max_guests} ضيوف</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => edit(u)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(u.id)}><Trash2 className="w-4 h-4 text-burgundy" /></Button>
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-2xl font-black text-sage-700">{u.base_price}</span>
              <span className="text-xs text-muted-foreground">ر.ع / ليلة</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">نهاية الأسبوع × {u.weekend_multiplier}</div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12 text-muted-foreground border-2 border-dashed border-sage-200/60 rounded-2xl">
            لا توجد وحدات بعد — ابدأ بإضافة أول وحدة
          </div>
        )}
      </div>
    </div>
  );
}
