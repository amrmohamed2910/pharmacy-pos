import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { useApi, useDebounced } from "../hooks/useApi";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "../components/ui";
import { ConfirmDialog, Modal } from "../components/ui/overlays";
import {
  cn,
  formatDate,
  formatDateTime,
  money,
  paymentLabels,
  statusMeta,
  todayISO,
} from "../lib/utils";

const PAGE_TABS = [
  { value: "invoices", label: "فواتير الشراء", icon: ShoppingCart },
  { value: "suppliers", label: "الموردون", icon: Truck },
];

const PAYMENT_OPTIONS = [
  { value: "كاش", label: "كاش" },
  { value: "شبكة", label: "شبكة / فيزا" },
  { value: "آجل", label: "آجل" },
];

const EMPTY_SUPPLIER = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  is_active: true,
};

function newItem() {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    medicine_id: "",
    batch_number: "",
    expiry_date: "",
    buy_price: "",
    sell_price: "",
    quantity_boxes: "0",
    quantity_strips: "0",
  };
}

export default function Purchases() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const toast = useToast();
  const { t } = useI18n();

  const [tab, setTab] = useState("invoices");
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [supplierForm, setSupplierForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const suppliers = useApi("/suppliers");
  const supplierList = suppliers.data?.items || [];

  function refreshAll() {
    suppliers.refetch({ quiet: true });
    setRefreshKey((value) => value + 1);
  }

  async function handleConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.type === "supplier") {
        const response = await api.delete(`/suppliers/${confirm.item.id}`);
        toast.success(t("تم تنفيذ العملية"), response?.message);
      } else if (confirm.type === "purchase") {
        toast.info(
          t("لا يمكن حذف فواتير الشراء"),
          t("يمكنك تعديل المخزون مباشرة من شاشة الأصناف.")
        );
      }
      setConfirm(null);
      refreshAll();
    } catch (error) {
      toast.error(t("تعذر تنفيذ العملية"), error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("المشتريات والموردون")}
        subtitle={t("تسجيل فواتير الشراء، إدارة الموردين ومتابعة البضاعة الواردة")}
        actions={
          tab === "invoices" ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              {t("فاتورة شراء")}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setSupplierForm({ supplier: null });
              }}
            >
              <Plus className="size-4" />
              {t("إضافة مورد")}
            </Button>
          )
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        options={PAGE_TABS.map((option) =>
          option.value === "suppliers"
            ? { ...option, count: supplierList.length || undefined }
            : option
        )}
      />

      {tab === "invoices" ? (
        <PurchaseList
          currency={currency}
          refreshKey={refreshKey}
          onOpen={setDetail}
          suppliers={supplierList}
        />
      ) : (
        <SupplierList
          suppliers={suppliers}
          currency={currency}
          onEdit={(supplier) => setSupplierForm({ supplier })}
          onDelete={(supplier) => setConfirm({ type: "supplier", item: supplier })}
          isAdmin={user?.role === "admin"}
        />
      )}

      <PurchaseModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        suppliers={supplierList}
        currency={currency}
        onSaved={(purchase) => {
          setFormOpen(false);
          refreshAll();
          toast.success(t("تم تسجيل فاتورة الشراء"), purchase?.invoice_number);
        }}
      />

      <PurchaseDetail
        purchase={detail}
        currency={currency}
        onClose={() => setDetail(null)}
      />

      <SupplierModal
        open={Boolean(supplierForm)}
        supplier={supplierForm?.supplier}
        onClose={() => setSupplierForm(null)}
        onSaved={() => {
          setSupplierForm(null);
          refreshAll();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        loading={busy}
        title={t("حذف المورد")}
        description={t(
          "سيتم حذف «{name}» نهائيًا إن لم يكن مرتبطًا بفواتير شراء، وإلا سيتم أرشفته.",
          { name: confirm?.item?.name || "" }
        )}
        confirmLabel={t("تأكيد الحذف")}
      />
    </div>
  );
}

/* ------------------------------- Purchase list ------------------------------ */
function PurchaseList({ currency, refreshKey, onOpen, suppliers }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 350);
  const [supplierId, setSupplierId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [expanded, setExpanded] = useState(null);

  const purchases = useApi("/purchases", {
    params: {
      q: debouncedQ || undefined,
      supplier_id: supplierId || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      page_size: pageSize,
    },
    deps: [debouncedQ, supplierId, from, to, page, refreshKey],
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, supplierId, from, to]);

  const items = purchases.data?.items || [];
  const totals = useMemo(
    () =>
      items.reduce(
        (acc, purchase) => {
          acc.total += purchase.total_amount;
          if (purchase.payment_method === "آجل") acc.credit += purchase.total_amount;
          return acc;
        },
        { total: 0, credit: 0 }
      ),
    [items]
  );

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="lg:w-72">
            <Input
              icon={Search}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t("رقم الفاتورة أو اسم المورد")}
            />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-muted">{t("المورد")}</span>
              <Select size="sm" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                <option value="">{t("كل الموردين")}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-muted">{t("من تاريخ")}</span>
              <Input type="date" size="sm" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-muted">{t("إلى تاريخ")}</span>
              <Input type="date" size="sm" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end">
            <div className="text-[11px] text-muted">
              {t("إجمالي المعروض")}{" "}
              <span className="rounded-lg bg-surface-2 px-2 py-1 font-bold nums">
                {money(totals.total, currency)}
              </span>
            </div>
            {totals.credit > 0 ? (
              <div className="text-[11px] text-muted">
                {t("مستحق آجل")}{" "}
                <span className="rounded-lg bg-amber-50 px-2 py-1 font-bold text-amber-700 nums dark:bg-amber-950/50 dark:text-amber-300">
                  {money(totals.credit, currency)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {purchases.loading && !purchases.data ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={t("لا توجد فواتير شراء")}
            description={t("سجّل فاتورة شراء جديدة لإضافة كميات إلى المخزون.")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-[10px] text-muted">
                  <th className="w-8 px-3 py-3" />
                  <th className="px-3 py-3 text-start font-semibold">{t("رقم الفاتورة")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("المورد")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("التاريخ")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الأصناف")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الدفع")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الحالة")}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t("الإجمالي")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((purchase) => {
                  const meta = statusMeta[purchase.status] || statusMeta.received;
                  const isOpen = expanded === purchase.id;
                  return (
                    <>
                      <tr
                        key={purchase.id}
                        onClick={() => setExpanded(isOpen ? null : purchase.id)}
                        className="cursor-pointer border-b border-line/60 transition hover:bg-surface-2/60"
                      >
                        <td className="px-3 py-3">
                          <ChevronDown className={cn("size-4 text-muted transition", isOpen && "rotate-180")} />
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs font-bold nums">{purchase.invoice_number}</p>
                          <p className="text-[10px] text-muted">
                            {t("{count} صنف", { count: purchase.items_count })}
                          </p>
                        </td>
                        <td className="max-w-40 truncate px-3 py-3 text-xs">
                          {purchase.supplier_name || t("مورد نقدي")}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-muted">
                          {formatDateTime(purchase.created_at)}
                        </td>
                        <td className="max-w-44 truncate px-3 py-3 text-[11px] text-muted">
                          {purchase.items?.[0]?.medicine_name || "—"}
                          {purchase.items_count > 1 ? ` +${purchase.items_count - 1}` : ""}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone="neutral">
                            {paymentLabels[purchase.payment_method] || purchase.payment_method}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={meta.tone} dot>
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-end text-xs font-bold nums">
                          {money(purchase.total_amount, currency)}
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr key={`${purchase.id}-details`} className="border-b border-line bg-surface-2/40">
                          <td colSpan={8} className="px-8 py-3">
                            <div className="space-y-1.5">
                              {purchase.items?.map((item) => (
                                <div
                                  key={item.id}
                                  className="grid grid-cols-2 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] sm:grid-cols-5"
                                >
                                  <span className="truncate font-semibold sm:col-span-2">
                                    {item.medicine_name}
                                  </span>
                                  <span className="text-muted" dir="ltr">
                                    {item.batch_number}
                                  </span>
                                  <span className="text-muted nums">
                                    {t("{boxes} علبة · {strips} شريط", {
                                      boxes: item.quantity_boxes,
                                      strips: item.quantity_strips,
                                    })}
                                  </span>
                                  <span className="text-end font-bold nums">
                                    {money(item.subtotal, currency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
                              <span>
                                {t("الإجمالي")}:{" "}
                                <b className="nums">{money(purchase.total_amount, currency)}</b>
                              </span>
                              <span>
                                {t("المدفوع")}:{" "}
                                <b className="nums">{money(purchase.paid_amount, currency)}</b>
                              </span>
                              {purchase.notes ? (
                                <span>
                                  {t("ملاحظات")}: {purchase.notes}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onOpen(purchase);
                                }}
                                className="ms-auto font-bold text-brand-700 hover:underline dark:text-brand-300"
                              >
                                {t("عرض التفاصيل")}
                              </button>
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
          pages={purchases.data?.pages || 1}
          total={purchases.data?.total || 0}
          pageSize={pageSize}
          onChange={setPage}
        />
      </Card>
    </>
  );
}

/* ------------------------------- Supplier list ------------------------------ */
function SupplierList({ suppliers, currency, onEdit, onDelete, isAdmin }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const list = (suppliers.data?.items || []).filter((supplier) =>
    q.trim() ? `${supplier.name} ${supplier.phone || ""} ${supplier.address || ""}`.includes(q.trim()) : true
  );

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:w-80">
            <Input
              icon={Search}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t("ابحث باسم المورد أو الهاتف")}
            />
          </div>
          <div className="ms-auto text-[11px] text-muted">
            {suppliers.loading
              ? t("جارٍ التحديث…")
              : t("{count} مورد", { count: list.length })}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {suppliers.loading && !suppliers.data ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={t("لا يوجد موردون")}
            description={t("أضف أول مورد لتسجيل فواتير الشراء باسمه.")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-[10px] text-muted">
                  <th className="px-5 py-3 text-start font-semibold">{t("المورد")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("بيانات التواصل")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("العنوان")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الفواتير")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("إجمالي المشتريات")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الحالة")}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t("إجراءات")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-bold">{supplier.name}</p>
                      {supplier.notes ? (
                        <p className="max-w-52 truncate text-[10px] text-muted">{supplier.notes}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="text-[11px] text-muted" dir="ltr">{supplier.phone || "—"}</p>
                      <p className="text-[10px] text-muted" dir="ltr">{supplier.email || ""}</p>
                    </td>
                    <td className="max-w-44 truncate px-3 py-3.5 text-[11px] text-muted">
                      {supplier.address || "—"}
                    </td>
                    <td className="px-3 py-3.5 text-xs font-semibold nums">{supplier.purchases_count}</td>
                    <td className="px-3 py-3.5 text-xs font-bold nums">
                      {money(supplier.total_purchases, currency)}
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge tone={supplier.is_active ? "success" : "neutral"} dot>
                        {supplier.is_active ? t("نشط") : t("مؤرشف")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(supplier)}
                          className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-brand-700"
                          aria-label={t("تعديل المورد")}
                        >
                          <UserRound className="size-4" />
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => onDelete(supplier)}
                            className="rounded-lg p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                            aria-label={t("حذف المورد")}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* ------------------------------- Purchase modal ----------------------------- */
function PurchaseModal({ open, onClose, suppliers, currency, onSaved }) {
  const toast = useToast();
  const { t } = useI18n();
  const medicines = useApi("/medicines", { params: { page_size: 100 }, enabled: open });
  const [form, setForm] = useState({
    supplier_id: "",
    supplier_name: "",
    invoice_number: "",
    payment_method: "كاش",
    paid_amount: "",
    notes: "",
    items: [newItem()],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const medicineList = medicines.data?.items || [];
  const medicineMap = useMemo(
    () => Object.fromEntries(medicineList.map((medicine) => [String(medicine.id), medicine])),
    [medicineList]
  );

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      supplier_id: "",
      supplier_name: "",
      invoice_number: "",
      payment_method: "كاش",
      paid_amount: "",
      notes: "",
      items: [newItem()],
    });
  }, [open]);

  function updateItem(key, patch) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  }

  function pickMedicine(key, value) {
    const medicine = medicineMap[value];
    updateItem(key, {
      medicine_id: value,
      buy_price: medicine ? String(medicine.cost_price || "") : "",
      sell_price: medicine ? String(medicine.sell_price || "") : "",
    });
  }

  const itemRows = form.items.map((item) => {
    const medicine = medicineMap[item.medicine_id];
    const spb = medicine?.strips_per_box || 1;
    const boxes = Number(item.quantity_boxes) || 0;
    const strips = Number(item.quantity_strips) || 0;
    const buy = Number(item.buy_price) || 0;
    const subtotal = boxes * buy + (strips * buy) / spb;
    return { ...item, medicine, spb, subtotal };
  });
  const total = itemRows.reduce((sum, item) => sum + item.subtotal, 0);
  const paid = Number(form.paid_amount) || 0;

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!form.supplier_id && !form.supplier_name.trim()) {
      setError(t("اختر موردًا أو اكتب اسم المورد"));
      return;
    }

    const items = [];
    for (const [index, row] of itemRows.entries()) {
      if (!row.medicine_id) {
        setError(t("اختر صنفًا في السطر {number}", { number: index + 1 }));
        return;
      }
      if (!row.batch_number.trim() || !row.expiry_date) {
        setError(
          t("أدخل رقم التشغيلة وتاريخ الانتهاء للصنف «{name}»", {
            name: row.medicine?.trade_name,
          })
        );
        return;
      }
      if (row.expiry_date < todayISO()) {
        setError(
          t("تاريخ انتهاء تشغيلة «{name}» يجب أن يكون في المستقبل", {
            name: row.medicine?.trade_name,
          })
        );
        return;
      }
      if ((Number(row.quantity_boxes) || 0) + (Number(row.quantity_strips) || 0) <= 0) {
        setError(t("أدخل كمية للصنف «{name}»", { name: row.medicine?.trade_name }));
        return;
      }
      items.push({
        medicine_id: Number(row.medicine_id),
        batch_number: row.batch_number.trim(),
        expiry_date: row.expiry_date,
        buy_price: Number(row.buy_price) || 0,
        sell_price: Number(row.sell_price) || 0,
        quantity_boxes: Number(row.quantity_boxes) || 0,
        quantity_strips: Number(row.quantity_strips) || 0,
      });
    }

    setSaving(true);
    try {
      const saved = await api.post("/purchases", {
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        supplier_name: form.supplier_id ? null : form.supplier_name.trim(),
        invoice_number: form.invoice_number.trim() || null,
        payment_method: form.payment_method,
        paid_amount: paid > 0 ? paid : total,
        notes: form.notes.trim() || null,
        items,
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("فاتورة شراء جديدة")}
      description={t("أضف الأصناف والكميات لتحديث المخزون تلقائيًا")}
      icon={ShoppingCart}
      size="xl"
      footer={
        <>
          <div className="me-auto flex flex-wrap items-center gap-4 text-xs">
            <span className="text-muted">
              {t("الإجمالي")}: <b className="nums text-ink">{money(total, currency)}</b>
            </span>
            <span className="text-muted">
              {t("المتبقي")}:{" "}
              <b className={cn("nums", total - paid > 0 ? "text-amber-600 dark:text-amber-400" : "text-ink")}>
                {money(Math.max(total - paid, 0), currency)}
              </b>
            </span>
          </div>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("إلغاء")}
          </Button>
          <Button form="purchase-form" type="submit" loading={saving}>
            {t("تسجيل الفاتورة")}
          </Button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("المورد")}>
            <Select
              value={form.supplier_id}
              onChange={(event) =>
                setForm({ ...form, supplier_id: event.target.value, supplier_name: "" })
              }
            >
              <option value="">{t("مورد نقدي / غير مسجل")}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
          {!form.supplier_id ? (
            <Field label={t("اسم المورد")} required>
              <Input
                value={form.supplier_name}
                onChange={(event) => setForm({ ...form, supplier_name: event.target.value })}
                placeholder={t("اسم المورد")}
              />
            </Field>
          ) : (
            <Field label={t("رقم فاتورة المورد")} hint={t("اختياري")}>
              <Input
                value={form.invoice_number}
                onChange={(event) => setForm({ ...form, invoice_number: event.target.value })}
                placeholder="INV-2026-001"
                dir="ltr"
              />
            </Field>
          )}
          <Field label={t("طريقة الدفع")}>
            <Select
              value={form.payment_method}
              onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
            >
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("المبلغ المدفوع")} hint={t("اتركه فارغًا لدفع كامل الإجمالي")}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.paid_amount}
              onChange={(event) => setForm({ ...form, paid_amount: event.target.value })}
              placeholder={String(total.toFixed(2))}
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-line">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
            <p className="text-xs font-bold">
              {t("أصناف الفاتورة ({count})", { count: form.items.length })}
            </p>
            <Button
              size="sm"
              variant="soft"
              onClick={() => setForm((current) => ({ ...current, items: [...current.items, newItem()] }))}
            >
              <Plus className="size-3.5" />
              {t("إضافة صنف")}
            </Button>
          </div>

          <div className="space-y-3 p-3.5">
            {itemRows.map((row, index) => (
              <div key={row.key} className="rounded-xl border border-line bg-surface-2/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-muted">
                    {t("السطر {number}", { number: index + 1 })}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold nums">
                      {money(row.subtotal, currency)}
                    </span>
                    {form.items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            items: current.items.filter((item) => item.key !== row.key),
                          }))
                        }
                        className="rounded-lg p-1 text-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                        aria-label={t("حذف السطر")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block lg:col-span-2">
                    <span className="mb-1 block text-[10px] font-semibold text-muted">
                      {t("الصنف *")}
                    </span>
                    <Select
                      size="sm"
                      value={row.medicine_id}
                      onChange={(event) => pickMedicine(row.key, event.target.value)}
                    >
                      <option value="">{t("— اختر الصنف —")}</option>
                      {medicineList.map((medicine) => (
                        <option key={medicine.id} value={medicine.id}>
                          {medicine.trade_name} · {medicine.scientific_name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-muted">
                      {t("رقم التشغيلة *")}
                    </span>
                    <Input
                      size="sm"
                      value={row.batch_number}
                      onChange={(event) => updateItem(row.key, { batch_number: event.target.value })}
                      placeholder="B2026-01"
                      dir="ltr"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-muted">
                      {t("تاريخ الانتهاء *")}
                    </span>
                    <Input
                      type="date"
                      size="sm"
                      value={row.expiry_date}
                      onChange={(event) => updateItem(row.key, { expiry_date: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-muted">
                      {t("سعر الشراء")}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      size="sm"
                      value={row.buy_price}
                      onChange={(event) => updateItem(row.key, { buy_price: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-muted">
                      {t("سعر البيع")}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      size="sm"
                      value={row.sell_price}
                      onChange={(event) => updateItem(row.key, { sell_price: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-muted">
                      {t("عدد العلب")}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      size="sm"
                      value={row.quantity_boxes}
                      onChange={(event) => updateItem(row.key, { quantity_boxes: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-muted">
                      {t("عدد الأشرطة")}
                      {row.medicine ? (
                        <span className="text-muted/80">
                          {" "}
                          · {t("{count} شريط/علبة", { count: row.spb })}
                        </span>
                      ) : null}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      size="sm"
                      value={row.quantity_strips}
                      onChange={(event) => updateItem(row.key, { quantity_strips: event.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Field label={t("ملاحظات")}>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder={t("أي ملاحظات على الفاتورة أو الشحنة")}
          />
        </Field>
      </form>
    </Modal>
  );
}

/* ------------------------------- Purchase detail ---------------------------- */
function PurchaseDetail({ purchase, currency, onClose }) {
  const { t } = useI18n();
  return (
    <Modal
      open={Boolean(purchase)}
      onClose={onClose}
      title={t("تفاصيل فاتورة الشراء")}
      description={purchase?.invoice_number}
      icon={Truck}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("إغلاق")}
        </Button>
      }
    >
      {purchase ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] text-muted">{t("المورد")}</p>
              <p className="truncate text-xs font-bold">
                {purchase.supplier_name || t("مورد نقدي")}
              </p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] text-muted">{t("التاريخ")}</p>
              <p className="text-xs font-bold">{formatDateTime(purchase.created_at)}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] text-muted">{t("طريقة الدفع")}</p>
              <p className="text-xs font-bold">
                {paymentLabels[purchase.payment_method] || purchase.payment_method}
              </p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] text-muted">{t("الحالة")}</p>
              <Badge tone="success" dot>
                {t("مستلمة")}
              </Badge>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-[10px] text-muted">
                  <th className="px-3 py-2.5 text-start font-semibold">{t("الصنف")}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t("التشغيلة")}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t("الانتهاء")}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t("الكمية")}</th>
                  <th className="px-3 py-2.5 text-end font-semibold">{t("الإجمالي")}</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items?.map((item) => (
                  <tr key={item.id} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold">{item.medicine_name}</p>
                      <p className="text-[10px] text-muted nums">
                        {t("شراء {buy} · بيع {sell}", {
                          buy: money(item.buy_price, currency),
                          sell: money(item.sell_price, currency),
                        })}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-muted" dir="ltr">
                      {item.batch_number}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-muted">{formatDate(item.expiry_date)}</td>
                    <td className="px-3 py-2.5 text-[10px] text-muted nums">
                      {t("{boxes} علبة · {strips} شريط", {
                        boxes: item.quantity_boxes,
                        strips: item.quantity_strips,
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-end font-bold nums">
                      {money(item.subtotal, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 rounded-xl border border-line p-3.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">{t("الإجمالي")}</span>
              <span className="font-bold nums">{money(purchase.total_amount, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("المدفوع")}</span>
              <span className="font-bold nums">{money(purchase.paid_amount, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5">
              <span className="text-muted">{t("المتبقي")}</span>
              <span
                className={cn(
                  "font-bold nums",
                  purchase.total_amount - purchase.paid_amount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {money(Math.max(purchase.total_amount - purchase.paid_amount, 0), currency)}
              </span>
            </div>
          </div>

          {purchase.notes ? (
            <div className="rounded-xl bg-surface-2 p-3 text-[11px] text-muted">{purchase.notes}</div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

/* ------------------------------ Supplier modal ------------------------------ */
function SupplierModal({ open, supplier, onClose, onSaved }) {
  const toast = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (supplier) {
      setForm({
        name: supplier.name || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        notes: supplier.notes || "",
        is_active: supplier.is_active ?? true,
      });
    } else {
      setForm(EMPTY_SUPPLIER);
    }
  }, [open, supplier]);

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError(t("اسم المورد مطلوب"));
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    try {
      const saved = supplier
        ? await api.put(`/suppliers/${supplier.id}`, payload)
        : await api.post("/suppliers", payload);
      toast.success(
        supplier ? t("تم تحديث المورد") : t("تمت إضافة المورد"),
        saved.name
      );
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={supplier ? t("تعديل بيانات المورد") : t("إضافة مورد جديد")}
      description={t("بيانات التواصل الخاصة بالمورد لتسجيل فواتير الشراء")}
      icon={Building2}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("إلغاء")}
          </Button>
          <Button form="supplier-form" type="submit" loading={saving}>
            {supplier ? t("حفظ التعديلات") : t("إضافة المورد")}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        <Field label={t("اسم المورد")} required>
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder={t("مثال: شركة النيل للأدوية")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("رقم الهاتف")}>
            <Input
              icon={Phone}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="01000000000"
              dir="ltr"
            />
          </Field>
          <Field label={t("البريد الإلكتروني")}>
            <Input
              icon={Mail}
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="supplier@example.com"
              dir="ltr"
            />
          </Field>
        </div>

        <Field label={t("العنوان")}>
          <Input
            icon={MapPin}
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
            placeholder={t("المدينة - الشارع")}
          />
        </Field>

        <Field label={t("ملاحظات")}>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder={t("شروط الدفع، مواعيد التوريد…")}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5 py-3">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            className="size-4 accent-brand-600"
          />
          <span className="text-xs font-semibold">{t("المورد نشط ومتاح للتعامل")}</span>
        </label>
      </form>
    </Modal>
  );
}

/* ------------------------------ Supplier modal ------------------------------ */
