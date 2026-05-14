import { useState } from "react";
import { Trash2, ShieldAlert } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const tr = (lang: string, ar: string, en: string) => (lang === "ar" ? ar : en);

export function DeleteAccountSection() {
  const { lang } = useI18n();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const expected = lang === "ar" ? "حذف" : "DELETE";

  const handleDelete = async () => {
    if (confirm.trim() !== expected) {
      toast.error(tr(lang, `اكتب «${expected}» للتأكيد`, `Type "${expected}" to confirm`));
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("delete-account", {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;
      toast.success(tr(lang, "تم حذف حسابك", "Your account has been deleted"));
      await signOut();
      navigate("/welcome");
    } catch (e: any) {
      toast.error(e.message || tr(lang, "تعذر حذف الحساب", "Failed to delete account"));
    } finally {
      setBusy(false);
      setOpen(false);
      setConfirm("");
    }
  };

  return (
    <section className="px-5 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="h-4 w-4 text-burgundy" />
        <h2 className="font-bold text-burgundy text-sm">{tr(lang, "منطقة الخطر", "Danger zone")}</h2>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-2xl bg-card border border-burgundy/30 p-4 shadow-soft hover:bg-burgundy/5 transition"
      >
        <div className="p-2 rounded-xl bg-burgundy/10 text-burgundy"><Trash2 className="h-4 w-4" /></div>
        <div className="flex-1 text-start">
          <p className="font-bold text-sm text-burgundy">{tr(lang, "حذف الحساب نهائياً", "Delete account permanently")}</p>
          <p className="text-[11px] text-burgundy/70">
            {tr(lang, "حذف جميع بياناتك (المباني، الوحدات، المستأجرين، المدفوعات) ولا يمكن التراجع.", "Removes all your data (buildings, units, tenants, payments). Cannot be undone.")}
          </p>
        </div>
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-[380px] rounded-3xl border-burgundy/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-burgundy">{tr(lang, "حذف الحساب نهائياً", "Permanently delete account")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {tr(lang,
                  "سيتم حذف حسابك وكل بياناتك بشكل دائم ولا يمكن استرجاعها.",
                  "Your account and all your data will be permanently deleted and cannot be recovered.")}
              </span>
              <span className="block font-semibold text-burgundy">
                {tr(lang, `للتأكيد اكتب: ${expected}`, `Type ${expected} to confirm`)}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={expected}
            className="rounded-xl border-burgundy/30 text-center font-bold"
          />
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl mt-0">{tr(lang, "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={busy}
              className="flex-1 rounded-xl bg-burgundy hover:bg-burgundy/90 text-primary-foreground"
            >
              {busy ? tr(lang, "جارٍ...", "Deleting...") : tr(lang, "حذف نهائي", "Delete forever")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
