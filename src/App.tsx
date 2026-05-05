import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { CurrencyProvider } from "@/lib/currency";
import { AppSettingsProvider } from "@/lib/appSettings";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { RequireAuth } from "@/components/RequireAuth";
import { OnboardingTour } from "@/components/OnboardingTour";
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Buildings from "./pages/Buildings";
import BuildingDetail from "./pages/BuildingDetail";
import UnitDetail from "./pages/UnitDetail";
import Payments from "./pages/Payments";
import PaymentsTrash from "./pages/PaymentsTrash";
import SettingsPage from "./pages/Settings";
import Reports from "./pages/Reports";
import Tenants from "./pages/Tenants";
import BuildingExpenses from "./pages/BuildingExpenses";
import Notifications from "./pages/Notifications";
import Backup from "./pages/Backup";
import Team from "./pages/Team";
import Install from "./pages/Install";
import Pricing from "./pages/Pricing";
import Assistant from "./pages/Assistant";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <CurrencyProvider>
        <AppSettingsProvider>
          <ThemeProvider>
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <OnboardingTour />
                  <Routes>
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                    <Route path="/buildings" element={<RequireAuth><Buildings /></RequireAuth>} />
                    <Route path="/buildings/:id" element={<RequireAuth><BuildingDetail /></RequireAuth>} />
                    <Route path="/buildings/:id/expenses" element={<RequireAuth><BuildingExpenses /></RequireAuth>} />
                    <Route path="/units/:id" element={<RequireAuth><UnitDetail /></RequireAuth>} />
                    <Route path="/tenants" element={<RequireAuth><Tenants /></RequireAuth>} />
                    <Route path="/payments" element={<RequireAuth><Payments /></RequireAuth>} />
                    <Route path="/payments/trash" element={<RequireAuth><PaymentsTrash /></RequireAuth>} />
                    <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
                    <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
                    <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
                    <Route path="/backup" element={<RequireAuth><Backup /></RequireAuth>} />
                    <Route path="/team" element={<RequireAuth><Team /></RequireAuth>} />
                    <Route path="/install" element={<Install />} />
                    <Route path="/pricing" element={<RequireAuth><Pricing /></RequireAuth>} />
                    <Route path="/assistant" element={<RequireAuth><Assistant /></RequireAuth>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </AuthProvider>
          </ThemeProvider>
        </AppSettingsProvider>
      </CurrencyProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
