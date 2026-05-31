import { useEffect, useState } from "react";
import { ArrowRight, Bell, Mail, Smartphone, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { notify } from "@/lib/notify";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { FieldHelp } from "@/components/ui/FieldHelp";

type Prefs = {
  channel_email: boolean;
  channel_in_app: boolean;
  channel_push: boolean;
  event_rent_due_soon: boolean;
  event_rent_overdue: boolean;
  event_contract_expiring: boolean;
  event_payment_received: boolean;
  event_trial_ending: boolean;
  event_deletion_warning: boolean;
};

const DEFAULTS: Prefs = {
  channel_email: true,
  channel_in_app: true,
  channel_push: true,
  event_rent_due_soon: true,
  event_rent_overdue: true,
  event_contract_expiring: true,
  event_payment_received: true,
  event_trial_ending: true,
  event_deletion_warning: true,
};

export default function NotificationPreferences() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPrefs(data as any);
      setLoading(false);
    })();
  }, [user?.id]);

  const update = (key: keyof Prefs, value: boolean) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...prefs }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return notify.error(ar ? "تعذّر الحفظ" : "Couldn't save");
    notify.success(ar ? "تم الحفظ" : "Saved");
  };

  const channels: { key: keyof Prefs; icon: any; ar: string; en: string; hint_ar: string; hint_en: string }[] = [
    { key: "channel_email", icon: Mail, ar: "البريد الإلكتروني", en: "Email", hint_ar: "تنبيهات مفصّلة في بريدك", hint_en: "Detailed alerts to your inbox" },
    { key: "channel_in_app", icon: Bell, ar: "داخل التطبيق", en: "In-app", hint_ar: "جرس الإشعارات وشريط علوي", hint_en: "Bell icon + banner" },
    { key: "channel_push", icon: Smartphone, ar: "إشعارات الجوال", en: "Push", hint_ar: "تنبيهات فورية على جهازك", hint_en: "Instant device alerts" },
  ];

  const events: { key: keyof Prefs; ar: string; en: string; hint_ar: string; hint_en: string }[] = [
    { key: "event_rent_due_soon", ar: "إيجار قريب الاستحقاق", en: "Rent due soon", hint_ar: "تنبيه قبل 3 أيام من موعد استحقاق الإيجار.", hint_en: "Alert 3 days before rent is due." },
    { key: "event_rent_overdue", ar: "إيجار متأخر", en: "Rent overdue", hint_ar: "تنبيه بعد انتهاء أيام السماح وعدم السداد.", hint_en: "Alert after grace days pass without payment." },
    { key: "event_contract_expiring", ar: "عقد قارب على الانتهاء", en: "Contract expiring", hint_ar: "تنبيه قبل 30 يوماً من انتهاء عقد الإيجار للتجديد.", hint_en: "Alert 30 days before lease end for renewal." },
    { key: "event_payment_received", ar: "استلام دفعة", en: "Payment received", hint_ar: "تأكيد فوري عند تسجيل أي دفعة جديدة.", hint_en: "Instant confirmation when a new payment is recorded." },
    { key: "event_trial_ending", ar: "انتهاء الفترة التجريبية", en: "Trial ending", hint_ar: "تذكير قبل انتهاء فترتك التجريبية المجانية.", hint_en: "Reminder before your free trial ends." },
    { key: "event_deletion_warning", ar: "تحذير حذف البيانات", en: "Data deletion warning", hint_ar: "تنبيه قبل حذف بياناتك نهائياً (بعد انتهاء فترة السماح).", hint_en: "Alert before your data is permanently deleted (after grace period)." },
  ];

  if (loading) {
    return (
      <div className="min-h-svh grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mobile-shell px-5 py-6 space-y-6">
      <SEO
        path="/settings/notifications"
        title={ar ? "تفضيلات الإشعارات · أملاكي" : "Notification preferences · Amlaki"}
        description={ar ? "تحكّم في قنوات وأنواع التنبيهات." : "Control your notification channels and events."}
      />
      <header className="flex items-center gap-3">
        <Link to="/settings" className="text-sage-500 hover:text-sage-700 rtl:rotate-180">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {ar ? "الإشعارات" : "Notifications"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar ? "اختر كيف وماذا تتلقّى" : "Choose how and what you receive"}
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sage-500 px-1">
          {ar ? "القنوات" : "Channels"}
        </h2>
        <div className="rounded-2xl bg-card border border-sage-200/50 shadow-elev divide-y divide-sage-200/40">
          {channels.map(({ key, icon: Icon, ar: a, en: e, hint_ar, hint_en }) => (
            <div key={key} className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{ar ? a : e}</p>
                <p className="text-xs text-muted-foreground">{ar ? hint_ar : hint_en}</p>
              </div>
              <Switch checked={prefs[key] as boolean} onCheckedChange={(v) => update(key, v)} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sage-500 px-1">
          {ar ? "الأحداث" : "Events"}
        </h2>
        <div className="rounded-2xl bg-card border border-sage-200/50 shadow-elev divide-y divide-sage-200/40">
          {events.map(({ key, ar: a, en: e }) => (
            <div key={key} className="flex items-center gap-3 p-4">
              <p className="flex-1 text-sm font-medium text-foreground">{ar ? a : e}</p>
              <Switch checked={prefs[key] as boolean} onCheckedChange={(v) => update(key, v)} />
            </div>
          ))}
        </div>
      </section>

      <Button
        onClick={save}
        disabled={saving}
        className="w-full h-12 rounded-2xl text-base font-semibold"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
        {ar ? "حفظ التفضيلات" : "Save preferences"}
      </Button>
    </div>
  );
}
