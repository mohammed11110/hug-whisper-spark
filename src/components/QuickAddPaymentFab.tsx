import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { useI18n } from "@/lib/i18n";

const HIDDEN_PREFIXES = [
  "/auth",
  "/welcome",
  "/install",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/admin",
  "/daily",
  "/unsubscribe",
  "/privacy",
  "/terms",
  "/refund",
];

/**
 * زر عائم عالمي لإضافة دفعة جديدة من أي صفحة.
 * يظهر فوق BottomNav على الموبايل وفي الزاوية السفلية على الديسكتوب.
 */
export function QuickAddPaymentFab() {
  const { lang } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={lang === "ar" ? "تسجيل دفعة" : "Register payment"}
        className="fixed bottom-24 md:bottom-6 end-5 z-40 h-14 w-14 rounded-full bg-gradient-sage text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
        style={{ boxShadow: "0 12px 32px -8px rgba(95,126,101,0.45)" }}
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>
      <AddPaymentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
