import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

import { SEO } from "@/components/SEO";
import { useI18n } from "@/lib/i18n";
import { Link } from "react-router-dom";

export default function Welcome() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  return (
    <div className="mobile-shell flex flex-col bg-gradient-cream overflow-hidden">
      <SEO
        path="/welcome"
        title={ar ? "أملاكي · إدارة العقارات بذكاء وأناقة" : "Amlaki — Manage your properties with elegance"}
        description={ar
          ? "ابدأ مع أملاكي لإدارة مبانيك ووحداتك ومستأجريك ومدفوعاتك في مكان واحد."
          : "Get started with Amlaki to manage your buildings, units, tenants and payments in one place."}
      />

      <header className="flex justify-end p-4">
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8 pb-12 relative">
        

        <div className="relative z-10 flex flex-col items-center text-center animate-float-up">
          <div className="mb-6 p-5 rounded-3xl bg-card shadow-elev">
            <Logo size={64} />
          </div>
          <h1 className="text-5xl font-black text-sage-600 mb-3 tracking-tight">{t("app_name")}</h1>
          <p className="text-base text-sage-500 max-w-xs leading-relaxed">{t("tagline")}</p>
        </div>

        <div className="w-full max-w-sm mt-12 space-y-3 relative z-10 animate-float-up" style={{ animationDelay: "0.15s" }}>
          <Link to="/auth?mode=signup" className="block">
            <Button className="w-full h-14 rounded-2xl bg-gradient-sage hover:opacity-95 text-primary-foreground text-base font-semibold shadow-glow">
              {t("create_account")}
            </Button>
          </Link>
          <Link to="/auth?mode=signin" className="block">
            <Button variant="outline" className="w-full h-14 rounded-2xl border-sage-300 text-sage-600 hover:bg-sage-100 text-base font-semibold">
              {t("have_account")}
            </Button>
          </Link>
        </div>
      </main>

      <footer className="relative z-10 px-6 pb-6 pt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-sage-500">
        <Link to="/pricing" className="hover:text-sage-600 font-medium">{t("pricing") || "Pricing"}</Link>
        <Link to="/terms" className="hover:text-sage-600">{t("terms") || "Terms"}</Link>
        <Link to="/privacy" className="hover:text-sage-600">{t("privacy") || "Privacy"}</Link>
        <Link to="/refund" className="hover:text-sage-600">{t("refund") || "Refund"}</Link>
      </footer>
    </div>
  );
}
