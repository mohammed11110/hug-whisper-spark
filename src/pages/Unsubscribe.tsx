import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, MailX, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State = "validating" | "ready" | "already" | "invalid" | "submitting" | "success" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("validating");

  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const anonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: anonKey } }
        );
        const json = await res.json();
        if (!res.ok) { setState("invalid"); return; }
        if (json.valid === false && json.reason === "already_unsubscribed") setState("already");
        else if (json.valid === true) setState("ready");
        else setState("invalid");
      } catch { setState("invalid"); }
    })();
  }, [token, supabaseUrl, anonKey]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    if (error) { setState("error"); return; }
    if ((data as any)?.success) setState("success");
    else if ((data as any)?.reason === "already_unsubscribed") setState("already");
    else setState("error");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full bg-card rounded-3xl shadow-soft p-8 text-center border border-sage-200/40">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-sage flex items-center justify-center mb-5">
          <MailX className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-bold text-sage-600 mb-2">إلغاء الاشتراك</h1>

        {state === "validating" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-5 w-5 animate-spin" /> جارٍ التحقق…
          </div>
        )}

        {state === "ready" && (
          <>
            <p className="text-sage-500 mb-6 leading-relaxed">
              هل أنت متأكد من إلغاء اشتراكك في رسائل أملاكي؟ لن تستلم أي إشعارات بعد هذه الخطوة.
            </p>
            <Button onClick={confirm} className="w-full rounded-xl bg-burgundy hover:bg-burgundy/90 text-white">
              تأكيد إلغاء الاشتراك
            </Button>
          </>
        )}

        {state === "submitting" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-5 w-5 animate-spin" /> جارٍ المعالجة…
          </div>
        )}

        {state === "success" && (
          <div className="py-4">
            <CheckCircle2 className="h-10 w-10 text-sage-400 mx-auto mb-3" />
            <p className="text-sage-600 font-semibold">تم إلغاء اشتراكك بنجاح.</p>
            <p className="text-sm text-muted-foreground mt-2">لن تصلك رسائل من أملاكي بعد الآن.</p>
          </div>
        )}

        {state === "already" && (
          <div className="py-4">
            <CheckCircle2 className="h-10 w-10 text-sage-400 mx-auto mb-3" />
            <p className="text-sage-600 font-semibold">سبق وألغيت اشتراكك.</p>
          </div>
        )}

        {(state === "invalid" || state === "error") && (
          <div className="py-4">
            <AlertCircle className="h-10 w-10 text-burgundy mx-auto mb-3" />
            <p className="text-sage-600 font-semibold">
              {state === "invalid" ? "الرابط غير صالح أو منتهي الصلاحية." : "حدث خطأ، حاول لاحقاً."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
