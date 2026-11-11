import { Loader2 } from "lucide-react";
import { cn, initials } from "../../lib/utils";
import { useI18n } from "../../i18n";

/* ------------------------------- Button ------------------------------- */
const buttonVariants = {
  primary:
    "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-soft dark:bg-brand-600 dark:hover:bg-brand-500",
  secondary:
    "border border-line bg-surface text-ink hover:bg-surface-2 active:bg-surface-3",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  soft: "bg-brand-50 text-brand-800 hover:bg-brand-100 dark:bg-brand-950/70 dark:text-brand-200 dark:hover:bg-brand-900/60",
  danger: "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-soft",
  outline:
    "border border-brand-600/30 text-brand-700 hover:bg-brand-50 dark:border-brand-400/30 dark:text-brand-300 dark:hover:bg-brand-950/60",
};

const buttonSizes = {
  sm: "h-8.5 gap-1.5 rounded-xl px-3 text-xs",
  md: "h-10.5 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2.5 rounded-xl px-6 text-base",
  icon: "size-10 rounded-xl",
  "icon-sm": "size-8 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

/* -------------------------------- Card -------------------------------- */
export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-soft",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon, className }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-start justify-between gap-3 p-5 pb-0", className)}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div>
          <h3 className="text-sm font-bold leading-6">{t(title)}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{t(subtitle)}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------- Inputs ------------------------------- */
const inputBase =
  "w-full rounded-xl border border-line bg-surface text-ink placeholder:text-muted/70 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-surface-2";

export function Input({ className, icon: Icon, size = "md", ...props }) {
  const height = size === "sm" ? "h-9 text-xs" : "h-10.5 text-sm";
  if (!Icon) {
    return <input className={cn(inputBase, height, "px-3", className)} {...props} />;
  }
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted" />
      <input className={cn(inputBase, height, "ps-9 pe-3", className)} {...props} />
    </div>
  );
}

export function Select({ className, children, size = "md", ...props }) {
  const height = size === "sm" ? "h-9 text-xs" : "h-10.5 text-sm";
  return (
    <select className={cn(inputBase, height, "px-3", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(inputBase, "min-h-24 px-3 py-2.5 text-sm", className)}
      {...props}
    />
  );
}

export function Field({ label, hint, error, required, children, className }) {
  const { t } = useI18n();
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-ink">
          {t(label)}
          {required ? <span className="text-rose-500">*</span> : null}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="block text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

/* ------------------------------- Badges ------------------------------- */
const badgeTones = {
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/20",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/20",
  danger:
    "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-400/20",
  brand:
    "bg-brand-50 text-brand-700 ring-brand-600/15 dark:bg-brand-950/60 dark:text-brand-300 dark:ring-brand-400/20",
  neutral:
    "bg-surface-2 text-muted ring-line dark:bg-surface-3 dark:text-ink/70",
};

export function Badge({ tone = "neutral", className, children, dot = false }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        badgeTones[tone] || badgeTones.neutral,
        className
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------- Feedback ------------------------------ */
export function Spinner({ className }) {
  return <Loader2 className={cn("size-5 animate-spin text-brand-600", className)} />;
}

export function Skeleton({ className }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon ? (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
          <Icon className="size-7" />
        </span>
      ) : null}
      <p className="text-sm font-bold">{t(title)}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-6 text-muted">{t(description)}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------ Pagination ----------------------------- */
export function Pagination({ page, pages, onChange, total, pageSize }) {
  const { t } = useI18n();
  if (!pages || pages <= 1) return null;
  const windowStart = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => windowStart + index).filter(
    (value) => value >= 1 && value <= pages
  );

  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
      <p className="text-xs text-muted">
        {t("عرض {from}–{to} من {total}", { from, to, total })}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          {t("السابق")}
        </Button>
        {numbers.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={cn(
              "size-8.5 rounded-lg text-xs font-bold transition",
              value === page
                ? "bg-brand-700 text-white dark:bg-brand-600"
                : "text-muted hover:bg-surface-2 hover:text-ink"
            )}
          >
            {value}
          </button>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
        >
          {t("التالي")}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- Tabs -------------------------------- */
export function Tabs({ value, onChange, options, className, size = "md" }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl bg-surface-2 p-1",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg font-semibold transition",
              size === "sm" ? "h-7.5 px-2.5 text-[11px]" : "h-9 px-3.5 text-xs",
              active
                ? "bg-surface text-ink shadow-soft"
                : "text-muted hover:text-ink"
            )}
          >
            {option.icon ? <option.icon className="size-3.5" /> : null}
            {t(option.label)}
            {option.count !== undefined ? (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] nums",
                  active ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "bg-surface-3 text-muted"
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Stat card ------------------------------ */
const statTones = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};

export function StatCard({ title, value, hint, icon: Icon, tone = "brand", change, loading }) {
  const { t } = useI18n();
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">{t(title)}</p>
          {loading ? (
            <Skeleton className="mt-2.5 h-8 w-28" />
          ) : (
            <p className="mt-1.5 truncate text-2xl font-bold tracking-tight nums">{value}</p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            {change !== null && change !== undefined && !loading ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold nums",
                  change >= 0
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                )}
              >
                {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
              </span>
            ) : null}
            {hint ? <span className="truncate text-muted">{t(hint)}</span> : null}
          </div>
        </div>
        {Icon ? (
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", statTones[tone])}>
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>
    </Card>
  );
}

/* -------------------------------- Avatar ------------------------------- */
export function Avatar({ name, size = "md", className }) {
  const sizes = {
    sm: "size-8 text-[11px]",
    md: "size-10 text-xs",
    lg: "size-14 text-base",
  };
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 font-bold text-white shadow-soft",
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------ Page header ---------------------------- */
export function PageHeader({ title, subtitle, actions, badge }) {
  const { t } = useI18n();
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t(title)}</h1>
          {badge}
        </div>
        {subtitle ? <p className="mt-1 text-sm text-muted">{t(subtitle)}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------- Divider ------------------------------- */
export function Divider({ className, label }) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-semibold text-muted">{label}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  }
  return <div className={cn("h-px w-full bg-line", className)} />;
}
