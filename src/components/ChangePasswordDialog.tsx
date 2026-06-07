import { useState } from "react";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const tr = (lang: string, ar: string, en: string) => (lang === "ar" ? ar : en);

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { lang } = useI18n();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => { setPwd(""); setConfirm(""); setShow(false); };

  const submit = async () => {
    if (pwd.length < 8) {
      toast.error(tr(lang, "كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }
    if (pwd !== confirm) {
      toast.error(tr(lang, "كلمتا المرور غير متطابقتين", "Passwords don't match"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success(tr(lang, "تم تحديث كلمة المرور ✓", "Password updated ✓"));
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || tr(lang, "تعذّر التحديث", "Couldn't update"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            <KeyRound className="h-5 w-5 text-sage-600" />
            {tr(lang, "تغيير كلمة المرور", "Change password")}
          </DialogTitle>
          <DialogDescription className="text-start">
            {tr(lang, "اختر كلمة مرور قوية بـ 8 أحرف أو أكثر.", "Choose a strong password with 8+ characters.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder={tr(lang, "كلمة المرور الجديدة", "New password")}
              className="rounded-xl h-11 pe-10"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShow((s) => !s)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? "hide" : "show"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={tr(lang, "تأكيد كلمة المرور", "Confirm password")}
            className="rounded-xl h-11"
            autoComplete="new-password"
          />
        </div>
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl">
            {tr(lang, "إلغاء", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !pwd || !confirm}
            className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr(lang, "تحديث", "Update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
