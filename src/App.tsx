import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { AppShell } from "./components/AppShell";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Welcome = lazy(() => import("./pages/Welcome"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Buildings = lazy(() => import("./pages/Buildings"));
const BuildingDetail = lazy(() => import("./pages/BuildingDetail"));
const UnitDetail = lazy(() => import("./pages/UnitDetail"));
const Payments = lazy(() => import("./pages/Payments"));
const PaymentsTrash = lazy(() => import("./pages/PaymentsTrash"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Tenants = lazy(() => import("./pages/Tenants"));
const BuildingExpenses = lazy(() => import("./pages/BuildingExpenses"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Backup = lazy(() => import("./pages/Backup"));
const Team = lazy(() => import("./pages/Team"));
const Install = lazy(() => import("./pages/Install"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Refund = lazy(() => import("./pages/Refund"));
const Assistant = lazy(() => import("./pages/Assistant"));
const NotificationPreferences = lazy(() => import("./pages/NotificationPreferences"));
const Admin = lazy(() => import("./pages/Admin"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Activity = lazy(() => import("./pages/Activity"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const PrintView = lazy(() => import("./pages/PrintView"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const DailyLayout = lazy(() => import("./pages/daily/DailyLayout"));
const DailyDashboard = lazy(() => import("./pages/daily/DailyDashboard"));
const DailyCalendar = lazy(() => import("./pages/daily/DailyCalendar"));
const DailyBookings = lazy(() => import("./pages/daily/DailyBookings"));
const DailyUnits = lazy(() => import("./pages/daily/DailyUnits"));
const DailyPricing = lazy(() => import("./pages/daily/DailyPricing"));
const DailyCleaning = lazy(() => import("./pages/daily/DailyCleaning"));
const DailyMessages = lazy(() => import("./pages/daily/DailyMessages"));
const DailyReports = lazy(() => import("./pages/daily/DailyReports"));



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
                  <ErrorBoundary>
                  <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                      <Route path="/welcome" element={<Welcome />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route element={<AppShell />}>
                        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                        <Route path="/buildings" element={<RequireAuth><Buildings /></RequireAuth>} />
                        <Route path="/buildings/:id" element={<RequireAuth><BuildingDetail /></RequireAuth>} />
                        <Route path="/buildings/:id/expenses" element={<RequireAuth><BuildingExpenses /></RequireAuth>} />
                        <Route path="/units/:id" element={<RequireAuth><UnitDetail /></RequireAuth>} />
                        <Route path="/tenants" element={<RequireAuth><Tenants /></RequireAuth>} />
                        <Route path="/payments" element={<RequireAuth><Payments /></RequireAuth>} />
                        <Route path="/payments/trash" element={<RequireAuth><PaymentsTrash /></RequireAuth>} />
                        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
                        <Route path="/settings/notifications" element={<RequireAuth><NotificationPreferences /></RequireAuth>} />
                        <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
                        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
                        <Route path="/backup" element={<RequireAuth><Backup /></RequireAuth>} />
                        <Route path="/team" element={<RequireAuth><Team /></RequireAuth>} />
                        <Route path="/assistant" element={<RequireAuth><Assistant /></RequireAuth>} />
                        <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
                        <Route path="/maintenance" element={<RequireAuth><Maintenance /></RequireAuth>} />
                        <Route path="/activity" element={<RequireAuth><Activity /></RequireAuth>} />
                        <Route path="/daily" element={<RequireAuth><DailyLayout /></RequireAuth>}>
                          <Route index element={<DailyDashboard />} />
                          <Route path="calendar" element={<DailyCalendar />} />
                          <Route path="bookings" element={<DailyBookings />} />
                          <Route path="units" element={<DailyUnits />} />
                          <Route path="pricing" element={<DailyPricing />} />
                          <Route path="cleaning" element={<DailyCleaning />} />
                          <Route path="messages" element={<DailyMessages />} />
                          <Route path="reports" element={<DailyReports />} />
                        </Route>
                      </Route>
                      <Route path="/install" element={<Install />} />
                      <Route path="/pricing" element={<Pricing />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/refund" element={<Refund />} />
                      <Route path="/unsubscribe" element={<Unsubscribe />} />
                      <Route path="/p/:token" element={<PrintView />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  </ErrorBoundary>
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
