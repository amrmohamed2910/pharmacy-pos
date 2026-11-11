import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { I18nProvider, useI18n } from "./i18n";
import { AppShell } from "./components/layout/AppShell";
import { Button } from "./components/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Purchases from "./pages/Purchases";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function BootScreen() {
  const { t } = useI18n();
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <span className="brand-gradient grid size-14 animate-pulse place-items-center rounded-2xl text-white shadow-lift">
          <svg viewBox="0 0 24 24" className="size-7" fill="currentColor">
            <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />
          </svg>
        </span>
        <p className="text-xs font-semibold text-muted">{t("جارٍ تجهيز مساحة العمل…")}</p>
      </div>
    </div>
  );
}

function Forbidden() {
  const { user } = useAuth();
  const { t } = useI18n();
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-sm text-center">
        <p className="text-5xl font-bold text-brand-700 dark:text-brand-300">403</p>
        <h2 className="mt-3 text-lg font-bold">{t("لا تملك صلاحية الوصول")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("حسابك ({name}) لا يملك صلاحية فتح هذه الشاشة. تواصل مع مدير النظام.", {
            name: user?.name,
          })}
        </p>
        <Button className="mt-5" onClick={() => (window.location.href = "/")}>
          {t("العودة للوحة التحكم")}
        </Button>
      </div>
    </div>
  );
}

function Protected({ roles, children }) {
  const { isAuthenticated, booting, user } = useAuth();
  const location = useLocation();
  if (booting) return <BootScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) return <Forbidden />;
  return children;
}

function Shell() {
  return (
    <Protected>
      <AppShell />
    </Protected>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SettingsProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<Shell />}>
                    <Route index element={<Dashboard />} />
                    <Route path="pos" element={<POS />} />
                    <Route
                      path="inventory"
                      element={
                        <Protected roles={["admin", "pharmacist"]}>
                          <Inventory />
                        </Protected>
                      }
                    />
                    <Route path="sales" element={<Sales />} />
                    <Route
                      path="purchases"
                      element={
                        <Protected roles={["admin", "pharmacist"]}>
                          <Purchases />
                        </Protected>
                      }
                    />
                    <Route
                      path="reports"
                      element={
                        <Protected roles={["admin", "pharmacist"]}>
                          <Reports />
                        </Protected>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <Protected roles={["admin"]}>
                          <Settings />
                        </Protected>
                      }
                    />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </SettingsProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
