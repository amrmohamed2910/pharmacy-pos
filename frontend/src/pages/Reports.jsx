import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Package,
  Percent,
  ShoppingCart,
  Ticket,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useI18n } from "../i18n";
import { useApi } from "../hooks/useApi";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { downloadFile } from "../lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  StatCard,
  Tabs,
} from "../components/ui";
import { CHART_COLORS, ChartTooltip, shortDay } from "../components/charts/ChartKit";
import { cn, formatDate, money, paymentLabels, todayISO } from "../lib/utils";

const PAGE_TABS = [
  { value: "sales", label: "تقرير المبيعات", icon: TrendingUp },
  { value: "inventory", label: "تقرير المخزون", icon: Boxes },
];

const RANGE_PRESETS = [
  { value: "today", label: "اليوم", days: 1 },
  { value: "week", label: "7 أيام", days: 7 },
  { value: "month", label: "30 يوم", days: 30 },
  { value: "quarter", label: "3 أشهر", days: 90 },
];

export default function Reports() {
  const { currency } = useSettings();
  const { t } = useI18n();
  const [tab, setTab] = useState("sales");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("التقارير والتحليلات")}
        subtitle={t("تحليل أداء المبيعات والأرباح ومتابعة قيمة المخزون والصلاحية")}
        badge={
          <Badge tone="brand" dot>
            {t("تصدير Excel متاح")}
          </Badge>
        }
      />

      <Tabs value={tab} onChange={setTab} options={PAGE_TABS} />

      {tab === "sales" ? <SalesReport currency={currency} /> : <InventoryReport currency={currency} />}
    </div>
  );
}

/* -------------------------------- Sales report ------------------------------ */
function SalesReport({ currency }) {
  const toast = useToast();
  const { t } = useI18n();
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(todayISO(-29));
  const [to, setTo] = useState(todayISO());
  const [exporting, setExporting] = useState(false);

  const report = useApi("/reports/sales", { params: { from, to }, deps: [from, to] });
  const data = report.data;
  const summary = data?.summary;
  const byDay = data?.by_day || [];
  const byPayment = data?.by_payment || [];
  const top = data?.top_medicines || [];

  const paymentTotal = useMemo(
    () => byPayment.reduce((sum, item) => sum + item.amount, 0),
    [byPayment]
  );
  const maxTop = Math.max(...top.map((item) => item.revenue), 1);

  function applyPreset(value) {
    setPreset(value);
    const option = RANGE_PRESETS.find((item) => item.value === value);
    if (!option) return;
    setFrom(todayISO(-(option.days - 1)));
    setTo(todayISO());
  }

  function onCustomFrom(value) {
    setPreset("custom");
    setFrom(value);
  }

  function onCustomTo(value) {
    setPreset("custom");
    setTo(value);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadFile("/reports/export/sales.xlsx", `sales-${from}-${to}.xlsx`, { from, to });
      toast.success(t("تم تصدير التقرير"), t("تم حفظ ملف Excel على جهازك."));
    } catch (error) {
      toast.error(t("تعذر التصدير"), error.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="flex flex-wrap items-center gap-1.5">
            {RANGE_PRESETS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => applyPreset(option.value)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-[11px] font-semibold transition",
                  preset === option.value
                    ? "border-brand-600 bg-brand-700 text-white"
                    : "border-line text-muted hover:border-brand-300 hover:text-ink"
                )}
              >
                {t(option.label)}
              </button>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:max-w-xs">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-muted">{t("من تاريخ")}</span>
              <Input type="date" size="sm" value={from} onChange={(event) => onCustomFrom(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-muted">{t("إلى تاريخ")}</span>
              <Input type="date" size="sm" value={to} onChange={(event) => onCustomTo(event.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:ms-auto">
            <span className="text-[11px] text-muted">
              {report.loading ? t("جارٍ التحديث…") : `${formatDate(from)} — ${formatDate(to)}`}
            </span>
            <Button variant="secondary" onClick={report.refetch} disabled={report.loading}>
              {t("تحديث")}
            </Button>
            <Button onClick={exportExcel} loading={exporting}>
              <FileSpreadsheet className="size-4" />
              {t("تصدير Excel")}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("إيرادات الفترة")}
          value={money(summary?.revenue, currency)}
          hint={t("{count} فاتورة مكتملة", { count: summary?.invoices ?? 0 })}
          icon={Wallet}
          tone="brand"
          loading={report.loading && !data}
        />
        <StatCard
          title={t("صافي الربح")}
          value={money(summary?.profit, currency)}
          hint={t("هامش الربح {value}%", { value: summary?.margin ?? 0 })}
          icon={TrendingUp}
          tone="emerald"
          loading={report.loading && !data}
        />
        <StatCard
          title={t("متوسط الفاتورة")}
          value={money(summary?.average_invoice, currency)}
          hint={t("{count} وحدة مباعة", { count: summary?.units_sold ?? 0 })}
          icon={Ticket}
          tone="sky"
          loading={report.loading && !data}
        />
        <StatCard
          title={t("مشتريات الفترة")}
          value={money(summary?.purchases, currency)}
          hint={t("خصومات {amount}", { amount: money(summary?.discount, currency) })}
          icon={ShoppingCart}
          tone="amber"
          loading={report.loading && !data}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t("الإيرادات والأرباح اليومية")}
            subtitle={t("{count} يوم به مبيعات داخل الفترة", { count: byDay.length })}
            icon={BarChart3}
            action={
              <div className="flex items-center gap-3 text-[11px] font-semibold text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-brand-600" /> {t("الإيرادات")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400" /> {t("الأرباح")}
                </span>
              </div>
            }
          />
          <div className="h-72 p-4 pt-6">
            {report.loading && !data ? (
              <Skeleton className="h-full w-full" />
            ) : byDay.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byDay} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="reportProfitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--app-line)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    reversed
                    tickFormatter={shortDay}
                    tick={{ fontSize: 10, fill: "var(--app-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                    minTickGap={18}
                  />
                  <YAxis
                    orientation="right"
                    tick={{ fontSize: 10, fill: "var(--app-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(value) => value.toLocaleString("en-US")}
                  />
                  <Tooltip
                    content={<ChartTooltip currency={currency} labelFormatter={shortDay} />}
                    cursor={{ stroke: "var(--app-line)", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name={t("الإيرادات")}
                    stroke="#0d9488"
                    strokeWidth={2.4}
                    fill="url(#reportRevenueFill)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name={t("الأرباح")}
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#reportProfitFill)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={TrendingUp} title={t("لا توجد مبيعات في الفترة")} className="py-10" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("توزيع طرق الدفع")} subtitle={t("حسب قيمة المبيعات")} icon={CircleDollarSign} />
          <div className="relative h-52 p-4">
            {report.loading && !data ? (
              <Skeleton className="mx-auto h-full w-40 rounded-full" />
            ) : byPayment.length ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byPayment}
                      dataKey="amount"
                      nameKey="method"
                      innerRadius={54}
                      outerRadius={76}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {byPayment.map((entry, index) => (
                        <Cell key={entry.method} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip currency={currency} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <p className="text-[10px] text-muted">{t("الإجمالي")}</p>
                    <p className="text-sm font-bold nums">{money(paymentTotal, currency, false)}</p>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title={t("لا توجد بيانات")} icon={CircleDollarSign} className="py-6" />
            )}
          </div>
          <div className="space-y-2 px-5 pb-5">
            {byPayment.map((item, index) => (
              <div key={item.method} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  {paymentLabels[item.method] || item.method}
                  <span className="text-[10px] text-muted">({item.count})</span>
                </span>
                <span className="font-semibold nums">{money(item.amount, currency)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title={t("الأصناف الأكثر مبيعًا")}
          subtitle={t("أفضل {count} أصناف من حيث الإيراد", { count: top.length })}
          icon={TrendingUp}
          className="pb-4"
        />
        {report.loading && !data ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-12 w-full" />
            ))}
          </div>
        ) : top.length === 0 ? (
          <EmptyState icon={Package} title={t("لا توجد مبيعات مسجلة")} description={t("ابدأ البيع من نقطة البيع لتظهر الأصناف هنا.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-[10px] text-muted">
                  <th className="px-5 py-3 text-start font-semibold">#</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الصنف")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الكمية المباعة")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الإيراد")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الربح")}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t("المساهمة")}</th>
                </tr>
              </thead>
              <tbody>
                {top.map((item, index) => (
                  <tr key={item.name} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-3 text-xs font-bold text-muted nums">{index + 1}</td>
                    <td className="max-w-64 truncate px-3 py-3 text-xs font-semibold">{item.name}</td>
                    <td className="px-3 py-3 text-xs nums">{item.quantity}</td>
                    <td className="px-3 py-3 text-xs font-bold nums">{money(item.revenue, currency)}</td>
                    <td className="px-3 py-3 text-xs font-semibold nums text-emerald-700 dark:text-emerald-400">
                      {money(item.profit, currency)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full brand-gradient"
                            style={{ width: `${Math.max(6, (item.revenue / maxTop) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted nums">
                          {Math.round((item.revenue / maxTop) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ Inventory report ---------------------------- */
function InventoryReport({ currency }) {
  const toast = useToast();
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);
  const report = useApi("/reports/inventory");
  const data = report.data;
  const summary = data?.summary;
  const categories = data?.by_category || [];
  const lowStock = data?.low_stock || [];
  const expired = data?.expired || [];
  const maxCategory = Math.max(...categories.map((item) => item.value), 1);

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadFile("/reports/export/inventory.xlsx", `inventory-${todayISO()}.xlsx`);
      toast.success(t("تم تصدير المخزون"), t("تم حفظ ملف Excel على جهازك."));
    } catch (error) {
      toast.error(t("تعذر التصدير"), error.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {t("تقييم المخزون الحالي بناءً على أسعار الشراء والبيع للتشغيلات غير المنتهية.")}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => report.refetch({ quiet: true })} disabled={report.loading}>
            {t("تحديث")}
          </Button>
          <Button onClick={exportExcel} loading={exporting}>
            <Download className="size-4" />
            {t("تصدير المخزون")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("عدد الأصناف النشطة")}
          value={summary?.medicines ?? "—"}
          hint={t("{count} تشغيلة صالحة", { count: summary?.batches ?? 0 })}
          icon={Package}
          tone="brand"
          loading={report.loading && !data}
        />
        <StatCard
          title={t("قيمة المخزون (شراء)")}
          value={money(summary?.cost_value, currency)}
          hint={t("{count} وحدة متاحة", { count: summary?.units ?? 0 })}
          icon={Boxes}
          tone="sky"
          loading={report.loading && !data}
        />
        <StatCard
          title={t("قيمة المخزون (بيع)")}
          value={money(summary?.retail_value, currency)}
          hint={t("ربح متوقع {amount}", { amount: money(summary?.expected_profit, currency) })}
          icon={Wallet}
          tone="emerald"
          loading={report.loading && !data}
        />
        <StatCard
          title={t("نواقص وتنبيهات")}
          value={summary?.low_stock_count ?? "—"}
          hint={t("قيمة المنتهي {amount}", { amount: money(summary?.expired_value, currency) })}
          icon={AlertTriangle}
          tone="amber"
          loading={report.loading && !data}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title={t("قيمة المخزون حسب التصنيف")} subtitle={t("حسب سعر الشراء")} icon={BarChart3} />
          <div className="space-y-3.5 p-5">
            {report.loading && !data ? (
              [0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-10 w-full" />)
            ) : categories.length ? (
              categories.map((item, index) => (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="truncate font-semibold">{item.category}</span>
                      <span className="text-[10px] text-muted">{t("({count} صنف)", { count: item.count })}</span>
                    </span>
                    <span className="shrink-0 font-bold nums">{money(item.value, currency)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (item.value / maxCategory) * 100)}%`,
                        background: CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={Boxes} title={t("لا توجد بيانات كافية")} className="py-8" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t("نواقص المخزون")}
            subtitle={t("{count} صنف يحتاج إعادة طلب", { count: lowStock.length })}
            icon={AlertTriangle}
            action={<Badge tone="warning">{lowStock.length}</Badge>}
          />
          <div className="p-4">
            {report.loading && !data ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-11 w-full" />
                ))}
              </div>
            ) : lowStock.length === 0 ? (
              <EmptyState icon={Boxes} title={t("المخزون في حالة جيدة")} description={t("لا توجد أصناف أقل من الحد الأدنى.")} className="py-8" />
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 8).map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{item.name}</p>
                      <p className="text-[10px] text-muted">
                        {t("{category} · الحد الأدنى {min}", {
                          category: item.category || t("غير مصنف"),
                          min: item.min_stock_level,
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] text-muted nums">
                        {t("{boxes} علبة · {strips} شريط", {
                          boxes: item.boxes,
                          strips: item.strips,
                        })}
                      </span>
                      <Badge tone={item.status === "out" ? "danger" : "warning"} dot>
                        {item.status === "out" ? t("نافد") : t("منخفض")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title={t("الأصناف منتهية الصلاحية")}
          subtitle={t("تشغيلات انتهت وما زالت لها كميات في المخزون")}
          icon={CalendarClock}
          action={<Badge tone={expired.length ? "danger" : "success"}>{expired.length}</Badge>}
          className="pb-4"
        />
        {report.loading && !data ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : expired.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t("لا توجد تشغيلات منتهية")}
            description={t("كل التشغيلات الموجودة في المخزون صالحة للاستخدام.")}
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-[10px] text-muted">
                  <th className="px-5 py-3 text-start font-semibold">{t("الصنف")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("رقم التشغيلة")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("تاريخ الانتهاء")}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t("الكمية المتبقية")}</th>
                </tr>
              </thead>
              <tbody>
                {expired.map((item, index) => (
                  <tr
                    key={`${item.batch_number}-${index}`}
                    className="border-b border-line/60 last:border-0 hover:bg-rose-50/40 dark:hover:bg-rose-950/20"
                  >
                    <td className="px-5 py-3 text-xs font-semibold">{item.name}</td>
                    <td className="px-3 py-3 text-[11px] text-muted" dir="ltr">{item.batch_number}</td>
                    <td className="px-3 py-3 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      {formatDate(item.expiry_date)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted nums">
                      {t("{boxes} علبة · {strips} شريط", {
                        boxes: item.quantity_boxes,
                        strips: item.quantity_strips,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50/60 p-4 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
        <Percent className="size-4 shrink-0" />
        <p className="leading-6">
          {t("القيم المحسوبة تعتمد على التشغيلات المتاحة حاليًا. تابع تواريخ الصلاحية بانتظام لتفادي الخسائر، ويمكنك تصدير تقرير المخزون لمشاركته مع المحاسب.")}
        </p>
      </Card>
    </div>
  );
}
