import { NavLink } from "react-router-dom";
import {
  ChartColumnBig,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScanBarcode,
  Settings2,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useI18n } from "../../i18n";

export const navigation = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, end: true },
  { to: "/pos", label: "نقطة البيع", icon: ScanBarcode },
  { to: "/inventory", label: "المخزون", icon: Package, roles: ["admin", "pharmacist"] },
  { to: "/sales", label: "الفواتير", icon: ReceiptText },
  { to: "/purchases", label: "المشتريات", icon: Truck, roles: ["admin", "pharmacist"] },
  { to: "/reports", label: "التقارير", icon: ChartColumnBig, roles: ["admin", "pharmacist"] },
  { to: "/settings", label: "الإعدادات", icon: Settings2, roles: ["admin"] },
];

export function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { t, rtl } = useI18n();
  const allowed = navigation.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-[17rem] flex-col border-e border-line bg-surface transition-transform duration-300 lg:translate-x-0",
          open
            ? "translate-x-0"
            : rtl
              ? "translate-x-full lg:translate-x-0"
              : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="brand-gradient grid size-11 place-items-center rounded-2xl text-white shadow-soft">
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
                <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold leading-5">{settings.pharmacy_name}</p>
              <p className="text-[11px] text-muted">{t("إدارة الصيدلية بذكاء")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 lg:hidden"
            aria-label={t("إغلاق القائمة")}
          >
            <X className="size-4.5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted/80">
            {t("التشغيل اليومي")}
          </p>
          {allowed.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all",
                  isActive
                    ? "bg-brand-700 text-white shadow-soft dark:bg-brand-600"
                    : "text-muted hover:bg-surface-2 hover:text-ink"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "size-4.5 transition",
                      isActive ? "text-white" : "text-muted group-hover:text-brand-600"
                    )}
                  />
                  <span className="flex-1">{t(item.label)}</span>
                  {isActive ? <span className="size-1.5 rounded-full bg-white/80" /> : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mx-3 mb-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-3.5 dark:border-brand-900/60 dark:bg-brand-950/40">
          <div className="flex items-center gap-2 text-brand-800 dark:text-brand-200">
            <ShieldCheck className="size-4" />
            <p className="text-xs font-bold">{t("نظام آمن ومحلي")}</p>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-brand-800/70 dark:text-brand-200/70">
            {t("بياناتك محفوظة على سيرفر الصيدلية ولا تغادر الشبكة.")}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {t("متصل · الإصدار 3.0")}
          </div>
        </div>
      </aside>
    </>
  );
}
