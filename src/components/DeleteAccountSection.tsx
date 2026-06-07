import { useState } from "react";
import { Trash2, ShieldAlert, Clock } from "lucide-react";
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
    if (confirm.trim().toUpperCase() !== expected.toUpperCase()) {
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
      toast.success(tr(
        lang,
        "تم إيقاف الحساب — يمكن استعادة بياناتك خلال 30 يوماً",
        "Account deactivated — your data is recoverable for 30 days",
      ));
      await signOut();
      navigate("/welcome");
    } catch (e: any) {
      toast.error(e.message || tr(lang, "تعذر إيقاف الحساب", "Failed to deactivate account"));
    } finally {
      setBusy(false);
      setOpen(false);
      setConfirm("");
    }
  };

  return (
    <section className="px-5 md:px-8 lg:px-12 mt-6">
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
          <p className="font-bold text-sm text-burgundy">{tr(lang, "حذف الحساب", "Delete account")}</p>
          <p className="text-[11px] text-burgundy/70 flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {tr(lang, "بياناتك قابلة للاسترجاع خلال 30 يوماً", "Your data is recoverable for 30 days")}
          </p>
        </div>
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-[400px] rounded-3xl border-burgundy/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-burgundy flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              {tr(lang, "تأكيد حذف الحساب", "Confirm account deletion")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-start">
                <div className="rounded-xl bg-burgundy/10 border border-burgundy/20 p-3 text-burgundy text-[12px] leading-relaxed">
                  <p className="font-bold mb-1">
                    {tr(lang, "⚠️ تحذير مهم", "⚠️ Important warning")}
                  </p>
                  <p>
                    {tr(lang,
                      "سيتم إيقاف حسابك فوراً وفقدان الوصول إلى المباني والوحدات والمدفوعات والعقود.",
                      "Your account will be deactivated immediately and you will lose access to your buildings, units, payments, and contracts.",
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-sage-50 border border-sage-200 p-3 text-sage-700 text-[12px] leading-relaxed flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 shrink-0 text-sage-600" />
                  <div>
                    <p className="font-bold mb-1">
                      {tr(lang, "نافذة استرجاع 30 يوماً", "30-day recovery window")}
                    </p>
                    <p>
                      {tr(lang,
                        "بياناتك ستبقى محفوظة لمدة 30 يوماً. سجّل الدخول خلال هذه الفترة لاستعادة حسابك. بعدها سيتم الحذف نهائياً.",
                        "Your data stays safe for 30 days. Sign in within this window to restore your account. After that, it will be permanently purged.",
                      )}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-burgundy text-sm">
                  {tr(lang, `للتأكيد، اكتب: ${expected}`, `To confirm, type: ${expected}`)}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={expected}
            className="rounded-xl border-burgundy/30 text-center font-bold tracking-wider"
          />
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl mt-0">{tr(lang, "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={busy || confirm.trim().toUpperCase() !== expected.toUpperCase()}
              className="flex-1 rounded-xl bg-burgundy hover:bg-burgundy/90 text-primary-foreground disabled:opacity-40"
            >
              {busy ? tr(lang, "جارٍ...", "Working...") : tr(lang, "إيقاف الحساب", "Deactivate account")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
