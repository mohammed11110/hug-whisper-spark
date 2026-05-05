import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useI18n } from "@/lib/i18n";

export default function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useI18n();
  return (
    <div className="mobile-shell pb-24 min-h-screen">
      <TopBar />
      <div className="px-5 pt-6">
        <h1 className="text-2xl font-black text-sage-600 tracking-tight mb-4">{t(titleKey)}</h1>
        <div className="bg-card border border-sage-200/60 rounded-3xl p-10 text-center shadow-soft">
          <div className="text-5xl mb-3">🌿</div>
          <p className="text-sage-500 font-semibold">Coming soon</p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
