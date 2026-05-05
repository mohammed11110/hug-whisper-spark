import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, Users, BarChart3, Sparkles, Crown, ArrowRight, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KEY = "amlaki_onboarding_seen_v1";

const STEPS = [
  {
    icon: Building2,
    titleAr: "أهلاً بك في أملاكي",
    titleEn: "Welcome to Amlaki",
    descAr: "نظام احترافي لإدارة عقاراتك ومستأجريك من مكان واحد.",
    descEn: "Professional system to manage all your properties and tenants in one place.",
  },
  {
    icon: Users,
    titleAr: "تتبع المستأجرين والمدفوعات",
    titleEn: "Track tenants & payments",
    descAr: "سجل العقود، أرسل التذكيرات، واستقبل الدفعات بسهولة.",
    descEn: "Record contracts, send reminders, and collect payments effortlessly.",
  },
  {
    icon: BarChart3,
    titleAr: "تقارير ذكية",
    titleEn: "Smart reports",
    descAr: "رسوم بيانية تفاعلية تكشف لك أداء كل مبنى ووحدة.",
    descEn: "Interactive charts revealing performance of every building & unit.",
  },
  {
    icon: Sparkles,
    titleAr: "مساعد ذكي بالـ AI",
    titleEn: "AI-powered assistant",
    descAr: "اسأل مساعدك أي شيء عن عقاراتك واحصل على رؤى فورية.",
    descEn: "Ask your assistant anything about your properties and get instant insights.",
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (location.pathname === "/welcome" || location.pathname === "/auth") return;
    const seen = localStorage.getItem(KEY);
    if (!seen) setOpen(true);
  }, [user, location.pathname]);

  const finish = () => {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  };

  const seedDemo = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const { data: b, error: be } = await supabase
        .from("buildings")
        .insert({ user_id: user.id, name: ar ? "برج أملاكي التجريبي" : "Amlaki Demo Tower", name_en: "Amlaki Demo Tower", type: "tower", floors: 4, city: ar ? "الرياض" : "Riyadh" })
        .select("id")
        .single();
      if (be || !b) throw be;

      const today = new Date();
      const units = [
        { unit_number: "101", floor: 1, status: "paid", rent_amount: 1500, tenant_name: ar ? "محمد العامري" : "Mohammed Alameri", tenant_phone: "+966500000001" },
        { unit_number: "102", floor: 1, status: "late", rent_amount: 1400, tenant_name: ar ? "أحمد الشهري" : "Ahmed Alshehri", tenant_phone: "+966500000002" },
        { unit_number: "201", floor: 2, status: "soon", rent_amount: 1600, tenant_name: ar ? "سارة القحطاني" : "Sara Alqahtani", tenant_phone: "+966500000003" },
        { unit_number: "202", floor: 2, status: "vacant", rent_amount: 1500, tenant_name: null, tenant_phone: null },
      ];

      const { data: insertedUnits } = await supabase
        .from("units")
        .insert(units.map((u) => ({
          ...u,
          building_id: b.id,
          due_day: 1,
          rent_type: "monthly",
          contract_type: "yearly",
          contract_start_date: new Date(today.getFullYear(), today.getMonth() - 6, 1).toISOString().slice(0, 10),
          contract_end_date: new Date(today.getFullYear() + 1, today.getMonth() - 6, 1).toISOString().slice(0, 10),
        })))
        .select("id, rent_amount, status");

      if (insertedUnits?.length) {
        const payments: any[] = [];
        insertedUnits.forEach((u) => {
          if (u.status === "paid" || u.status === "late") {
            for (let i = 5; i >= 1; i--) {
              const d = new Date(today.getFullYear(), today.getMonth() - i, 5);
              payments.push({
                unit_id: u.id,
                amount: u.rent_amount,
                payment_date: d.toISOString().slice(0, 10),
                payment_method: "cash",
              });
            }
          }
        });
        if (payments.length) await supabase.from("payments").insert(payments);

        await supabase.from("expenses").insert([
          { building_id: b.id, amount: 350, expense_date: new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString().slice(0, 10), category: "maintenance", description: ar ? "صيانة المصعد" : "Elevator maintenance" },
          { building_id: b.id, amount: 180, expense_date: new Date(today.getFullYear(), today.getMonth() - 2, 8).toISOString().slice(0, 10), category: "utilities", description: ar ? "كهرباء عامة" : "Common electricity" },
        ]);
      }

      toast.success(ar ? "تم إنشاء بيانات تجريبية!" : "Demo data created!");
      finish();
      navigate("/");
      setTimeout(() => window.location.reload(), 300);
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setSeeding(false);
    }
  };

  if (!user) return null;
  const S = STEPS[step];
  const Icon = S.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden border-sage-200/60">
        <div className="bg-gradient-sage p-8 text-primary-foreground text-center">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-card/15 backdrop-blur items-center justify-center mb-3">
            <Icon className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black mb-2">{ar ? S.titleAr : S.titleEn}</h2>
          <p className="text-sm opacity-90 leading-relaxed">{ar ? S.descAr : S.descEn}</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-sage-400" : "w-1.5 bg-sage-200"}`} />
            ))}
          </div>

          {isLast ? (
            <div className="space-y-2">
              <Button onClick={seedDemo} disabled={seeding} className="w-full bg-gradient-sage rounded-xl h-12 font-bold">
                <Database className="h-4 w-4 me-2" />
                {seeding ? (ar ? "جاري الإنشاء..." : "Creating...") : (ar ? "أنشئ بيانات تجريبية" : "Create demo data")}
              </Button>
              <Button onClick={finish} variant="outline" className="w-full rounded-xl h-11 border-sage-300">
                {ar ? "ابدأ من الصفر" : "Start fresh"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={finish} className="text-muted-foreground">
                {ar ? "تخطي" : "Skip"}
              </Button>
              <Button onClick={() => setStep((s) => s + 1)} className="flex-1 bg-gradient-sage rounded-xl h-11 font-bold">
                {ar ? "التالي" : "Next"}
                <ArrowRight className="h-4 w-4 ms-1 rtl:rotate-180" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
