import { money } from "../../lib/utils";
import { useI18n } from "../../i18n";

export const CHART_COLORS = ["#0d9488", "#2dd4bf", "#0ea5e9", "#f59e0b", "#f43f5e", "#8b5cf6"];

export function ChartTooltip({ active, payload, label, currency = "ج.م", labelFormatter }) {
  const { rtl } = useI18n();
  if (!active || !payload?.length) return null;
  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs shadow-lift"
    >
      <p className="mb-1.5 font-bold text-ink">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color || item.fill }}
              />
              {item.name}
            </span>
            <span className="nums font-bold text-ink">{money(item.value, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function shortDay(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat(
    typeof document !== "undefined" && document.documentElement.dir === "ltr"
      ? "en-GB"
      : "ar-EG-u-nu-latn",
    {
      day: "numeric",
      month: "short",
    }
  ).format(date);
}
