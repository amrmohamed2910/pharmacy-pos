import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  ArrowUpRight,
  Boxes,
  CalendarClock,
  ChevronLeft,
  CircleDollarSign,
  Plus,
  ReceiptText,
  ScanBarcode,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
  Tabs,
} from "../components/ui";
import { CHART_COLORS, ChartTooltip, shortDay } from "../components/charts/ChartKit";
import { formatDateTime, money, paymentLabels, statusMeta } from "../lib/utils";
import { useI18n } from "../i18n";

const RANGES = [
  { value: "today", label: "اليوم" },
  { value: "week", label: "7 أيام" },
  { value: "month", label: "30 يوم" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const { t } = useI18n();
  const [range, setRange] = useState("week");
  const [alertTab, setAlertTab] = useState("low");

  const trendDays = range === "today" ? 7 : range === "week" ? 14 : 30;
  const itemDays = range === "today" ? 1 : range === "week" ? 7 : 30;

  const summary = useApi("/dashboard/summary", { params: { range } });
  const trend = useApi("/dashboard/trend", { params: { days: trendDays } });
  const payments = useApi("/dashboard/payment-methods", { params: { days: itemDays } });
  const top = useApi("/dashboard/top-medicines", { params: { days: itemDays } });
  const recent = useApi("/dashboard/recent-sales", { params: { limit: 6 } });
  const alerts = useApi("/dashboard/alerts");

  const data = summary.data;
  const trendData = trend.data?.items || [];
  const paymentData = payments.data?.items || [];
  const topData = top.data?.items || [];
  const alertData = alerts.data || { low_stock: [], expiring: [], expired: [] };

  const paymentTotal = useMemo(
    () => paymentData.reduce((sum, item) => sum + item.amount, 0),
    [paymentData]
  );
  const maxTop = Math.max(...topData.map((item) => item.revenue), 1);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 18) return "مساء الخير";
    return "مساء الخير";
  }, []);

  const alertCount =
    alertData.low_stock.length + alertData.expiring.length + alertData.expired.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t(`${greeting}، {name}`, { name: user?.name?.split(" ")[0] || "" })}
        subtitle={t("ملخص سريع لأداء الصيدلية وتنبيهات المخزون")}
        badge={
          <Badge tone="brand" dot>
            {summary.loading
              ? "..."
              : t("{count} صنف نشط", { count: data?.medicines_count ?? 0 })}
          </Badge>
        }
        actions={
          <>
            <Tabs
              value={range}
              onChange={setRange}
              options={RANGES.map((option) => ({ ...option, label: t(option.label) }))}
              size="sm"
            />
            <Link to="/pos">
              <Button>
                <ScanBarcode className="size-4" />
                {t("فاتورة جديدة")}
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("إيرادات الفترة")}
          value={money(data?.revenue, currency)}
          hint={t("مبيعات مكتملة")}
          change={data?.revenue_change}
          icon={Wallet}
          tone="brand"
          loading={summary.loading}
        />
        <StatCard
          title={t("عدد الفواتير")}
          value={data?.invoices ?? "—"}
          hint={t("متوسط الفاتورة {amount}", {
            amount: money(data?.average_invoice, currency),
          })}
          change={data?.invoices_change}
          icon={ReceiptText}
          tone="sky"
          loading={summary.loading}
        />
        <StatCard
          title={t("صافي الربح")}
          value={money(data?.profit, currency)}
          hint={t("هامش التشغيل · {value}", {
            value: money(data?.profit, currency, false),
          })}
          change={data?.profit_change}
          icon={TrendingUp}
          tone="emerald"
          loading={summary.loading}
        />
        <StatCard
          title={t("الأصناف المباعة")}
          value={data?.items_sold ?? "—"}
          hint={t("وحدة (علبة/شريط)")}
          icon={Boxes}
          tone="amber"
          loading={summary.loading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t("حركة المبيعات والأرباح")}
            subtitle={t("آخر {days} يومًا", { days: trendDays })}
            icon={TrendingUp}
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
            {trend.loading && !trend.data ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
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
                    width={54}
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
                    fill="url(#revenueFill)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name={t("الأرباح")}
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#profitFill)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t("طرق الدفع")}
            subtitle={t("توزيع آخر {days} يوم", { days: itemDays })}
            icon={CircleDollarSign}
          />
          <div className="relative h-52 p-4">
            {payments.loading && !payments.data ? (
              <Skeleton className="mx-auto h-full w-40 rounded-full" />
            ) : paymentData.length ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      dataKey="amount"
                      nameKey="method"
                      innerRadius={54}
                      outerRadius={76}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {paymentData.map((entry, index) => (
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
              <EmptyState title={t("لا توجد مبيعات")} className="py-6" icon={CircleDollarSign} />
            )}
          </div>
          <div className="space-y-2 px-5 pb-5">
            {paymentData.map((item, index) => (
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

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t("أحدث الفواتير")}
            subtitle={t("آخر العمليات المسجلة على النظام")}
            icon={ReceiptText}
            action={
              <Link
                to="/sales"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:underline dark:text-brand-300"
              >
                {t("كل الفواتير")}
                <ChevronLeft className="size-3.5" />
              </Link>
            }
          />
          <div className="mt-3 overflow-x-auto">
            {recent.loading && !recent.data ? (
              <div className="space-y-2 p-5 pt-2">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-12 w-full" />
                ))}
              </div>
            ) : recent.data?.items?.length ? (
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-start text-[11px] text-muted">
                    <th className="px-5 py-2.5 text-start font-semibold">{t("رقم الفاتورة")}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">{t("الصنف")}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">{t("الدفع")}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">{t("الحالة")}</th>
                    <th className="px-5 py-2.5 text-end font-semibold">{t("الصافي")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data.items.map((sale) => {
                    const status = statusMeta[sale.status] || statusMeta.completed;
                    return (
                      <tr key={sale.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                        <td className="px-5 py-3">
                          <p className="font-semibold nums text-xs">{sale.invoice_number}</p>
                          <p className="text-[10px] text-muted">{formatDateTime(sale.created_at)}</p>
                        </td>
                        <td className="max-w-40 truncate px-3 py-3 text-xs text-muted">
                          {sale.first_item || "—"}
                          {sale.items_count > 1 ? ` +${sale.items_count - 1}` : ""}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone="neutral">{paymentLabels[sale.payment_method] || sale.payment_method}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={status.tone} dot>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-end font-bold nums text-xs">
                          {money(sale.net_amount, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState
                icon={ReceiptText}
                title={t("لا توجد فواتير بعد")}
                description={t("ابدأ أول عملية بيع من شاشة نقطة البيع.")}
                action={
                  <Link to="/pos">
                    <Button size="sm">
                      <Plus className="size-4" />
                      {t("بدء البيع")}
                    </Button>
                  </Link>
                }
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t("الأكثر مبيعًا")}
            subtitle={t("خلال {days} يوم", { days: itemDays })}
            icon={Sparkles}
          />
          <div className="space-y-3.5 p-5">
            {top.loading && !top.data
              ? [0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-10 w-full" />)
              : topData.length
                ? topData.map((item, index) => (
                    <div key={item.name}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-surface-2 text-[10px] font-bold text-muted">
                            {index + 1}
                          </span>
                          <span className="truncate font-semibold">{item.name}</span>
                        </span>
                        <span className="shrink-0 font-bold nums">{money(item.revenue, currency, false)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full brand-gradient"
                          style={{ width: `${Math.max(6, (item.revenue / maxTop) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-muted">
                        {t("{count} وحدة مباعة", { count: item.quantity })}
                      </p>
                    </div>
                  ))
                : <EmptyState icon={Sparkles} title={t("لا توجد بيانات كافية")} className="py-8" />}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t("مركز المخزون")}
            subtitle={t("{count} تنبيه يحتاج متابعة", { count: alertCount })}
            icon={AlertTriangle}
            action={
              <Link
                to="/inventory"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:underline dark:text-brand-300"
              >
                {t("إدارة المخزون")}
                <ChevronLeft className="size-3.5" />
              </Link>
            }
          />
          <div className="p-5">
            <Tabs
              value={alertTab}
              onChange={setAlertTab}
              size="sm"
              options={[
                { value: "low", label: t("نواقص المخزون"), count: alertData.low_stock.length },
                { value: "expiring", label: t("قرب الانتهاء"), count: alertData.expiring.length },
                { value: "expired", label: t("منتهي الصلاحية"), count: alertData.expired.length },
              ]}
            />
            <div className="mt-4 space-y-2">
              {(alertTab === "low" ? alertData.low_stock : alertData[alertTab])?.slice(0, 5).map((item) => (
                <Link
                  key={item.id || item.batch_id}
                  to={`/inventory?q=${encodeURIComponent(item.name)}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 transition hover:border-brand-300 hover:bg-brand-50/40 dark:hover:bg-brand-950/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                      {alertTab === "low" ? <Boxes className="size-4" /> : <CalendarClock className="size-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{item.name}</p>
                      <p className="text-[10px] text-muted">
                        {alertTab === "low"
                          ? t("المتاح {boxes} علبة · {strips} شريط", {
                              boxes: item.boxes,
                              strips: item.strips,
                            })
                          : t("تشغيلة {batch} · {days} يوم", {
                              batch: item.batch_number,
                              days: item.days_left,
                            })}
                      </p>
                    </div>
                  </div>
                  <Badge tone={alertTab === "low" ? "warning" : alertTab === "expired" ? "danger" : "info"}>
                    {alertTab === "low"
                      ? item.status === "out"
                        ? t("نافد")
                        : t("منخفض")
                      : alertTab === "expired"
                        ? t("منتهي")
                        : t("قريب")}
                  </Badge>
                </Link>
              ))}
              {!(alertTab === "low" ? alertData.low_stock : alertData[alertTab])?.length ? (
                <EmptyState
                  title={t("لا توجد تنبيهات")}
                  description={t("المخزون في حالة جيدة.")}
                  icon={Boxes}
                  className="py-8"
                />
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="brand-gradient relative p-5 text-white">
            <div className="grid-pattern absolute inset-0 opacity-40" />
            <div className="relative">
              <p className="text-xs font-semibold text-white/80">{t("إجراءات سريعة")}</p>
              <h3 className="mt-1 text-lg font-bold">{t("واصل يومك بسرعة")}</h3>
              <p className="mt-1 text-[11px] leading-6 text-white/70">
                {t("اختصارات لأكثر المهام تكرارًا داخل الصيدلية.")}
              </p>
            </div>
          </div>
          <div className="space-y-2 p-4">
            <Link
              to="/pos"
              className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-xs font-semibold transition hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/30"
            >
              <span className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <ScanBarcode className="size-4" />
                </span>
                {t("بدء فاتورة بيع جديدة")}
              </span>
              <ArrowUpRight className="size-4 text-muted" />
            </Link>
            {user?.role !== "cashier" ? (
              <Link
                to="/inventory"
                className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-xs font-semibold transition hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/30"
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    <Plus className="size-4" />
                  </span>
                  {t("إضافة صنف أو تشغيلة")}
                </span>
                <ArrowUpRight className="size-4 text-muted" />
              </Link>
            ) : null}
            <Link
              to="/sales"
              className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-xs font-semibold transition hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/30"
            >
              <span className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <ReceiptText className="size-4" />
                </span>
                {t("مراجعة الفواتير")}
              </span>
              <ArrowUpRight className="size-4 text-muted" />
            </Link>
            {user?.role !== "cashier" ? (
              <Link
                to="/reports"
                className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-xs font-semibold transition hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/30"
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <TrendingUp className="size-4" />
                  </span>
                  {t("تحليل أداء المبيعات")}
                </span>
                <ArrowUpRight className="size-4 text-muted" />
              </Link>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
