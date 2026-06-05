import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Upload, Database, ShieldCheck } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveJsonUniversal } from "@/lib/nativeFiles";

const TABLES = ["buildings", "units", "payments", "expenses"] as const;

export default function Backup() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const ar = lang === "ar";
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: bs } = await supabase.from("buildings").select("*").eq("user_id", user.id);
      const ids = (bs || []).map((b: any) => b.id);
      const { data: us } = ids.length
        ? await supabase.from("units").select("*").in("building_id", ids)
        : { data: [] as any[] };
      const unitIds = (us || []).map((u: any) => u.id);
      const { data: ps } = unitIds.length
        ? await supabase.from("payments").select("*").in("unit_id", unitIds)
        : { data: [] as any[] };
      const { data: ex } = ids.length
        ? await supabase.from("expenses").select("*").in("building_id", ids)
        : { data: [] as any[] };

      const payload = {
        version: 1,
        exported_at: new Date().toISOString(),
        user_id: user.id,
        data: { buildings: bs || [], units: us || [], payments: ps || [], expenses: ex || [] },
      };
      await saveJsonUniversal(payload, `amlaki-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success(ar ? "تم تصدير النسخة الاحتياطية" : "Backup exported");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt);
      const d = parsed?.data;
      if (!d) throw new Error("Invalid file");

      // Buildings: insert with new ids? Easier: keep ids but set user_id to current user
      const buildings = (d.buildings || []).map((b: any) => ({ ...b, user_id: user.id }));
      if (buildings.length) {
        const { error } = await supabase.from("buildings").upsert(buildings, { onConflict: "id" });
        if (error) throw error;
      }
      if ((d.units || []).length) {
        const { error } = await supabase.from("units").upsert(d.units, { onConflict: "id" });
        if (error) throw error;
      }
      if ((d.payments || []).length) {
        const { error } = await supabase.from("payments").upsert(d.payments, { onConflict: "id" });
        if (error) throw error;
      }
      if ((d.expenses || []).length) {
        const { error } = await supabase.from("expenses").upsert(d.expenses, { onConflict: "id" });
        if (error) throw error;
      }
      toast.success(ar ? "تمت الاستعادة" : "Restore complete");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mobile-shell pb-24">
      <TopBar />
      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/settings" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{ar ? "النسخ الاحتياطي" : "Backup"}</h1>
      </div>

      <div className="px-5 pt-5 space-y-4">
        <div className="bg-gradient-sage text-primary-foreground rounded-3xl p-5 shadow-soft">
          <ShieldCheck className="h-8 w-8 mb-2 opacity-90" />
          <h2 className="font-black text-lg">{ar ? "بياناتك بأمان" : "Your data is safe"}</h2>
          <p className="text-xs opacity-90 mt-1">
            {ar
              ? "صدّر نسخة JSON كاملة من بياناتك إلى جهازك، أو استعد نسخة سابقة في أي وقت."
              : "Export a full JSON snapshot of your data to your device, or restore a previous one anytime."}
          </p>
        </div>

        <button
          disabled={busy}
          onClick={exportAll}
          className="w-full bg-card border border-sage-200/60 rounded-2xl p-5 shadow-soft flex items-center gap-4 hover:bg-sage-50 transition disabled:opacity-50"
        >
          <div className="p-3 rounded-xl bg-sage-100 text-sage-600"><Download className="h-5 w-5" /></div>
          <div className="text-start flex-1">
            <p className="font-bold text-sage-600">{ar ? "تصدير نسخة احتياطية" : "Export backup"}</p>
            <p className="text-xs text-muted-foreground">{ar ? "ملف JSON واحد لكل بياناتك" : "Single JSON file with all data"}</p>
          </div>
        </button>

        <label className="w-full bg-card border border-sage-200/60 rounded-2xl p-5 shadow-soft flex items-center gap-4 cursor-pointer hover:bg-sage-50 transition">
          <div className="p-3 rounded-xl bg-sage-100 text-sage-600"><Upload className="h-5 w-5" /></div>
          <div className="text-start flex-1">
            <p className="font-bold text-sage-600">{ar ? "استعادة من ملف" : "Restore from file"}</p>
            <p className="text-xs text-muted-foreground">{ar ? "اختر ملف JSON تم تصديره مسبقاً" : "Pick a previously exported JSON"}</p>
          </div>
          <input
            type="file"
            accept="application/json"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
        </label>

        <div className="bg-card border border-sage-200/60 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2 text-sage-600">
            <Database className="h-4 w-4" />
            <p className="text-sm font-bold">{ar ? "ما الذي يتم نسخه" : "What's included"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TABLES.map((t) => (
              <span key={t} className="text-[11px] font-mono bg-sage-100 text-sage-600 px-2 py-1 rounded-lg">{t}</span>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
