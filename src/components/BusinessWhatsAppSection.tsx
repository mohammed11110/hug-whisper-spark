import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, CheckCircle2, Clock, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { z } from "zod";
import { openExternal } from "@/lib/nativeFiles";

const tr = (lang: string, ar: string, en: string) => (lang === "ar" ? ar : en);

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, { message: "phone_invalid" });

type Profile = {
  business_whatsapp: string | null;
  whatsapp_verified_at: string | null;
};

export function BusinessWhatsAppSection() {
  const { lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "awaiting_code">("idle");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return setLoading(false);
    const { data } = await supabase
      .from("profiles")
      .select("business_whatsapp, whatsapp_verified_at")
      .eq("id", u.user.id)
      .maybeSingle();
    setProfile(data as Profile | null);
    if (data?.business_whatsapp) setPhone(data.business_whatsapp);
    // If a number is set but not yet verified, assume a code request may be in flight.
    // The server enforces the actual code expiry/attempts; the client just shows the input.
    if (data?.business_whatsapp && !data.whatsapp_verified_at) {
      setStep("awaiting_code");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const requestCode = async () => {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      toast.error(tr(lang, "رقم غير صالح. مثال: +9665XXXXXXXX", "Invalid number. Example: +9665XXXXXXXX"));
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-whatsapp", {
        body: { action: "request_code", phone: parsed.data },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const target = (data as any).phone as string;
      // The verification code is sent to the target WhatsApp number server-side.
      // We open wa.me as a convenience so the user can quickly switch to WhatsApp.
      const cleaned = target.replace(/[^\d]/g, "");
      await openExternal(`https://wa.me/${cleaned}`);
      setStep("awaiting_code");
      toast.success(tr(lang, "أُرسل الكود إلى واتساب الرقم. تحقّق من الرسائل وأدخل الكود.", "Code sent to that WhatsApp number. Check messages and enter the code."));
      await load();
    } catch (e: any) {
      toast.error(e?.message || tr(lang, "تعذر إرسال الكود", "Could not send code"));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error(tr(lang, "أدخل كوداً مكوناً من 6 أرقام", "Enter a 6-digit code"));
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-whatsapp", {
        body: { action: "verify_code", code: code.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(tr(lang, "تم توثيق رقم واتساب الأعمال ✅", "WhatsApp business number verified ✅"));
      setStep("idle");
      setCode("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || tr(lang, "تعذر التحقق", "Verification failed"));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("verify-whatsapp", {
        body: { action: "reset" },
      });
      if (error) throw error;
      setPhone("");
      setCode("");
      setStep("idle");
      await load();
      toast.success(tr(lang, "تمت إزالة الرقم", "Number removed"));
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const verified = !!profile?.whatsapp_verified_at;
  const pending = !!profile?.business_whatsapp && !verified;

  return (
    <section className="px-5 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="h-4 w-4 text-sage-600" />
        <h2 className="font-bold text-sage-600 text-sm">
          {tr(lang, "رقم واتساب الأعمال", "Business WhatsApp number")}
        </h2>
      </div>

      <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {tr(
            lang,
            "أضف رقم واتساب رسمي لأعمالك ووثّقه ليظهر للمستأجرين كرقم تواصل موثوق. الإرسال يبقى مجانياً عبر تطبيق واتساب على جوالك.",
            "Add an official WhatsApp number for your business and verify it so tenants see a trusted contact. Sending stays free via WhatsApp on your phone."
          )}
        </p>

        {/* Status badge */}
        {!loading && (
          <div className="flex items-center gap-2">
            {verified && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {tr(lang, "موثّق", "Verified")}
              </span>
            )}
            {pending && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <Clock className="h-3.5 w-3.5" />
                {tr(lang, "بانتظار التحقق", "Pending verification")}
              </span>
            )}
            {!profile?.business_whatsapp && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                <AlertCircle className="h-3.5 w-3.5" />
                {tr(lang, "غير مضاف", "Not added")}
              </span>
            )}
            {profile?.business_whatsapp && (
              <span className="text-[12px] font-mono text-sage-700 ms-1">{profile.business_whatsapp}</span>
            )}
          </div>
        )}

        {/* Phone input */}
        {!verified && (
          <label className="block space-y-1">
            <span className="text-[11px] text-sage-500 font-semibold">
              {tr(lang, "رقم واتساب الأعمال (بالصيغة الدولية)", "WhatsApp number (international format)")}
            </span>
            <Input
              dir="ltr"
              placeholder="+9665XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              disabled={busy || step === "awaiting_code"}
              className="rounded-xl border-sage-200 bg-card h-10 font-mono"
            />
          </label>
        )}

        {/* Actions */}
        {!verified && step === "idle" && (
          <Button
            onClick={requestCode}
            disabled={busy || !phone}
            className="w-full rounded-xl bg-sage-600 hover:bg-sage-700 text-white"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <MessageCircle className="h-4 w-4 me-2" />}
            {tr(lang, "إرسال كود التحقق عبر واتساب", "Send verification code via WhatsApp")}
          </Button>
        )}

        {!verified && step === "awaiting_code" && (
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">
                {tr(lang, "أدخل الكود (6 أرقام) المُستلم في واتسابك", "Enter the 6-digit code received in your WhatsApp")}
              </span>
              <Input
                dir="ltr"
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="rounded-xl border-sage-200 bg-card h-10 font-mono text-center text-lg tracking-widest"
              />
            </label>
            <div className="flex gap-2">
              <Button
                onClick={verifyCode}
                disabled={busy || code.length !== 6}
                className="flex-1 rounded-xl bg-primary hover:bg-primary text-white"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
                {tr(lang, "تأكيد الكود", "Confirm code")}
              </Button>
              <Button
                variant="outline"
                onClick={requestCode}
                disabled={busy}
                className="rounded-xl"
                title={tr(lang, "إعادة إرسال", "Resend")}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {(verified || pending) && (
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            disabled={busy}
            className="w-full rounded-xl text-burgundy border-burgundy/30 hover:bg-burgundy/5"
          >
            {tr(lang, "تغيير الرقم / إزالته", "Change / remove number")}
          </Button>
        )}
      </div>
    </section>
  );
}
