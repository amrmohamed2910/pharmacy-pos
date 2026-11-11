import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useApi, useDebounced } from "../hooks/useApi";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { useI18n } from "../i18n";
import { api, downloadFile } from "../lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  Tabs,
} from "../components/ui";
import { ConfirmDialog, Modal } from "../components/ui/overlays";
import { Receipt } from "../components/Receipt";
import {
  cn,
  formatDateTime,
  money,
  paymentLabels,
  statusMeta,
  todayISO,
  unitLabels,
} from "../lib/utils";

const STATUS_TABS = [
  { value: "all", label: "الكل" },
  { value: "completed", label: "مكتملة" },
  { value: "refunded", label: "مرتجعة" },
];

export default function Sales() {
  const { user } = useAuth();
  const { settings, currency } = useSettings();
  const toast = useToast();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const debouncedQ = useDebounced(q, 350);
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [expanded, setExpanded] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);
  const [confirmRefund, setConfirmRefund] = useState(null);
  const [busy, setBusy] = useState(false);

  const sales = useApi("/sales", {
    params: {
      q: debouncedQ || undefined,
      from: from || undefined,
      to: to || undefined,
      payment_method: payment || undefined,
      status: status === "all" ? undefined : status,
      page,
      page_size: pageSize,
    },
    deps: [debouncedQ, status, payment, from, to, page],
  });

  const items = sales.data?.items || [];
  const pageTotal = useMemo(
    () => items.filter((sale) => sale.status === "completed").reduce((sum, sale) => sum + sale.net_amount, 0),
    [items]
  );

  function setRange(days) {
    if (days === "all") {
      setFrom("");
      setTo("");
    } else {
      setFrom(todayISO(-(days - 1)));
      setTo(todayISO());
    }
    setPage(1);
  }

  async function exportExcel() {
    try {
      await downloadFile("/reports/export/sales.xlsx", `sales-${from || "all"}-${to || "all"}.xlsx`, {
        from: from || undefined,
        to: to || undefined,
      });
      toast.success(t("تم تصدير الفواتير"));
    } catch (error) {
      toast.error(t("تعذر التصدير"), error.message);
    }
  }

  async function refund() {
    if (!confirmRefund) return;
    setBusy(true);
    try {
      await api.post(`/sales/${confirmRefund.id}/refund`);
      toast.success(
        t("تم إرجاع الفاتورة"),
        t("تم إعادة الكميات إلى المخزون · {no}", { no: confirmRefund.invoice_number })
      );
      setConfirmRefund(null);
      sales.refetch({ quiet: true });
    } catch (error) {
      toast.error(t("تعذر الإرجاع"), error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("الفواتير")}
        subtitle={t("سجل كامل للمبيعات، إعادة الطباعة وإدارة المرتجعات")}
        actions={
          <>
            <Button variant="secondary" onClick={exportExcel}>
              <FileSpreadsheet className="size-4" />
              {t("تصدير Excel")}
            </Button>
            <Link to="/pos">
              <Button>
                <ReceiptText className="size-4" />
                {t("فاتورة جديدة")}
              </Button>
            </Link>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="lg:w-72">
            <Input
              icon={Search}
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder={t("رقم الفاتورة أو اسم العميل")}
            />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-muted">{t("من تاريخ")}</span>
              <Input
                type="date"
                size="sm"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-muted">{t("إلى تاريخ")}</span>
              <Input
                type="date"
                size="sm"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-muted">{t("طريقة الدفع")}</span>
              <Select
                size="sm"
                value={payment}
                onChange={(event) => {
                  setPayment(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("الكل")}</option>
                <option value="كاش">{t("كاش")}</option>
                <option value="شبكة">{t("شبكة")}</option>
                <option value="آجل">{t("آجل")}</option>
              </Select>
            </label>
            <div className="flex items-end gap-1">
              {[
                { label: t("اليوم"), days: 1 },
                { label: t("7 أيام"), days: 7 },
                { label: t("30 يوم"), days: 30 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setRange(preset.days)}
                  className="flex-1 rounded-lg border border-line px-1 py-2 text-[10px] font-semibold text-muted transition hover:border-brand-300 hover:text-ink"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRange("all")}
                className="grid size-8.5 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:border-rose-300 hover:text-rose-500"
                aria-label={t("مسح الفترة")}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Tabs value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={STATUS_TABS} size="sm" />
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted">{t("إجمالي المعروض")}</span>
            <span className="rounded-lg bg-surface-2 px-2.5 py-1 font-bold nums">
              {money(pageTotal, currency)}
            </span>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {sales.loading && !sales.data ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={t("لا توجد فواتير")}
            description={t("لم يتم العثور على فواتير مطابقة للفلاتر المحددة.")}
            action={
              <Link to="/pos">
                <Button>
                  <ReceiptText className="size-4" />
                  {t("إنشاء فاتورة")}
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-[10px] text-muted">
                  <th className="w-8 px-3 py-3" />
                  <th className="px-3 py-3 text-start font-semibold">{t("رقم الفاتورة")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("التاريخ")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("العميل")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الأصناف")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الدفع")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الحالة")}</th>
                  <th className="px-3 py-3 text-end font-semibold">{t("الصافي")}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t("إجراءات")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sale) => {
                  const meta = statusMeta[sale.status] || statusMeta.completed;
                  const isOpen = expanded === sale.id;
                  return (
                    <>
                      <tr
                        key={sale.id}
                        onClick={() => setExpanded(isOpen ? null : sale.id)}
                        className="cursor-pointer border-b border-line/60 transition hover:bg-surface-2/60"
                      >
                        <td className="px-3 py-3">
                          <ChevronDown
                            className={cn("size-4 text-muted transition", isOpen && "rotate-180")}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs font-bold nums">{sale.invoice_number}</p>
                          <p className="text-[10px] text-muted">
                            {t("{count} صنف", { count: sale.items_count })}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-muted">{formatDateTime(sale.created_at)}</td>
                        <td className="max-w-32 truncate px-3 py-3 text-xs">{sale.customer_name || t("عميل نقدي")}</td>
                        <td className="max-w-44 truncate px-3 py-3 text-[11px] text-muted">
                          {sale.items?.[0]?.medicine_name || "—"}
                          {sale.items_count > 1 ? ` +${sale.items_count - 1}` : ""}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone="neutral">{paymentLabels[sale.payment_method] || sale.payment_method}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={meta.tone} dot>
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-end text-xs font-bold nums">
                          {money(sale.net_amount, currency)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setReceiptSale(sale);
                              }}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-brand-700"
                              aria-label={t("عرض الفاتورة")}
                            >
                              <Eye className="size-4" />
                            </button>
                            {sale.status === "completed" && user?.role !== "cashier" ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setConfirmRefund(sale);
                                }}
                                className="rounded-lg p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                                aria-label={t("إرجاع الفاتورة")}
                              >
                                <RotateCcw className="size-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr key={`${sale.id}-details`} className="border-b border-line bg-surface-2/40">
                          <td colSpan={9} className="px-8 py-3">
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {sale.items?.map((item) => {
                                const qty = item.quantity_boxes_sold || item.quantity_strips_sold;
                                const unit = item.quantity_boxes_sold > 0 ? "box" : "strip";
                                return (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-[11px]"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold">{item.medicine_name}</p>
                                      <p className="text-[10px] text-muted">
                                        {t("{qty} {unit} × {price} · تشغيلة {batch}", {
                                          qty,
                                          unit: unitLabels[unit],
                                          price: money(item.unit_price, currency),
                                          batch: item.batch_number,
                                        })}
                                      </p>
                                    </div>
                                    <span className="shrink-0 font-bold nums">
                                      {money(item.subtotal, currency)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
                              <span>{t("المجموع")}: <b className="nums">{money(sale.total_amount, currency)}</b></span>
                              <span>{t("الخصم")}: <b className="nums">{money(sale.discount, currency)}</b></span>
                              <span>{t("المدفوع")}: <b className="nums">{money(sale.paid_amount, currency)}</b></span>
                              {sale.profit !== undefined ? (
                                <span>{t("الربح")}: <b className="nums">{money(sale.profit, currency)}</b></span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          pages={sales.data?.pages || 1}
          total={sales.data?.total || 0}
          pageSize={pageSize}
          onChange={setPage}
        />
      </Card>

      <Modal
        open={Boolean(receiptSale)}
        onClose={() => setReceiptSale(null)}
        title={t("فاتورة بيع")}
        description={receiptSale?.invoice_number}
        icon={ReceiptText}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiptSale(null)}>
              {t("إغلاق")}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" />
              {t("طباعة")}
            </Button>
          </>
        }
      >
        <Receipt sale={receiptSale} settings={settings} currency={currency} />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmRefund)}
        onClose={() => setConfirmRefund(null)}
        onConfirm={refund}
        loading={busy}
        title={t("إرجاع الفاتورة")}
        description={t("سيتم إرجاع كميات الفاتورة {no} إلى المخزون وتسجيل العملية كمرتجع. لا يمكن التراجع عن هذا الإجراء.", {
          no: confirmRefund?.invoice_number || "",
        })}
        confirmLabel={t("تأكيد الإرجاع")}
      />
    </div>
  );
}
