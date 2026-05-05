import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <p className="text-sage-500">{t("loading")}</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}
