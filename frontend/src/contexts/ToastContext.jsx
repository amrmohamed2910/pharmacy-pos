import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { useI18n } from "../i18n";

const ToastContext = createContext(null);

const toneStyles = {
  success: {
    icon: CheckCircle2,
    ring: "border-emerald-200 dark:border-emerald-900/70",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  error: {
    icon: XCircle,
    ring: "border-rose-200 dark:border-rose-900/70",
    iconColor: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
  },
  warning: {
    icon: AlertTriangle,
    ring: "border-amber-200 dark:border-amber-900/70",
    iconColor: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  info: {
    icon: Info,
    ring: "border-sky-200 dark:border-sky-900/70",
    iconColor: "text-sky-600 dark:text-sky-400",
    bar: "bg-sky-500",
  },
};

export function ToastProvider({ children }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    ({ title, description, type = "success", duration = 4200 }) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current.slice(-3), { id, title, description, type }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (title, description) => push({ title, description, type: "success" }),
      error: (title, description) => push({ title, description, type: "error" }),
      warning: (title, description) => push({ title, description, type: "warning" }),
      info: (title, description) => push({ title, description, type: "info" }),
      push,
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-5 start-5 z-[120] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2.5">
        {toasts.map((item) => {
          const tone = toneStyles[item.type] || toneStyles.info;
          const Icon = tone.icon;
          return (
            <div
              key={item.id}
              className={cn(
                "animate-in pointer-events-auto overflow-hidden rounded-2xl border bg-surface shadow-lift",
                tone.ring
              )}
              role="status"
            >
              <div className="flex items-start gap-3 p-3.5">
                <Icon className={cn("mt-0.5 size-5 shrink-0", tone.iconColor)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-6">{t(item.title)}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-xs leading-5 text-muted">{t(item.description)}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-ink"
                  aria-label={t("إغلاق التنبيه")}
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className={cn("h-0.5 w-full opacity-80", tone.bar)} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
