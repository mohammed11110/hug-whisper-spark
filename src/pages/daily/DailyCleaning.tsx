import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDailyCtx } from "./DailyLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Task {
  id: string;
  unit_id: string;
  scheduled_date: string;
  status: string;
  checklist: { key: string; label: string; done: boolean }[];
  assignee_name: string | null;
  notes: string | null;
}
interface Unit { id: string; name: string }

export default function DailyCleaning() {
  const { buildingId } = useDailyCtx();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const load = async () => {
    if (!buildingId) return;
    const [tRes, uRes] = await Promise.all([
      supabase.from("daily_cleaning_tasks").select("*").eq("building_id", buildingId).order("scheduled_date", { ascending: false }),
      supabase.from("daily_units").select("id,name").eq("building_id", buildingId),
    ]);
    setTasks(((tRes.data || []) as unknown) as Task[]);
    setUnits((uRes.data || []) as Unit[]);
  };
  useEffect(() => { load(); }, [buildingId]);

  const toggle = async (task: Task, idx: number) => {
    const updated = task.checklist.map((c, i) => i === idx ? { ...c, done: !c.done } : c);
    const allDone = updated.every((c) => c.done);
    const patch: any = { checklist: updated };
    if (allDone && task.status !== "completed") {
      patch.status = "completed";
      patch.completed_at = new Date().toISOString();
    } else if (!allDone && task.status === "completed") {
      patch.status = "in_progress";
      patch.completed_at = null;
    }
    const { error } = await supabase.from("daily_cleaning_tasks").update(patch).eq("id", task.id);
    if (error) return toast.error(error.message);
    load();
  };

  const unitName = (id: string) => units.find((u) => u.id === id)?.name || "—";

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tasks.map((t) => {
        const done = t.checklist.filter((c) => c.done).length;
        return (
          <div key={t.id} className={`bg-white rounded-2xl border p-5 ${t.status === "completed" ? "border-sage-300 bg-sage-50/60" : "border-sage-200/40"}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-black text-sage-700">{unitName(t.unit_id)}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t.scheduled_date}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg font-bold ${t.status === "completed" ? "bg-sage-300/40 text-sage-700" : "bg-terracotta/15 text-terracotta"}`}>
                {done}/{t.checklist.length}
              </span>
            </div>
            <ul className="space-y-2">
              {t.checklist.map((c, i) => (
                <li key={c.key} className="flex items-center gap-2">
                  <Checkbox checked={c.done} onCheckedChange={() => toggle(t, i)} />
                  <span className={`text-sm ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {tasks.length === 0 && (
        <div className="md:col-span-2 lg:col-span-3 text-center py-12 text-muted-foreground border-2 border-dashed border-sage-200/60 rounded-2xl">
          لا توجد مهام تنظيف — تُنشأ تلقائياً عند مغادرة الضيف
        </div>
      )}
    </div>
  );
}
