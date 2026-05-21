import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { calculateStay } from "@/lib/daily/pricing";
import { fillDailyTemplate, DEFAULT_DAILY_TEMPLATES } from "@/lib/daily/templates";
import { openWhatsApp } from "@/lib/whatsapp";

interface Booking {
  id: string;
  unit_id: string;
  guest_name: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  guests_count: number;
  total_price: number;
  paid_amount: number;
  source: string;
  status: string;
  notes: string | null;
}

interface DailyUnit {
  id: string; name: string; base_price: number; weekend_multiplier: number;
}

const STATUS_TONE: Record<string, string> = {
  confirmed: "bg-sage-200/60 text-sage-700",
  checked_in: "bg-sage-400 text-white",
  checked_out: "bg-slate-200/50 text-slate-700",
  cancelled: "bg-burgundy/10 text-burgundy",
  pending: "bg-gold/15 text-gold",
};
const STATUS_LABEL: Record<string, string> = {
  confirmed: "مؤكد", checked_in: "دخل", checked_out: "غادر", cancelled: "ملغي", pending: "معلق",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0,10);
};

export default function DailyBookings() {
  const { buildingId } = useDailyCtx();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [units, setUnits] = useState<DailyUnit[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    unit_id: "",
    guest_name: "",
    guest_phone: "",
    check_in: todayStr(),
    check_out: addDays(todayStr(), 1),
    guests_count: 1,
    source: "direct",
    notes: "",
  });

  const load = async () => {
    if (!buildingId) return;
    const [bRes, uRes, rRes] = await Promise.all([
      supabase.from("daily_bookings").select("*").eq("building_id", buildingId).order("check_in", { ascending: false }),
      supabase.from("daily_units").select("id,name,base_price,weekend_multiplier").eq("building_id", buildingId).eq("active", true),
      supabase.from("daily_pricing_rules").select("*").eq("building_id", buildingId),
    ]);
    setBookings((bRes.data || []) as Booking[]);
    setUnits((uRes.data || []) as DailyUnit[]);
    setRules(rRes.data || []);
  };
  useEffect(() => { load(); }, [buildingId]);

  const selectedUnit = units.find((u) => u.id === form.unit_id);
  const quote = useMemo(() => {
    if (!selectedUnit || !form.check_in || !form.check_out) return null;
    if (form.check_out <= form.check_in) return null;
    return calculateStay(form.check_in, form.check_out, selectedUnit, rules as any);
  }, [selectedUnit, form.check_in, form.check_out, rules]);

  const save = async () => {
    if (!buildingId || !form.unit_id || !form.guest_name || !quote) {
      toast.error("أكمل بيانات الحجز");
      return;
    }
    const { error } = await supabase.from("daily_bookings").insert({
      building_id: buildingId,
      unit_id: form.unit_id,
      guest_name: form.guest_name,
      guest_phone: form.guest_phone || null,
      check_in: form.check_in,
      check_out: form.check_out,
      guests_count: Number(form.guests_count) || 1,
      total_price: quote.total,
      source: form.source,
      notes: form.notes || null,
      status: "confirmed",
    });
    if (error) return toast.error(error.message.includes("booking_overlap") ? "هذه التواريخ محجوزة" : error.message);
    toast.success("تم الحفظ");
    setOpen(false);
    setForm({ ...form, guest_name: "", guest_phone: "", notes: "" });
    load();
  };

  const sendConfirmation = (b: Booking) => {
    if (!b.guest_phone) return toast.error("لا يوجد رقم هاتف");
    const unit = units.find((u) => u.id === b.unit_id);
    const tpl = DEFAULT_DAILY_TEMPLATES.find((t) => t.key === "booking_confirmation")!;
    const nights = (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000;
    const msg = fillDailyTemplate(tpl.body_ar, {
      guest: b.guest_name,
      unit: unit?.name || "",
      check_in: b.check_in,
      check_out: b.check_out,
      nights,
      total: `${b.total_price} ر.ع`,
    });
    openWhatsApp(b.guest_phone, msg);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("daily_bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const unitName = (id: string) => units.find((u) => u.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-sage-400 hover:bg-sage-500 text-white" disabled={units.length === 0}>
              <Plus className="w-4 h-4 ml-1" /> حجز جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>حجز جديد</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="col-span-2">
                <Label>الوحدة</Label>
                <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر وحدة" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>اسم الضيف</Label>
                <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>رقم الواتساب</Label>
                <Input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="+968..." />
              </div>
              <div>
                <Label>الدخول</Label>
                <Input type="date" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} />
              </div>
              <div>
                <Label>المغادرة</Label>
                <Input type="date" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} />
              </div>
              <div>
                <Label>عدد الضيوف</Label>
                <Input type="number" value={form.guests_count} onChange={(e) => setForm({ ...form, guests_count: Number(e.target.value) })} />
              </div>
              <div>
                <Label>المصدر</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">مباشر</SelectItem>
                    <SelectItem value="airbnb">Airbnb</SelectItem>
                    <SelectItem value="booking">Booking</SelectItem>
                    <SelectItem value="whatsapp">واتساب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>ملاحظات</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              {quote && (
                <div className="col-span-2 bg-sage-100/60 rounded-xl p-3 text-sm">
                  <div className="flex justify-between"><span>الليالي</span><b>{quote.nights}</b></div>
                  <div className="flex justify-between mt-1"><span>الإجمالي</span><b className="text-sage-700">{quote.total.toFixed(2)} ر.ع</b></div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={save} className="bg-sage-400 hover:bg-sage-500 text-white">احجز</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-2xl border border-sage-200/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sage-100/60 text-sage-700">
              <tr>
                <th className="text-right p-3">الضيف</th>
                <th className="text-right p-3">الوحدة</th>
                <th className="text-right p-3">الدخول</th>
                <th className="text-right p-3">المغادرة</th>
                <th className="text-right p-3">الإجمالي</th>
                <th className="text-right p-3">الحالة</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-sage-100">
                  <td className="p-3 font-bold">{b.guest_name}</td>
                  <td className="p-3">{unitName(b.unit_id)}</td>
                  <td className="p-3">{b.check_in}</td>
                  <td className="p-3">{b.check_out}</td>
                  <td className="p-3 font-bold text-sage-700">{Number(b.total_price).toFixed(2)}</td>
                  <td className="p-3">
                    <Select value={b.status} onValueChange={(v) => updateStatus(b.id, v)}>
                      <SelectTrigger className={`h-7 text-xs border-0 px-2 ${STATUS_TONE[b.status] || ""}`}><SelectValue>{STATUS_LABEL[b.status]}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    {b.guest_phone && (
                      <Button size="icon" variant="ghost" onClick={() => sendConfirmation(b)} title="إرسال تأكيد">
                        <MessageCircle className="w-4 h-4 text-sage-600" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد حجوزات بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
