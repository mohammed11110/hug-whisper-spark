import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Trash2, RotateCcw, AlertTriangle, CheckSquare, X } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { useAppSettings } from "@/lib/appSettings";
import { PinDialog } from "@/components/PinDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

interface Row {
  id: string;
  amount: number;
  payment_date: string;
  receipt_number: string | null;
  deleted_at: string;
  unit_id: string;
  unit_number: string;
  building_name: string;
  tenant_name: string | null;
}

export default function PaymentsTrash() {
  const { lang } = useI18n();
  const t2 = useT2();
  const { format } = useCurrency();
  const { settings } = useAppSettings();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPurge, setPendingPurge] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkPinOpen, setBulkPinOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("id, amount, payment_date, receipt_number, deleted_at, unit_id")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(500);
    const unitIds = Array.from(new Set((data || []).map((p: any) => p.unit_id)));
    const { data: units } = unitIds.length
      ? await supabase.from("units").select("id, unit_number, tenant_name, building_id").in("id", unitIds)
      : { data: [] as any[] };
    const buildingIds = Array.from(new Set((units || []).map((u: any) => u.building_id)));
    const { data: builds } = buildingIds.length
      ? await supabase.from("buildings").select("id, name, name_en").in("id", buildingIds)
      : { data: [] as any[] };
    const uMap = new Map((units || []).map((u: any) => [u.id, u]));
    const bMap = new Map((builds || []).map((b: any) => [b.id, b]));
    setRows((data || []).map((p: any) => {
      const u: any = uMap.get(p.unit_id);
      const b: any = u ? bMap.get(u.building_id) : null;
      return {
        id: p.id,
        unit_id: p.unit_id,
        amount: Number(p.amount),
        payment_date: p.payment_date,
        receipt_number: p.receipt_number,
        deleted_at: p.deleted_at,
        unit_number: u?.unit_number ?? "—",
        tenant_name: u?.tenant_name ?? null,
        building_name: b?.name || b?.name_en || "—",
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // auto-purge older than 30 days
  useEffect(() => {
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
    supabase.from("payments").delete().lt("deleted_at", cutoff).not("deleted_at", "is", null).then(() => {});
  }, []);

  const restore = async (id: string) => {
    const target = rows.find((r) => r.id === id);
    const { error } = await supabase.from("payments").update({ deleted_at: null }).eq("id", id);
    if (error) return toast.error(error.message);
    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(target?.unit_id ?? null);
    if (target) {
      logActivity({
        entityType: "payment",
        action: "restored",
        entityId: id,
        entityLabel: target.receipt_number || target.tenant_name || target.unit_number,
        descriptionAr: `استرجاع إيصال استلام بقيمة ${target.amount} — ${target.tenant_name || target.unit_number}`,
        descriptionEn: `Receipt restored (amount ${target.amount}) — ${target.tenant_name || target.unit_number}`,
      });
    }
    toast.success(lang === "ar" ? "تم الاسترجاع" : "Restored");
    load();
  };

  const purge = async () => {
    if (!pendingPurge) return;
    const target = rows.find((r) => r.id === pendingPurge);
    const { error } = await supabase.from("payments").delete().eq("id", pendingPurge);
    setPendingPurge(null);
    if (error) return toast.error(error.message);
    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(target?.unit_id ?? null);
    if (target) {
      logActivity({
        entityType: "payment",
        action: "deleted",
        entityId: target.id,
        entityLabel: target.receipt_number || target.tenant_name || target.unit_number,
        descriptionAr: `حذف نهائي لإيصال بقيمة ${target.amount} — ${target.tenant_name || target.unit_number}`,
        descriptionEn: `Receipt permanently deleted (amount ${target.amount})`,
      });
    }
    toast.success(lang === "ar" ? "تم الحذف نهائياً" : "Permanently deleted");
    load();
  };

  const onPurgeClick = (id: string) => {
    if (settings.deletePin) setPinFor(id);
    else setPendingPurge(id);
  };

  const daysLeft = (deletedAt: string) => {
    const ms = new Date(deletedAt).getTime() + 30 * 86400_000 - Date.now();
    return Math.max(0, Math.ceil(ms / 86400_000));
  };

  // ---- Selection helpers ----
  const enterSelectionMode = () => { setSelectionMode(true); setSelectedIds(new Set()); };
  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map((r) => r.id)));
  };

  const bulkRestore = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { error } = await supabase.from("payments").update({ deleted_at: null }).in("id", ids);
    if (error) return toast.error(error.message);
    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(null);
    logActivity({
      entityType: "payment",
      action: "restored",
      entityLabel: lang === "ar" ? `${ids.length} دفعات` : `${ids.length} payments`,
      descriptionAr: `استرجاع جماعي لعدد ${ids.length} دفعة`,
      descriptionEn: `Bulk restored ${ids.length} payments`,
    });
    toast.success(lang === "ar" ? `تم استرجاع ${ids.length}` : `Restored ${ids.length}`);
    exitSelectionMode();
    load();
  };

  const bulkPurge = async () => {
    const ids = Array.from(selectedIds);
    setBulkConfirmOpen(false);
    if (ids.length === 0) return;
    const { error } = await supabase.from("payments").delete().in("id", ids);
    if (error) return toast.error(error.message);
    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(null);
    logActivity({
      entityType: "payment",
      action: "deleted",
      entityLabel: lang === "ar" ? `${ids.length} دفعات` : `${ids.length} payments`,
      descriptionAr: `حذف نهائي جماعي لعدد ${ids.length} دفعة`,
      descriptionEn: `Bulk permanently deleted ${ids.length} payments`,
    });
    toast.success(lang === "ar" ? `تم حذف ${ids.length} نهائياً` : `Permanently deleted ${ids.length}`);
    exitSelectionMode();
    load();
  };

  const onBulkPurgeClick = () => {
    if (selectedIds.size === 0) return;
    if (settings.deletePin) setBulkPinOpen(true);
    else setBulkConfirmOpen(true);
  };

  return (
    <div className="mobile-shell min-h-screen pb-24 bg-background">
      <TopBar />
      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/payments" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600 flex-1">{lang === "ar" ? "سلة المحذوفات" : "Recycle bin"}</h1>
        {!selectionMode ? (
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-xl border-sage-300 text-sage-600"
            disabled={rows.length === 0}
            onClick={enterSelectionMode}
          >
            <CheckSquare className="h-4 w-4 me-1" />
            {lang === "ar" ? "تحديد" : "Select"}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-9 rounded-xl text-sage-600" onClick={exitSelectionMode}>
            <X className="h-4 w-4 me-1" />
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </Button>
        )}
      </div>
      <p className="px-5 text-xs text-muted-foreground mt-1">
        {lang === "ar" ? "تُحذف الدفعات نهائياً بعد 30 يوماً" : "Items are permanently deleted after 30 days"}
      </p>

      {selectionMode && (
        <div className="mx-5 mt-3 bg-sage-100/60 border border-sage-200/60 rounded-2xl p-3 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            <span className="text-sm font-bold text-sage-700">
              {lang === "ar" ? "تحديد الكل" : "Select all"}
            </span>
          </label>
          <span className="text-xs text-sage-600">
            {lang === "ar" ? `تم تحديد ${selectedIds.size} من ${rows.length}` : `${selectedIds.size} of ${rows.length} selected`}
          </span>
          <div className="ms-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg border-sage-300 text-sage-600 disabled:opacity-50"
              disabled={selectedIds.size === 0}
              onClick={bulkRestore}
            >
              <RotateCcw className="h-3.5 w-3.5 me-1" />
              {lang === "ar" ? "استرجاع المحدد" : "Restore selected"}
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-lg bg-burgundy text-white hover:bg-burgundy/90 disabled:opacity-50"
              disabled={selectedIds.size === 0}
              onClick={onBulkPurgeClick}
            >
              <Trash2 className="h-3.5 w-3.5 me-1" />
              {lang === "ar" ? "حذف المحدد" : "Delete selected"}
            </Button>
          </div>
        </div>
      )}

      <div className="px-5 mt-4 space-y-2.5">
        {loading ? (
          <p className="text-center text-sage-500 py-12 text-sm">…</p>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex p-4 rounded-3xl bg-sage-100 mb-3">
              <Trash2 className="h-8 w-8 text-sage-400" />
            </div>
            <p className="font-bold text-sage-600">{lang === "ar" ? "السلة فارغة" : "Bin is empty"}</p>
          </div>
        ) : (
          rows.map((r) => {
            const isSelected = selectedIds.has(r.id);
            return (
              <div
                key={r.id}
                onClick={selectionMode ? () => toggleOne(r.id) : undefined}
                className={`bg-card border rounded-2xl p-4 shadow-soft transition-colors ${
                  selectionMode ? "cursor-pointer" : ""
                } ${
                  isSelected
                    ? "border-sage-400 bg-sage-100/40"
                    : "border-sage-200/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  {selectionMode && (
                    <div className="pt-1">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(r.id)} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sage-600 truncate">{r.building_name} · {r.unit_number}</div>
                    {r.tenant_name && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.tenant_name}</p>}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-sage-500">
                      <span>{r.payment_date}</span>
                      {r.receipt_number && <span className="font-mono">{r.receipt_number}</span>}
                    </div>
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-terracotta/10 text-terracotta">
                      <AlertTriangle className="h-3 w-3" />
                      {lang === "ar" ? `يُحذف خلال ${daysLeft(r.deleted_at)} يوم` : `Auto-delete in ${daysLeft(r.deleted_at)}d`}
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="font-black text-sage-600 whitespace-nowrap">{format(r.amount)}</p>
                    {!selectionMode && (
                      <div className="flex gap-1 mt-2 justify-end">
                        <Button size="sm" variant="outline" className="h-8 rounded-lg border-sage-300 text-sage-600" onClick={() => restore(r.id)}>
                          <RotateCcw className="h-3.5 w-3.5 me-1" />
                          {lang === "ar" ? "استرجاع" : "Restore"}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-burgundy hover:bg-burgundy/10" onClick={() => onPurgeClick(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
      <ConfirmDeleteDialog
        open={!!pendingPurge}
        onOpenChange={(o) => !o && setPendingPurge(null)}
        onConfirm={purge}
        title={lang === "ar" ? "حذف نهائي؟" : "Permanently delete?"}
        description={lang === "ar" ? "لا يمكن التراجع عن هذا الإجراء" : "This action cannot be undone"}
      />
      <PinDialog
        open={!!pinFor}
        onOpenChange={(o) => !o && setPinFor(null)}
        expectedPin={settings.deletePin || ""}
        onSuccess={() => { setPendingPurge(pinFor); setPinFor(null); }}
        title={lang === "ar" ? "تأكيد الحذف النهائي" : "Confirm permanent delete"}
      />
      <ConfirmDeleteDialog
        open={bulkConfirmOpen}
        onOpenChange={(o) => !o && setBulkConfirmOpen(false)}
        onConfirm={bulkPurge}
        title={lang === "ar" ? `حذف ${selectedIds.size} نهائياً؟` : `Permanently delete ${selectedIds.size}?`}
        description={lang === "ar" ? "لا يمكن التراجع عن هذا الإجراء" : "This action cannot be undone"}
      />
      <PinDialog
        open={bulkPinOpen}
        onOpenChange={(o) => !o && setBulkPinOpen(false)}
        expectedPin={settings.deletePin || ""}
        onSuccess={() => { setBulkPinOpen(false); setBulkConfirmOpen(true); }}
        title={lang === "ar" ? "تأكيد الحذف النهائي" : "Confirm permanent delete"}
      />
    </div>
  );
}
