import { getLanguage, isRTL, t } from "../i18n";

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isEnglish() {
  return getLanguage() === "en";
}

export function displayCurrency(currency) {
  const value = String(currency ?? "").trim();
  if (!value) return isEnglish() ? "EGP" : "ج.م";
  if (isEnglish() && (value === "ج.م" || value === "جنيه" || value === "EGP")) return "EGP";
  return value;
}

export function money(value, currency = "ج.م", withCurrency = true) {
  const number = Number(value || 0);
  const formatted = number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withCurrency ? `${formatted} ${displayCurrency(currency)}` : formatted;
}

export function number(value, digits = 0) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function compact(value) {
  const n = Number(value || 0);
  const english = isEnglish();
  if (Math.abs(n) >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}${english ? "B" : "مليار"}`;
  }
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}${english ? "M" : "م"}`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}${english ? "K" : "ألف"}`;
  return number(n);
}

function intlLocale() {
  return isEnglish() ? "en-GB" : "ar-EG-u-nu-latn";
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(intlLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${formatDate(date)} · ${new Intl.DateTimeFormat(intlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

export function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat(intlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function todayISO(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function daysLeft(value) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return isEnglish() ? "?" : "؟";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export function percent(value, digits = 1) {
  if (value === null || value === undefined) return null;
  return `${Number(value).toFixed(digits)}%`;
}

/**
 * خرائط التسميات مخزنة بالعربية (نفس قيم قاعدة البيانات)،
 * ويتم ترجمتها لحظة القراءة حسب اللغة النشطة.
 */
function translatedMap(map, transform) {
  return new Proxy(map, {
    get(target, prop) {
      if (typeof prop !== "string") return Reflect.get(target, prop);
      const value = target[prop];
      return value === undefined ? undefined : transform(value);
    },
  });
}

export const statusMeta = translatedMap(
  {
    ok: { label: "متاح", tone: "success" },
    low: { label: "منخفض", tone: "warning" },
    out: { label: "نافد", tone: "danger" },
    expiring: { label: "قريب الانتهاء", tone: "warning" },
    expired: { label: "منتهي الصلاحية", tone: "danger" },
    completed: { label: "مكتملة", tone: "success" },
    refunded: { label: "مرتجعة", tone: "danger" },
    received: { label: "مستلمة", tone: "success" },
  },
  (entry) => ({ ...entry, label: t(entry.label) })
);

export const roleLabels = translatedMap(
  {
    admin: "مدير النظام",
    pharmacist: "صيدلي",
    cashier: "كاشير",
  },
  (value) => t(value)
);

export const paymentLabels = translatedMap(
  {
    "كاش": "كاش",
    "شبكة": "شبكة / فيزا",
    "آجل": "آجل",
  },
  (value) => t(value)
);

export const unitLabels = translatedMap(
  {
    box: "علبة",
    strip: "شريط",
  },
  (value) => t(value)
);

/** سهم "التالي" المناسب لاتجاه الواجهة الحالي. */
export function forwardClass() {
  return isRTL() ? "" : "-scale-x-100";
}
