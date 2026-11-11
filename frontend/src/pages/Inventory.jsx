import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Archive,
  Barcode,
  Boxes,
  CalendarClock,
  Edit3,
  FileSpreadsheet,
  Filter,
  Package,
  PackagePlus,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
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
  Field,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  Tabs,
} from "../components/ui";
import { ConfirmDialog, Drawer, Modal } from "../components/ui/overlays";
import {
  cn,
  daysLeft,
  formatDate,
  formatDateTime,
  money,
  statusMeta,
} from "../lib/utils";

const STATUS_TABS = [
  { value: "all", label: "الكل" },
  { value: "ok", label: "متاح" },
  { value: "low", label: "منخفض" },
  { value: "out", label: "نافد" },
  { value: "expiring", label: "قريب الانتهاء" },
];

const EMPTY_MEDICINE = {
  trade_name: "",
  scientific_name: "",
  barcode: "",
  category: "",
  unit_type: "علبة",
  strips_per_box: "1",
  requires_prescription: false,
  min_stock_level: "10",
  tax_rate: "0",
  is_active: true,
};

export default function Inventory() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const toast = useToast();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const debouncedQ = useDebounced(q, 350);
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [batchState, setBatchState] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const medicines = useApi("/medicines", {
    params: {
      q: debouncedQ || undefined,
      status: status === "all" ? undefined : status,
      category: category || undefined,
      sort,
      page,
      page_size: pageSize,
    },
  });
  const categories = useApi("/medicines/categories");

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, category, sort]);

  const items = medicines.data?.items || [];
  const total = medicines.data?.total || 0;
  const pages = medicines.data?.pages || 1;

  async function exportExcel() {
    try {
      await downloadFile("/reports/export/inventory.xlsx", `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(t("تم تصدير المخزون"), t("تم حفظ ملف Excel على جهازك."));
    } catch (error) {
      toast.error(t("تعذر التصدير"), error.message);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.type === "medicine") {
        const response = await api.delete(`/medicines/${confirm.item.id}`);
        toast.success(t("تم الحذف"), response?.message);
        if (detailId === confirm.item.id) setDetailId(null);
      } else if (confirm.type === "batch") {
        await api.delete(`/batches/${confirm.item.id}`);
        toast.success(t("تم حذف التشغيلة"));
      }
      setConfirm(null);
      medicines.refetch({ quiet: true });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      toast.error(t("تعذر تنفيذ العملية"), error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("إدارة المخزون")}
        subtitle={t("متابعة الأصناف، التشغيلات، تواريخ الصلاحية ومستويات المخزون")}
        actions={
          <>
            <Button variant="secondary" onClick={exportExcel}>
              <FileSpreadsheet className="size-4" />
              {t("تصدير Excel")}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("إضافة صنف")}
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="lg:w-80">
            <Input
              icon={Search}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t("ابحث بالاسم، المادة الفعالة أو الباركود")}
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="w-44">
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">{t("كل التصنيفات")}</option>
                {(categories.data || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="name">{t("ترتيب: الاسم")}</option>
                <option value="stock">{t("الأقل مخزونًا")}</option>
                <option value="stock_desc">{t("الأكثر مخزونًا")}</option>
                <option value="sold">{t("الأكثر مبيعًا")}</option>
              </Select>
            </div>
            <div className="ms-auto flex items-center gap-2 text-[11px] text-muted">
              <Filter className="size-3.5" />
              {medicines.loading ? t("جارٍ التحديث…") : t("{count} صنف", { count: total })}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Tabs value={status} onChange={setStatus} options={STATUS_TABS} size="sm" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {medicines.loading && !medicines.data ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t("لا توجد أصناف مطابقة")}
            description={t("جرّب تعديل كلمات البحث أو أضف صنفًا جديدًا للمخزون.")}
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <PackagePlus className="size-4" />
                {t("إضافة صنف جديد")}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-[10px] text-muted">
                  <th className="px-5 py-3 text-start font-semibold">{t("الصنف")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("التصنيف")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("المخزون")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("سعر البيع")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("أقرب انتهاء")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("مبيعات 30 يوم")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("الحالة")}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t("إجراءات")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const meta = statusMeta[item.stock_status] || statusMeta.ok;
                  const expiryDays = daysLeft(item.nearest_expiry);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setDetailId(item.id)}
                      className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-surface-2/60"
                    >
                      <td className="max-w-64 px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-bold">{item.trade_name}</p>
                          {item.requires_prescription ? (
                            <ShieldAlert className="size-3.5 shrink-0 text-amber-500" title={t("يتطلب روشتة")} />
                          ) : null}
                        </div>
                        <p className="truncate text-[10px] text-muted">{item.scientific_name}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[11px] text-muted">{item.category || t("غير مصنف")}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="text-xs font-semibold nums">
                          {t("{count} علبة", { count: item.total_boxes })}
                          <span className="text-muted"> · {t("{count} شريط", { count: item.total_strips })}</span>
                        </p>
                        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              item.stock_status === "out"
                                ? "bg-rose-500"
                                : item.stock_status === "low"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            )}
                            style={{
                              width: `${Math.min(
                                100,
                                ((item.total_boxes + item.total_strips / (item.strips_per_box || 1)) /
                                  Math.max(item.min_stock_level * 3, 1)) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="text-xs font-bold nums">{money(item.sell_price, currency)}</p>
                        <p className="text-[10px] text-muted">
                          {t("شريط {price}", {
                            price: money(item.sell_price / (item.strips_per_box || 1), currency),
                          })}
                        </p>
                      </td>
                      <td className="px-3 py-3.5">
                        {item.nearest_expiry ? (
                          <>
                            <p className="text-xs">{formatDate(item.nearest_expiry)}</p>
                            <p
                              className={cn(
                                "text-[10px]",
                                expiryDays < 30 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted"
                              )}
                            >
                              {expiryDays < 0 ? t("منتهي") : t("متبقي {days} يوم", { days: expiryDays })}
                            </p>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-xs font-semibold nums">{item.sold_30d}</span>
                        <span className="text-[10px] text-muted"> {t("وحدة")}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge tone={meta.tone} dot>
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditing(item);
                              setFormOpen(true);
                            }}
                            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-brand-700"
                            aria-label={t("تعديل")}
                          >
                            <Edit3 className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setBatchState({ medicineId: item.id, batch: null, medicineName: item.trade_name });
                            }}
                            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-emerald-700"
                            aria-label={t("إضافة تشغيلة")}
                          >
                            <PackagePlus className="size-4" />
                          </button>
                          {user?.role === "admin" ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setConfirm({ type: "medicine", item });
                              }}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                              aria-label={t("حذف")}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={pages} total={total} pageSize={pageSize} onChange={setPage} />
      </Card>

      <MedicineModal
        open={formOpen}
        medicine={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          medicines.refetch({ quiet: true });
          categories.refetch({ quiet: true });
          setRefreshKey((value) => value + 1);
          if (saved?.id) setDetailId(saved.id);
        }}
      />

      <MedicineDrawer
        id={detailId}
        refreshKey={refreshKey}
        onClose={() => setDetailId(null)}
        onEdit={(medicine) => {
          setEditing(medicine);
          setFormOpen(true);
        }}
        onAddBatch={(medicine) =>
          setBatchState({ medicineId: medicine.id, batch: null, medicineName: medicine.trade_name })
        }
        onEditBatch={(medicine, batch) =>
          setBatchState({ medicineId: medicine.id, batch, medicineName: medicine.trade_name })
        }
        onDeleteBatch={(batch) => setConfirm({ type: "batch", item: batch })}
        onDelete={(medicine) => setConfirm({ type: "medicine", item: medicine })}
        currency={currency}
        isAdmin={user?.role === "admin"}
      />

      <BatchModal
        state={batchState}
        onClose={() => setBatchState(null)}
        onSaved={() => {
          setBatchState(null);
          medicines.refetch({ quiet: true });
          setRefreshKey((value) => value + 1);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        loading={busy}
        title={confirm?.type === "medicine" ? t("حذف الصنف") : t("حذف التشغيلة")}
        description={
          confirm?.type === "medicine"
            ? t("سيتم حذف «{name}» نهائيًا إن لم يكن مرتبطًا بفواتير، وإلا سيتم أرشفته.", {
                name: confirm?.item?.trade_name,
              })
            : t("سيتم حذف التشغيلة «{batch}» من المخزون.", {
                batch: confirm?.item?.batch_number,
              })
        }
        confirmLabel={t("تأكيد الحذف")}
      />
    </div>
  );
}

/* ------------------------------ Medicine modal ----------------------------- */
function MedicineModal({ open, medicine, onClose, onSaved }) {
  const toast = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_MEDICINE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (medicine) {
      setForm({
        trade_name: medicine.trade_name || "",
        scientific_name: medicine.scientific_name || "",
        barcode: medicine.barcode || "",
        category: medicine.category || "",
        unit_type: medicine.unit_type || "علبة",
        strips_per_box: String(medicine.strips_per_box || 1),
        requires_prescription: Boolean(medicine.requires_prescription),
        min_stock_level: String(medicine.min_stock_level ?? 10),
        tax_rate: String(medicine.tax_rate ?? 0),
        is_active: medicine.is_active ?? true,
      });
    } else {
      setForm(EMPTY_MEDICINE);
    }
  }, [open, medicine]);

  async function submit(event) {
    event.preventDefault();
    if (!form.trade_name.trim() || !form.scientific_name.trim()) {
      setError(t("الاسم التجاري والاسم العلمي مطلوبان"));
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      trade_name: form.trade_name.trim(),
      scientific_name: form.scientific_name.trim(),
      barcode: form.barcode.trim() || null,
      category: form.category.trim() || null,
      unit_type: form.unit_type,
      strips_per_box: Number(form.strips_per_box) || 1,
      requires_prescription: form.requires_prescription,
      min_stock_level: Number(form.min_stock_level) || 0,
      tax_rate: Number(form.tax_rate) || 0,
      is_active: form.is_active,
    };
    try {
      const saved = medicine
        ? await api.put(`/medicines/${medicine.id}`, payload)
        : await api.post("/medicines", payload);
      toast.success(medicine ? t("تم تحديث الصنف") : t("تمت إضافة الصنف"), saved.trade_name);
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
      title={medicine ? t("تعديل بيانات الصنف") : t("إضافة صنف جديد")}
      description={t("البيانات الأساسية للصنف وتفاصيل الوحدات والحد الأدنى للمخزون")}
      icon={Package}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("إلغاء")}
          </Button>
          <Button form="medicine-form" type="submit" loading={saving}>
            {medicine ? t("حفظ التعديلات") : t("إضافة الصنف")}
          </Button>
        </>
      }
    >
      <form id="medicine-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("الاسم التجاري")} required>
            <Input
              value={form.trade_name}
              onChange={(event) => setForm({ ...form, trade_name: event.target.value })}
              placeholder={t("مثال: Panadol Extra")}
            />
          </Field>
          <Field label={t("الاسم العلمي / المادة الفعالة")} required>
            <Input
              value={form.scientific_name}
              onChange={(event) => setForm({ ...form, scientific_name: event.target.value })}
              placeholder={t("مثال: Paracetamol")}
            />
          </Field>
          <Field label={t("الباركود")} hint={t("اتركه فارغًا إن لم يكن متاحًا")}>
            <Input
              icon={Barcode}
              value={form.barcode}
              onChange={(event) => setForm({ ...form, barcode: event.target.value })}
              placeholder="628107..."
              dir="ltr"
            />
          </Field>
          <Field label={t("التصنيف")}>
            <Input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder={t("مثال: مسكنات")}
              list="categories-list"
            />
            <datalist id="categories-list">
              {["مسكنات", "مضادات حيوية", "أدوية الضغط", "أدوية السكر", "فيتامينات", "مستلزمات"].map(
                (option) => (
                  <option key={option} value={option} />
                )
              )}
            </datalist>
          </Field>
          <Field label={t("نوع الوحدة")}>
            <Select
              value={form.unit_type}
              onChange={(event) => setForm({ ...form, unit_type: event.target.value })}
            >
              {["علبة", "شريط", "قرص", "زجاجة", "أمبول"].map((unit) => (
                <option key={unit} value={unit}>
                  {t(unit)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("عدد الأشرطة في العلبة")} hint={t("يُستخدم لحساب سعر الشريط")}>
            <Input
              type="number"
              min="1"
              value={form.strips_per_box}
              onChange={(event) => setForm({ ...form, strips_per_box: event.target.value })}
            />
          </Field>
          <Field label={t("الحد الأدنى للمخزون")} hint={t("سيظهر تنبيه عند النزول عنه")}>
            <Input
              type="number"
              min="0"
              value={form.min_stock_level}
              onChange={(event) => setForm({ ...form, min_stock_level: event.target.value })}
            />
          </Field>
          <Field label={t("نسبة الضريبة %")}>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.tax_rate}
              onChange={(event) => setForm({ ...form, tax_rate: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5 py-3">
            <input
              type="checkbox"
              checked={form.requires_prescription}
              onChange={(event) => setForm({ ...form, requires_prescription: event.target.checked })}
              className="size-4 accent-brand-600"
            />
            <span className="text-xs font-semibold">{t("يتطلب روشتة طبية")}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5 py-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              className="size-4 accent-brand-600"
            />
            <span className="text-xs font-semibold">{t("الصنف نشط ومتاح للبيع")}</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------- Batch modal ------------------------------- */
function BatchModal({ state, onClose, onSaved }) {
  const toast = useToast();
  const { t } = useI18n();
  const open = Boolean(state);
  const [form, setForm] = useState({
    batch_number: "",
    expiry_date: "",
    buy_price: "",
    sell_price: "",
    quantity_boxes: "0",
    quantity_strips: "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (state?.batch) {
      setForm({
        batch_number: state.batch.batch_number || "",
        expiry_date: String(state.batch.expiry_date || "").slice(0, 10),
        buy_price: String(state.batch.buy_price ?? ""),
        sell_price: String(state.batch.sell_price ?? ""),
        quantity_boxes: String(state.batch.quantity_boxes ?? 0),
        quantity_strips: String(state.batch.quantity_strips ?? 0),
      });
    } else {
      setForm({
        batch_number: "",
        expiry_date: "",
        buy_price: "",
        sell_price: "",
        quantity_boxes: "0",
        quantity_strips: "0",
      });
    }
  }, [open, state]);

  async function submit(event) {
    event.preventDefault();
    if (!form.batch_number.trim() || !form.expiry_date) {
      setError(t("رقم التشغيلة وتاريخ الانتهاء مطلوبان"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        batch_number: form.batch_number.trim(),
        expiry_date: form.expiry_date,
        buy_price: Number(form.buy_price) || 0,
        sell_price: Number(form.sell_price) || 0,
        quantity_boxes: Number(form.quantity_boxes) || 0,
        quantity_strips: Number(form.quantity_strips) || 0,
      };
      if (state.batch) await api.put(`/batches/${state.batch.id}`, payload);
      else await api.post(`/medicines/${state.medicineId}/batches`, payload);
      toast.success(state.batch ? t("تم تحديث التشغيلة") : t("تمت إضافة التشغيلة"), state.medicineName);
      onSaved();
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
      title={state?.batch ? t("تعديل التشغيلة") : t("إضافة تشغيلة جديدة")}
      description={state?.medicineName}
      icon={Boxes}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("إلغاء")}
          </Button>
          <Button form="batch-form" type="submit" loading={saving}>
            {state?.batch ? t("حفظ") : t("إضافة")}
          </Button>
        </>
      }
    >
      <form id="batch-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("رقم التشغيلة")} required>
            <Input
              value={form.batch_number}
              onChange={(event) => setForm({ ...form, batch_number: event.target.value })}
              placeholder="B2026-001"
              dir="ltr"
            />
          </Field>
          <Field label={t("تاريخ الانتهاء")} required>
            <Input
              type="date"
              value={form.expiry_date}
              onChange={(event) => setForm({ ...form, expiry_date: event.target.value })}
            />
          </Field>
          <Field label={t("سعر الشراء")} required>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.buy_price}
              onChange={(event) => setForm({ ...form, buy_price: event.target.value })}
            />
          </Field>
          <Field label={t("سعر البيع")} required>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.sell_price}
              onChange={(event) => setForm({ ...form, sell_price: event.target.value })}
            />
          </Field>
          <Field label={t("عدد العلب")}>
            <Input
              type="number"
              min="0"
              value={form.quantity_boxes}
              onChange={(event) => setForm({ ...form, quantity_boxes: event.target.value })}
            />
          </Field>
          <Field label={t("عدد الأشرطة")}>
            <Input
              type="number"
              min="0"
              value={form.quantity_strips}
              onChange={(event) => setForm({ ...form, quantity_strips: event.target.value })}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------ Medicine drawer ---------------------------- */
function MedicineDrawer({
  id,
  refreshKey,
  onClose,
  onEdit,
  onAddBatch,
  onEditBatch,
  onDeleteBatch,
  onDelete,
  currency,
  isAdmin,
}) {
  const { t } = useI18n();
  const detail = useApi(`/medicines/${id}`, { enabled: Boolean(id) });
  useEffect(() => {
    if (id && refreshKey) detail.refetch({ quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);
  const medicine = detail.data;
  const batches = medicine?.batches || [];
  const totalBoxes = batches.reduce((sum, batch) => sum + batch.quantity_boxes, 0);
  const totalStrips = batches.reduce((sum, batch) => sum + batch.quantity_strips, 0);
  const stockValue = batches.reduce(
    (sum, batch) =>
      sum +
      batch.quantity_boxes * batch.buy_price +
      (batch.quantity_strips * batch.buy_price) / (medicine?.strips_per_box || 1),
    0
  );

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      width="md"
      title={medicine?.trade_name || t("تفاصيل الصنف")}
      description={medicine?.scientific_name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("إغلاق")}
          </Button>
          <Button variant="soft" onClick={() => medicine && onAddBatch(medicine)}>
            <PackagePlus className="size-4" />
            {t("تشغيلة جديدة")}
          </Button>
          <Button onClick={() => medicine && onEdit(medicine)}>
            <Edit3 className="size-4" />
            {t("تعديل")}
          </Button>
        </>
      }
    >
      {detail.loading && !medicine ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : medicine ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={medicine.is_active ? "success" : "neutral"} dot>
              {medicine.is_active ? t("نشط") : t("مؤرشف")}
            </Badge>
            {medicine.requires_prescription ? <Badge tone="warning">{t("يتطلب روشتة")}</Badge> : null}
            <Badge tone="neutral">{medicine.category || t("غير مصنف")}</Badge>
            <Badge tone="brand">{t(medicine.unit_type || "علبة")}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] text-muted">{t("إجمالي العلب")}</p>
              <p className="text-lg font-bold nums">{totalBoxes}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] text-muted">{t("إجمالي الأشرطة")}</p>
              <p className="text-lg font-bold nums">{totalStrips}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] text-muted">{t("قيمة المخزون (شراء)")}</p>
              <p className="text-sm font-bold nums">{money(stockValue, currency)}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] text-muted">{t("أشرطة / علبة")}</p>
              <p className="text-sm font-bold nums">{medicine.strips_per_box}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-line p-3.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">{t("الباركود")}</span>
              <span className="font-semibold" dir="ltr">{medicine.barcode || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("الحد الأدنى للمخزون")}</span>
              <span className="font-semibold nums">{medicine.min_stock_level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("نسبة الضريبة")}</span>
              <span className="font-semibold nums">{medicine.tax_rate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("تاريخ الإضافة")}</span>
              <span className="font-semibold">{formatDateTime(medicine.created_at)}</span>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold">{t("التشغيلات ({count})", { count: batches.length })}</p>
              <span className="text-[10px] text-muted">{t("مرتبة حسب الأقرب انتهاءً")}</span>
            </div>
            {batches.length === 0 ? (
              <EmptyState
                icon={Archive}
                title={t("لا توجد تشغيلات")}
                description={t("أضف تشغيلة لتتمكن من بيع هذا الصنف.")}
                className="py-6"
              />
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => {
                  const left = daysLeft(batch.expiry_date);
                  const expired = left < 0;
                  const expiring = left >= 0 && left <= 90;
                  return (
                    <div
                      key={batch.id}
                      className={cn(
                        "rounded-xl border p-3",
                        expired
                          ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20"
                          : expiring
                            ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20"
                            : "border-line"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold" dir="ltr">{batch.batch_number}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                            <CalendarClock className="size-3" />
                            {formatDate(batch.expiry_date)} ·{" "}
                            {expired ? t("منتهي الصلاحية") : t("{days} يوم متبقي", { days: left })}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => onEditBatch(medicine, batch)}
                            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                            aria-label={t("تعديل التشغيلة")}
                          >
                            <Edit3 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteBatch(batch)}
                            className="rounded-lg p-1.5 text-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                            aria-label={t("حذف التشغيلة")}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px]">
                        <div>
                          <p className="text-muted">{t("علب")}</p>
                          <p className="font-bold nums">{batch.quantity_boxes}</p>
                        </div>
                        <div>
                          <p className="text-muted">{t("أشرطة")}</p>
                          <p className="font-bold nums">{batch.quantity_strips}</p>
                        </div>
                        <div>
                          <p className="text-muted">{t("شراء")}</p>
                          <p className="font-bold nums">{batch.buy_price}</p>
                        </div>
                        <div>
                          <p className="text-muted">{t("بيع")}</p>
                          <p className="font-bold nums">{batch.sell_price}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => onDelete(medicine)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="size-4" />
              {t("حذف أو أرشفة الصنف")}
            </button>
          ) : null}
        </div>
      ) : (
        <EmptyState icon={Package} title={t("تعذر تحميل الصنف")} />
      )}
    </Drawer>
  );
}
