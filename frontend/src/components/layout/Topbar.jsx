import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  KeyRound,
  Languages,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useToast } from "../../contexts/ToastContext";
import { useApi } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { cn, roleLabels } from "../../lib/utils";
import { useI18n } from "../../i18n";
import { Avatar, Badge, Button, Field, Input } from "../ui";
import { Modal } from "../ui/overlays";
import { navigation } from "./Sidebar";

function useOutside(callback) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) callback(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [callback]);
  return ref;
}

export function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { settings } = useSettings();
  const { t, language, toggleLanguage } = useI18n();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const alerts = useApi("/dashboard/alerts", { silent: true });
  useEffect(() => {
    const timer = setInterval(() => alerts.refetch({ quiet: true }), 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menusRef = useOutside(() => setOpenMenu(null));
  const alertsData = alerts.data || { low_stock: [], expiring: [], expired: [] };
  const alertCount =
    (alertsData.low_stock?.length || 0) +
    (alertsData.expiring?.length || 0) +
    (alertsData.expired?.length || 0);

  const current = navigation.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );
  const title = current?.label ? t(current.label) : t("لوحة التحكم");

  const dateLabel = new Intl.DateTimeFormat(
    language === "en" ? "en-GB" : "ar-EG-u-nu-latn",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    }
  ).format(new Date());

  function submitSearch(event) {
    event.preventDefault();
    const term = search.trim();
    if (!term) return;
    if (user?.role === "cashier") navigate(`/sales?q=${encodeURIComponent(term)}`);
    else navigate(`/inventory?q=${encodeURIComponent(term)}`);
    setSearch("");
  }

  return (
    <header className="glass sticky top-0 z-30 border-b border-line">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-xl p-2 text-muted transition hover:bg-surface-2 hover:text-ink lg:hidden"
          aria-label={t("فتح القائمة")}
        >
          <Menu className="size-5" />
        </button>

        <div className="hidden min-w-0 sm:block">
          <h2 className="truncate text-sm font-bold">{title}</h2>
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <CalendarDays className="size-3" />
            {dateLabel}
          </p>
        </div>

        <form onSubmit={submitSearch} className="ms-auto hidden w-full max-w-sm md:block">
          <Input
            icon={Search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("ابحث عن دواء أو فاتورة...")}
            aria-label={t("البحث السريع")}
          />
        </form>

        <div className="ms-auto flex items-center gap-1.5 md:ms-0" ref={menusRef}>
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-muted transition hover:bg-surface-2 hover:text-ink"
            aria-label={t("تبديل اللغة")}
            title={t("تبديل اللغة")}
          >
            <Languages className="size-4.5" />
            <span className="text-[11px] font-bold">{language === "ar" ? "EN" : "ع"}</span>
          </button>

          <button
            type="button"
            onClick={toggle}
            className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink"
            aria-label={t("تبديل الوضع الليلي")}
          >
            {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === "alerts" ? null : "alerts")}
              className={cn(
                "relative grid size-10 place-items-center rounded-xl transition hover:bg-surface-2",
                openMenu === "alerts" ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
              )}
              aria-label={t("التنبيهات")}
            >
              <Bell className="size-4.5" />
              {alertCount > 0 ? (
                <span className="absolute end-2 top-2 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              ) : null}
            </button>

            {openMenu === "alerts" ? (
              <div className="animate-scale absolute end-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="text-sm font-bold">{t("مركز التنبيهات")}</p>
                  <Badge tone={alertCount ? "danger" : "success"} dot>
                    {alertCount
                      ? alertCount === 1
                        ? t("تنبيه واحد")
                        : t("{count} تنبيه", { count: alertCount })
                      : t("لا تنبيهات")}
                  </Badge>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {alertsData.low_stock?.map((item) => (
                    <Link
                      key={`low-${item.id}`}
                      to={`/inventory?q=${encodeURIComponent(item.name)}`}
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 border-b border-line/60 px-4 py-3 transition hover:bg-surface-2"
                    >
                      <span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
                        <TriangleAlert className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{item.name}</p>
                        <p className="text-[11px] text-muted">
                          {t("مخزون منخفض · {boxes} علبة / {strips} شريط", {
                            boxes: item.boxes,
                            strips: item.strips,
                          })}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {alertsData.expiring?.slice(0, 5).map((item) => (
                    <Link
                      key={`exp-${item.batch_id}`}
                      to={`/inventory?q=${encodeURIComponent(item.name)}`}
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 border-b border-line/60 px-4 py-3 transition hover:bg-surface-2"
                    >
                      <span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300">
                        <AlertTriangle className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{item.name}</p>
                        <p className="text-[11px] text-muted">
                          {t("تنتهي صلاحيته خلال {days} يوم · تشغيلة {batch}", {
                            days: item.days_left,
                            batch: item.batch_number,
                          })}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {alertCount === 0 ? (
                    <p className="px-4 py-10 text-center text-xs text-muted">
                      {t("كل شيء تحت السيطرة، لا توجد تنبيهات حالياً.")}
                    </p>
                  ) : null}
                </div>
                {user?.role !== "cashier" ? (
                  <Link
                    to="/inventory?status=low"
                    onClick={() => setOpenMenu(null)}
                    className="block bg-surface-2 px-4 py-2.5 text-center text-[11px] font-bold text-brand-700 hover:bg-surface-3 dark:text-brand-300"
                  >
                    {t("فتح إدارة المخزون")}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === "user" ? null : "user")}
              className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-surface-2"
            >
              <Avatar name={user?.name} size="sm" />
              <span className="hidden text-start sm:block">
                <span className="block max-w-32 truncate text-xs font-bold leading-4">
                  {user?.name}
                </span>
                <span className="block text-[10px] text-muted">{roleLabels[user?.role]}</span>
              </span>
            </button>

            {openMenu === "user" ? (
              <div className="animate-scale absolute end-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
                <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
                  <Avatar name={user?.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{user?.name}</p>
                    <p className="text-[11px] text-muted">
                      {roleLabels[user?.role]} · {settings?.pharmacy_name}
                    </p>
                  </div>
                </div>
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      setPasswordOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
                  >
                    <KeyRound className="size-4" />
                    {t("تغيير كلمة المرور")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  >
                    <LogOut className="size-4" />
                    {t("تسجيل الخروج")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </header>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (form.new_password !== form.confirm) {
      toast.error(t("كلمتا المرور غير متطابقتين"));
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success(t("تم تغيير كلمة المرور بنجاح"));
      setForm({ current_password: "", new_password: "", confirm: "" });
      onClose();
    } catch (error) {
      toast.error(t("تعذر تغيير كلمة المرور"), error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("تغيير كلمة المرور")}
      description={t("اختر كلمة مرور قوية لا تقل عن 6 أحرف")}
      icon={KeyRound}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("إلغاء")}
          </Button>
          <Button form="change-password-form" type="submit" loading={saving}>
            {t("حفظ")}
          </Button>
        </>
      }
    >
      <form id="change-password-form" className="space-y-4" onSubmit={submit}>
        <Field label={t("كلمة المرور الحالية")} required>
          <Input
            type="password"
            required
            value={form.current_password}
            onChange={(event) => setForm({ ...form, current_password: event.target.value })}
          />
        </Field>
        <Field
          label={t("كلمة المرور الجديدة")}
          required
          hint={t("6 أحرف على الأقل")}
        >
          <Input
            type="password"
            required
            minLength={6}
            value={form.new_password}
            onChange={(event) => setForm({ ...form, new_password: event.target.value })}
          />
        </Field>
        <Field label={t("تأكيد كلمة المرور")} required>
          <Input
            type="password"
            required
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
          />
        </Field>
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-[11px] text-muted">
          <UserRound className="size-4 shrink-0" />
          {t("سيتم استخدام كلمة المرور الجديدة في تسجيل الدخول القادم.")}
        </div>
      </form>
    </Modal>
  );
}
