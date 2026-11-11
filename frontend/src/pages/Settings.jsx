import { useEffect, useState } from "react";
import {
  BellRing,
  Building2,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Percent,
  Phone,
  Plus,
  ReceiptText,
  Save,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { api } from "../lib/api";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "../components/ui";
import { ConfirmDialog, Modal } from "../components/ui/overlays";
import { useI18n } from "../i18n";
import { cn, formatDate, roleLabels } from "../lib/utils";

const PAGE_TABS = [
  { value: "pharmacy", label: "بيانات الصيدلية", icon: Store },
  { value: "users", label: "المستخدمون", icon: Users },
  { value: "security", label: "الأمان", icon: ShieldCheck },
];

const ROLE_OPTIONS = [
  { value: "admin", label: "مدير النظام" },
  { value: "pharmacist", label: "صيدلي" },
  { value: "cashier", label: "كاشير" },
];

const roleTones = { admin: "brand", pharmacist: "info", cashier: "neutral" };

const EMPTY_USER = {
  name: "",
  username: "",
  role: "pharmacist",
  password: "",
  is_active: true,
};

export default function Settings() {
  const { user, setUser } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState("pharmacy");
  const [userModal, setUserModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const users = useApi("/users", { enabled: user?.role === "admin" });

  async function deleteUser() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const response = await api.delete(`/users/${confirmDelete.id}`);
      toast.success(t("تم حذف المستخدم"), response?.message);
      setConfirmDelete(null);
      users.refetch({ quiet: true });
    } catch (error) {
      toast.error(t("تعذر حذف المستخدم"), error.message);
    } finally {
      setBusy(false);
    }
  }

  const userList = users.data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("الإعدادات")}
        subtitle={t("بيانات الصيدلية، إدارة الحسابات وإعدادات الأمان")}
        badge={
          <Badge tone="brand" dot>
            {roleLabels[user?.role] || user?.role}
          </Badge>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        options={PAGE_TABS.map((option) =>
          option.value === "users" ? { ...option, count: userList.length || undefined } : option
        )}
      />

      {tab === "pharmacy" ? <PharmacySettings /> : null}
      {tab === "users" ? (
        <UsersSettings
          users={users}
          currentUser={user}
          onAdd={() => setUserModal({ member: null })}
          onEdit={(member) => setUserModal({ member })}
          onDelete={(member) => setConfirmDelete(member)}
        />
      ) : null}
      {tab === "security" ? <SecuritySettings /> : null}

      <UserModal
        open={Boolean(userModal)}
        member={userModal?.member}
        onClose={() => setUserModal(null)}
        onSaved={(saved) => {
          setUserModal(null);
          users.refetch({ quiet: true });
          if (saved?.id === user?.id) setUser(saved);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={deleteUser}
        loading={busy}
        title={t("حذف المستخدم")}
        description={t("سيتم حذف حساب «{name}» نهائيًا. لا يمكن التراجع عن هذا الإجراء.", {
          name: confirmDelete?.name || "",
        })}
        confirmLabel={t("تأكيد الحذف")}
      />
    </div>
  );
}

/* ----------------------------- Pharmacy settings ---------------------------- */
function PharmacySettings() {
  const { settings, update } = useSettings();
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  async function submit(event) {
    event.preventDefault();
    if (!form.pharmacy_name?.trim()) {
      setError(t("اسم الصيدلية مطلوب"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await update({
        pharmacy_name: form.pharmacy_name.trim(),
        pharmacy_phone: form.pharmacy_phone || "",
        pharmacy_address: form.pharmacy_address || "",
        currency: form.currency || "ج.م",
        tax_rate: Number(form.tax_rate) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        expiry_warning_days: Number(form.expiry_warning_days) || 90,
        receipt_footer: form.receipt_footer || "",
      });
      toast.success(
        t("تم حفظ الإعدادات"),
        t("ستظهر البيانات المحدثة في الفواتير والتقارير.")
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title={t("بيانات الصيدلية")}
          subtitle={t("تظهر في الفواتير المطبوعة وتقارير النظام")}
          icon={Building2}
        />
        <form onSubmit={submit} className="space-y-4 p-5">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("اسم الصيدلية")} required className="sm:col-span-2">
              <Input
                value={form.pharmacy_name || ""}
                onChange={(event) => setForm({ ...form, pharmacy_name: event.target.value })}
                placeholder={t("صيدلية النور")}
              />
            </Field>
            <Field label={t("رقم الهاتف")}>
              <Input
                icon={Phone}
                value={form.pharmacy_phone || ""}
                onChange={(event) => setForm({ ...form, pharmacy_phone: event.target.value })}
                placeholder="01000000000"
                dir="ltr"
              />
            </Field>
            <Field label={t("العملة")}>
              <Input
                value={form.currency || ""}
                onChange={(event) => setForm({ ...form, currency: event.target.value })}
                placeholder={t("ج.م")}
              />
            </Field>
            <Field label={t("العنوان")} className="sm:col-span-2">
              <Input
                icon={MapPin}
                value={form.pharmacy_address || ""}
                onChange={(event) => setForm({ ...form, pharmacy_address: event.target.value })}
                placeholder={t("المدينة - الشارع - رقم المبنى")}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("نسبة الضريبة %")} hint={t("تُطبق على الفواتير عند الحاجة")}>
              <Input
                icon={Percent}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.tax_rate ?? 0}
                onChange={(event) => setForm({ ...form, tax_rate: event.target.value })}
              />
            </Field>
            <Field label={t("حد المخزون المنخفض")} hint={t("تنبيه عند النزول عنه")}>
              <Input
                icon={BellRing}
                type="number"
                min="0"
                value={form.low_stock_threshold ?? 10}
                onChange={(event) => setForm({ ...form, low_stock_threshold: event.target.value })}
              />
            </Field>
            <Field label={t("تنبيه انتهاء الصلاحية")} hint={t("عدد الأيام قبل الانتهاء")}>
              <Input
                type="number"
                min="1"
                max="730"
                value={form.expiry_warning_days ?? 90}
                onChange={(event) => setForm({ ...form, expiry_warning_days: event.target.value })}
              />
            </Field>
          </div>

          <Field label={t("تذييل الفاتورة")} hint={t("رسالة تظهر أسفل كل فاتورة مطبوعة")}>
            <Textarea
              value={form.receipt_footer || ""}
              onChange={(event) => setForm({ ...form, receipt_footer: event.target.value })}
              placeholder={t("شكرًا لثقتكم بنا — نتمنى لكم الشفاء العاجل")}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <Save className="size-4" />
              {t("حفظ الإعدادات")}
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="brand-gradient relative p-5 text-white">
            <div className="grid-pattern absolute inset-0 opacity-40" />
            <div className="relative">
              <span className="grid size-10 place-items-center rounded-xl bg-white/15">
                <ReceiptText className="size-5" />
              </span>
              <h3 className="mt-3 text-base font-bold">
                {form.pharmacy_name || t("صيدليتي")}
              </h3>
              <p className="mt-1 text-[11px] leading-6 text-white/80">
                {form.pharmacy_address || t("أضف عنوان الصيدلية ليظهر في الفواتير.")}
              </p>
              {form.pharmacy_phone ? (
                <p className="mt-2 text-xs font-semibold text-white/90" dir="ltr">
                  {form.pharmacy_phone}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 p-4 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-muted">{t("العملة")}</span>
              <span className="font-semibold">{form.currency || "ج.م"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">{t("الضريبة")}</span>
              <span className="font-semibold nums">{form.tax_rate ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">{t("حد المخزون")}</span>
              <span className="font-semibold nums">{form.low_stock_threshold ?? 10}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">{t("تنبيه الصلاحية")}</span>
              <span className="font-semibold nums">
                {t("{days} يوم", { days: form.expiry_warning_days ?? 90 })}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-bold">
            <Mail className="size-4 text-brand-600 dark:text-brand-400" />
            {t("ملاحظة")}
          </p>
          <p className="mt-2 text-[11px] leading-6 text-muted">
            {t(
              "تُحفظ الإعدادات في قاعدة البيانات وتُحدَّث مباشرة لكل المستخدمين. تظهر بيانات الصيدلية في الإيصالات المطبوعة والتقارير المصدَّرة."
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------- Users settings ----------------------------- */
function UsersSettings({ users, currentUser, onAdd, onEdit, onDelete }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const list = (users.data || []).filter((member) =>
    q.trim() ? `${member.name} ${member.username}`.toLowerCase().includes(q.trim().toLowerCase()) : true
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="sm:w-72">
          <Input
            icon={UserRound}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("ابحث بالاسم أو اسم المستخدم")}
          />
        </div>
        <div className="ms-auto flex items-center gap-3">
          <span className="text-[11px] text-muted">
            {t("{count} حساب", { count: list.length })}
          </span>
          <Button onClick={onAdd}>
            <Plus className="size-4" />
            {t("إضافة مستخدم")}
          </Button>
        </div>
      </div>

      {users.loading && !users.data ? (
        <div className="space-y-2 p-5 pt-0">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-14 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("لا يوجد مستخدمون")}
          description={t("أضف حسابًا جديدًا للصيدلي أو الكاشير.")}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-2/50 text-[10px] text-muted">
                <th className="px-5 py-3 text-start font-semibold">{t("المستخدم")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("اسم المستخدم")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("الدور")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("الحالة")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("تاريخ الإضافة")}</th>
                <th className="px-5 py-3 text-end font-semibold">{t("إجراءات")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((member) => (
                <tr key={member.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{member.name}</p>
                        {member.id === currentUser?.id ? (
                          <p className="text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                            {t("حسابك الحالي")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-muted" dir="ltr">
                    {member.username}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={roleTones[member.role] || "neutral"}>
                      {roleLabels[member.role] || member.role}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={member.is_active ? "success" : "danger"} dot>
                      {member.is_active ? t("نشط") : t("موقوف")}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-muted">{formatDate(member.created_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(member)}
                        className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-brand-700"
                        aria-label={t("تعديل المستخدم")}
                      >
                        <UserRound className="size-4" />
                      </button>
                      {member.id !== currentUser?.id ? (
                        <button
                          type="button"
                          onClick={() => onDelete(member)}
                          className="rounded-lg p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                          aria-label={t("حذف المستخدم")}
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
  );
}

/* -------------------------------- User modal -------------------------------- */
function UserModal({ open, member, onClose, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (member) {
      setForm({
        name: member.name || "",
        username: member.username || "",
        role: member.role || "pharmacist",
        password: "",
        is_active: member.is_active ?? true,
      });
    } else {
      setForm(EMPTY_USER);
    }
  }, [open, member]);

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.username.trim()) {
      setError(t("الاسم واسم المستخدم مطلوبان"));
      return;
    }
    if (!member && form.password.length < 6) {
      setError(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل"));
      return;
    }
    if (member && form.password && form.password.length < 6) {
      setError(t("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      let saved;
      if (member) {
        const payload = {
          name: form.name.trim(),
          role: form.role,
          is_active: form.is_active,
        };
        if (form.password) payload.password = form.password;
        saved = await api.put(`/users/${member.id}`, payload);
      } else {
        saved = await api.post("/users", {
          name: form.name.trim(),
          username: form.username.trim(),
          role: form.role,
          password: form.password,
          is_active: form.is_active,
        });
      }
      toast.success(
        t(member ? "تم تحديث المستخدم" : "تم إنشاء الحساب"),
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
      title={t(member ? "تعديل بيانات المستخدم" : "إضافة مستخدم جديد")}
      description={t("صلاحيات الحساب تتحكم في الشاشات المتاحة له")}
      icon={Users}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("إلغاء")}
          </Button>
          <Button form="user-form" type="submit" loading={saving}>
            {member ? t("حفظ التعديلات") : t("إنشاء الحساب")}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("الاسم الكامل")} required>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder={t("مثال: د. هدى أحمد")}
            />
          </Field>
          <Field
            label={t("اسم المستخدم")}
            required
            hint={t(member ? "لا يمكن تغيير اسم المستخدم" : "تُستخدم لتسجيل الدخول")}
          >
            <Input
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="huda"
              dir="ltr"
              disabled={Boolean(member)}
            />
          </Field>
          <Field label={t("الدور والصلاحيات")}>
            <Select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t(member ? "كلمة مرور جديدة" : "كلمة المرور")}
            required={!member}
            hint={t(
              member
                ? "اتركها فارغة للإبقاء على كلمة المرور الحالية"
                : "6 أحرف على الأقل"
            )}
          >
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="••••••"
              autoComplete="new-password"
              dir="ltr"
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5 py-3">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            className="size-4 accent-brand-600"
          />
          <span className="text-xs font-semibold">
            {t("الحساب نشط ويمكنه تسجيل الدخول")}
          </span>
        </label>
      </form>
    </Modal>
  );
}

/* ------------------------------- Security tab ------------------------------- */
function SecuritySettings() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!form.current_password) {
      setError(t("أدخل كلمة المرور الحالية"));
      return;
    }
    if (form.new_password.length < 6) {
      setError(t("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"));
      return;
    }
    if (form.new_password !== form.confirm) {
      setError(t("تأكيد كلمة المرور غير مطابق"));
      return;
    }
    setSaving(true);
    try {
      const response = await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success(t("تم تحديث كلمة المرور"), response?.message);
      setForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title={t("تغيير كلمة المرور")}
          subtitle={t("حافظ على أمان حسابك باستخدام كلمة مرور قوية")}
          icon={KeyRound}
        />
        <form onSubmit={submit} className="space-y-4 p-5">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          <Field label={t("كلمة المرور الحالية")} required>
            <Input
              type="password"
              value={form.current_password}
              onChange={(event) => setForm({ ...form, current_password: event.target.value })}
              autoComplete="current-password"
              dir="ltr"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("كلمة المرور الجديدة")}
              required
              hint={t("6 أحرف على الأقل")}
            >
              <Input
                type="password"
                value={form.new_password}
                onChange={(event) => setForm({ ...form, new_password: event.target.value })}
                autoComplete="new-password"
                dir="ltr"
              />
            </Field>
            <Field label={t("تأكيد كلمة المرور")} required>
              <Input
                type="password"
                value={form.confirm}
                onChange={(event) => setForm({ ...form, confirm: event.target.value })}
                autoComplete="new-password"
                dir="ltr"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <Save className="size-4" />
              {t("تحديث كلمة المرور")}
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name || ""} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user?.name}</p>
              <p className="text-[11px] text-muted" dir="ltr">
                @{user?.username}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-muted">{t("الدور")}</span>
              <Badge tone={roleTones[user?.role] || "neutral"}>{roleLabels[user?.role] || user?.role}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">{t("حالة الحساب")}</span>
              <Badge tone="success" dot>
                {t("نشط")}
              </Badge>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-xs font-semibold transition",
              "text-muted hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:border-rose-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            )}
          >
            <LogOut className="size-4" />
            {t("تسجيل الخروج من الحساب")}
          </button>
        </Card>

        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-bold">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            {t("نصائح أمان")}
          </p>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-6 text-muted">
            <li>• {t("استخدم كلمة مرور لا تقل عن 8 أحرف مع أرقام ورموز.")}</li>
            <li>• {t("لا تشارك بيانات الدخول مع أي شخص.")}</li>
            <li>• {t("سجّل الخروج عند مغادرة الجهاز.")}</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
