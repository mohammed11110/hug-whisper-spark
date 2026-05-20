import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Smartphone, Download, Share2, Plus, ArrowRight, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { SEO } from "@/components/SEO";

export default function Install() {
  const { lang } = useI18n();
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const triggerInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div className="mobile-shell min-h-screen pb-10 bg-background">
      <SEO
        path="/install"
        title={lang === "ar" ? "تثبيت تطبيق أملاكي" : "Install Amlaki App"}
        description={lang === "ar"
          ? "ثبّت تطبيق أملاكي على هاتفك للوصول السريع وإدارة عقاراتك أينما كنت."
          : "Install the Amlaki app on your phone for fast access and on-the-go property management."}
      />
      <div className="bg-gradient-deep text-primary-foreground px-5 pt-5 pb-7 rounded-b-[2rem]">
        <Link to="/" className="inline-flex items-center text-primary-foreground/80 text-sm">
          <ArrowRight className="h-4 w-4 me-1 rtl:rotate-180" /> {t("الرئيسية", "Home")}
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-card/15 backdrop-blur flex items-center justify-center">
            <Smartphone className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black">{t("ثبّت التطبيق", "Install the app")}</h1>
            <p className="text-xs opacity-80 mt-0.5">{t("استخدم أملاكي كتطبيق على هاتفك", "Use Amlaki like a real app")}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-4">
        {installed ? (
          <div className="bg-sage-100 border border-sage-300/50 rounded-2xl p-5 text-center">
            <p className="text-3xl mb-2">✓</p>
            <p className="font-bold text-sage-600">{t("التطبيق مثبت بالفعل", "App is already installed")}</p>
          </div>
        ) : deferred ? (
          <Button onClick={triggerInstall} className="w-full h-14 rounded-2xl bg-gradient-sage text-primary-foreground font-bold text-base shadow-soft">
            <Download className="h-5 w-5 me-2" /> {t("تثبيت الآن", "Install now")}
          </Button>
        ) : isIOS ? (
          <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-3">
            <div className="flex items-center gap-2 text-sage-600 font-bold">
              <Apple className="h-5 w-5" /> {t("على iPhone / iPad", "On iPhone / iPad")}
            </div>
            <Step n={1} icon={<Share2 className="h-4 w-4" />} text={t("اضغط زر المشاركة في Safari", "Tap the Share button in Safari")} />
            <Step n={2} icon={<Plus className="h-4 w-4" />} text={t("اختر «إضافة إلى الشاشة الرئيسية»", "Choose “Add to Home Screen”")} />
            <Step n={3} icon={<Download className="h-4 w-4" />} text={t("اضغط «إضافة» للتثبيت", "Tap “Add” to install")} />
          </div>
        ) : (
          <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-3">
            <div className="flex items-center gap-2 text-sage-600 font-bold">
              <Smartphone className="h-5 w-5" /> {t("على Android / Chrome", "On Android / Chrome")}
            </div>
            <Step n={1} icon={<Share2 className="h-4 w-4" />} text={t("افتح قائمة المتصفح (⋮)", "Open browser menu (⋮)")} />
            <Step n={2} icon={<Plus className="h-4 w-4" />} text={t("اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»", "Choose “Install app” or “Add to Home Screen”")} />
            <Step n={3} icon={<Download className="h-4 w-4" />} text={t("اتبع التعليمات", "Follow the prompts")} />
          </div>
        )}

        <div className="bg-sage-100/50 rounded-2xl p-4 text-xs text-sage-600 leading-relaxed">
          {t(
            "بعد التثبيت، يفتح أملاكي بملء الشاشة من أيقونة على هاتفك بدون شريط المتصفح، تماماً كأي تطبيق.",
            "Once installed, Amlaki opens full-screen from your home screen without browser bars — just like a real app.",
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-7 w-7 rounded-full bg-sage-100 text-sage-600 font-bold text-xs flex items-center justify-center">{n}</span>
      <span className="text-sage-500">{icon}</span>
      <span className="text-sm text-sage-600 flex-1">{text}</span>
    </div>
  );
}
