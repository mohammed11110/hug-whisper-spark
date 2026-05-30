import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";

export function EndTrialDialog({
  open,
  onOpenChange,
  onEnded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEnded?: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleEnd = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("end_trial_now");
      if (error) throw error;
      const result = data as { success: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || "failed");
      toast.success(ar ? "تم إنهاء التجربة" : "Trial ended");
      onOpenChange(false);
      onEnded?.();
      navigate("/backup");
    } catch {
      toast.error(ar ? "تعذّر إنهاء التجربة" : "Couldn't end the trial");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sage-600">
            {ar ? "إنهاء التجربة المجانية الآن؟" : "End the free trial now?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sage-500 leading-relaxed">
            {ar
              ? "لن تُحسب عليك أي رسوم — التجربة مجانية بالكامل. سيتحوّل حسابك إلى وضع القراءة فقط مع فترة سماح 30 يوماً لتصدير بياناتك قبل الحذف."
              : "You won't be charged — the trial is fully free. Your account moves to read-only with a 30-day grace period to export your data before deletion."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl" disabled={loading}>
            {ar ? "تراجع" : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleEnd(); }}
            disabled={loading}
            className="rounded-xl bg-terracotta hover:bg-terracotta/90 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {ar ? "نعم، إنهاء التجربة" : "Yes, end trial"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
