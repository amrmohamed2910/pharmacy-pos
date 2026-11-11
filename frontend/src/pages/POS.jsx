import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Barcode,
  CalendarClock,
  CreditCard,
  FileText,
  Minus,
  Plus,
  Printer,
  ScanBarcode,
  Search,
  ShoppingBasket,
  Trash2,
  Wallet,
} from "lucide-react";
import { useApi, useDebounced } from "../hooks/useApi";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { api } from "../lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Spinner,
} from "../components/ui";
import { Modal } from "../components/ui/overlays";
import { Receipt } from "../components/Receipt";
import { cn, displayCurrency, money } from "../lib/utils";
import { useI18n } from "../i18n";

const paymentOptions = [
  { value: "كاش", label: "كاش", icon: Banknote },
  { value: "شبكة", label: "شبكة", icon: CreditCard },
  { value: "آجل", label: "آجل", icon: CalendarClock },
];

export default function POS() {
  const { settings, currency } = useSettings();
  const toast = useToast();
  const { t } = useI18n();

  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 220);
  const [highlight, setHighlight] = useState(0);
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState("كاش");
  const [paid, setPaid] = useState("");
  const [customer, setCustomer] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const searchRef = useRef(null);
  const checkoutRef = useRef(() => {});

  const search = useApi("/medicines/search", {
    params: { q: debounced.trim() },
    enabled: debounced.trim().length > 0,
    silent: true,
  });
  const results = search.data || [];

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + (item.unit_type === "box" ? item.box_price : item.strip_price) * item.quantity,
        0
      ),
    [cart]
  );
  const discountValue = Math.min(Number(discount || 0), subtotal);
  const net = Math.max(0, subtotal - discountValue);
  const paidValue = Number(paid || 0);
  const change = paidValue > 0 ? Math.max(0, paidValue - net) : 0;
  const shortfall = paidValue > 0 && paidValue < net;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const needsPrescription = cart.some((item) => item.requires_prescription);

  useEffect(() => {
    setHighlight(0);
  }, [debounced]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (event.key === "F9") {
        event.preventDefault();
        checkoutRef.current();
      }
      if (event.key === "Escape" && !receiptOpen) {
        setQuery("");
      }
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [receiptOpen]);

  useEffect(() => {
    if (!receiptOpen) searchRef.current?.focus();
  }, [receiptOpen]);

  function addToCart(item) {
    const available =
      item.available_boxes > 0 || item.available_strips > 0;
    if (!available) {
      toast.warning(
        t("الصنف غير متوفر"),
        t("لا يوجد مخزون صالح من «{name}».", { name: item.trade_name })
      );
      return;
    }
    const unit = item.available_boxes > 0 ? "box" : "strip";
    const max = unit === "box" ? item.available_boxes : item.available_strips;
    const existing = cart.find((line) => line.id === item.id && line.unit_type === unit);
    if (existing) {
      if (existing.quantity + 1 > max) {
        toast.warning(
          t("الكمية غير كافية"),
          t("المتاح من «{name}» هو {max}.", { name: item.trade_name, max })
        );
        return;
      }
      setCart((current) =>
        current.map((line) =>
          line.id === item.id && line.unit_type === unit
            ? { ...line, quantity: line.quantity + 1 }
            : line
        )
      );
    } else {
      setCart((current) => [
        ...current,
        {
          ...item,
          unit_type: unit,
          quantity: 1,
        },
      ]);
    }
    setQuery("");
    setHighlight(0);
    searchRef.current?.focus();
  }

  function updateQuantity(index, delta) {
    setCart((current) => {
      const next = [...current];
      const line = next[index];
      if (!line) return current;
      const nextQuantity = line.quantity + delta;
      if (nextQuantity <= 0) return current.filter((_, position) => position !== index);
      const max = line.unit_type === "box" ? line.available_boxes : line.available_strips;
      if (nextQuantity > max) {
        toast.warning(
          t("الكمية غير كافية"),
          t("المتاح من «{name}» هو {max}.", { name: line.trade_name, max })
        );
        return current;
      }
      next[index] = { ...line, quantity: nextQuantity };
      return next;
    });
  }

  function setQuantity(index, value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    setCart((current) => {
      const next = [...current];
      const line = next[index];
      const max = line.unit_type === "box" ? line.available_boxes : line.available_strips;
      next[index] = { ...line, quantity: Math.min(Math.floor(parsed), max) };
      return next;
    });
  }

  function changeUnit(index, unit) {
    setCart((current) => {
      const next = [...current];
      const line = next[index];
      const max = unit === "box" ? line.available_boxes : line.available_strips;
      if (max <= 0) {
        toast.warning(
          t("الوحدة غير متوفرة"),
          t("لا يوجد مخزون ({unit}).", {
            unit: unit === "box" ? t("علب") : t("أشرطة"),
          })
        );
        return current;
      }
      next[index] = { ...line, unit_type: unit, quantity: Math.min(line.quantity, max) };
      return next;
    });
  }

  function removeLine(index) {
    setCart((current) => current.filter((_, position) => position !== index));
  }

  function clearCart() {
    setCart([]);
    setDiscount("");
    setPaid("");
    setCustomer("");
    setMethod("كاش");
  }

  function handleSearchKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const typed = query.trim();
      const exact = results.find((item) => item.barcode === typed);
      const target = exact || results[highlight];
      if (target) addToCart(target);
    }
  }

  async function submitCheckout() {
    if (!cart.length) {
      toast.warning(t("الفاتورة فارغة"), t("أضف صنفًا واحدًا على الأقل قبل الدفع."));
      return;
    }
    if (method === "آجل" && !customer.trim()) {
      toast.warning(
        t("اسم العميل مطلوب"),
        t("اختر عميلًا أو اكتب اسمه لتسجيل البيع الآجل.")
      );
      return;
    }
    if (shortfall) {
      toast.warning(t("المبلغ غير كافٍ"), t("المبلغ المدفوع أقل من صافي الفاتورة."));
      return;
    }

    setCheckingOut(true);
    try {
      const sale = await api.post("/sales/checkout", {
        payment_method: method,
        discount: discountValue,
        paid_amount: method === "آجل" ? 0 : paidValue || net,
        customer_name: customer.trim() || null,
        items: cart.map((line) => ({
          medicine_id: line.id,
          unit_type: line.unit_type,
          quantity: line.quantity,
        })),
      });
      setLastSale(sale);
      setReceiptOpen(true);
      toast.success(
        t("تمت عملية البيع"),
        t("الفاتورة {invoice} · الصافي {net}", {
          invoice: sale.invoice_number,
          net: money(sale.net_amount, currency),
        })
      );
      clearCart();
      searchRef.current?.focus();
    } catch (error) {
      toast.error(t("تعذر إتمام البيع"), error.message);
    } finally {
      setCheckingOut(false);
    }
  }
  checkoutRef.current = submitCheckout;

  function printReceipt() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("نقطة البيع")}
        subtitle={t("ابحث بالاسم أو امسح الباركود لإضافة الأصناف إلى الفاتورة")}
        badge={
          <Badge tone="brand" dot>
            {t("جاهز للبيع")}
          </Badge>
        }
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[10px] font-semibold text-muted sm:flex">
              <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-sans">F2</kbd>{" "}
              {t("بحث")}
            </span>
            <span className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[10px] font-semibold text-muted sm:flex">
              <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-sans">F9</kbd>{" "}
              {t("دفع")}
            </span>
            <Button variant="secondary" onClick={clearCart} disabled={!cart.length}>
              <Trash2 className="size-4" />
              {t("فاتورة جديدة")}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23.5rem]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="relative">
              <div className="relative">
                <ScanBarcode className="pointer-events-none absolute top-1/2 start-4 size-5 -translate-y-1/2 text-brand-600" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={t("امسح الباركود أو اكتب اسم الدواء أو المادة الفعالة…")}
                  autoComplete="off"
                  className="h-13 w-full rounded-xl border border-line bg-surface ps-12 pe-4 text-sm font-medium text-ink shadow-soft transition placeholder:text-muted/70 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                />
                {search.loading ? (
                  <Spinner className="absolute top-1/2 end-4 size-4 -translate-y-1/2" />
                ) : null}
              </div>

              {query.trim() ? (
                <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
                  {search.loading && !results.length ? (
                    <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted">
                      <Spinner className="size-4" /> {t("جارٍ البحث…")}
                    </div>
                  ) : results.length ? (
                    <div className="max-h-96 overflow-y-auto">
                      {results.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => addToCart(item)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 border-b border-line/60 px-4 py-3 text-start transition last:border-0",
                            index === highlight ? "bg-brand-50/70 dark:bg-brand-950/40" : "hover:bg-surface-2"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-bold">{item.trade_name}</p>
                              {item.requires_prescription ? (
                                <Badge tone="warning">{t("روشتة")}</Badge>
                              ) : null}
                            </div>
                            <p className="truncate text-[11px] text-muted">{item.scientific_name}</p>
                            <div className="mt-1 flex items-center gap-2 text-[10px]">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 font-semibold",
                                  item.has_stock
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                )}
                              >
                                {item.has_stock
                                  ? t("{boxes} علبة · {strips} شريط", {
                                      boxes: item.available_boxes,
                                      strips: item.available_strips,
                                    })
                                  : t("نافد")}
                              </span>
                              {item.barcode ? (
                                <span className="flex items-center gap-1 text-muted" dir="ltr">
                                  <Barcode className="size-3" />
                                  {item.barcode}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="shrink-0 text-end">
                            <p className="text-sm font-bold nums">{money(item.box_price, currency)}</p>
                            <p className="text-[10px] text-muted">{t("للعلبة")}</p>
                            <p className="mt-0.5 text-[10px] text-brand-700 dark:text-brand-300">
                              {money(item.strip_price, currency)} {t("/ شريط")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Search}
                      title={t("لا توجد نتائج مطابقة")}
                      description={t("جرّب اسمًا آخر أو تأكد من الباركود.")}
                      className="py-8"
                    />
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-sans">Enter</kbd>
                {t("إضافة سريعة")}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-sans">↑↓</kbd>
                {t("تنقل بين النتائج")}
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <FileText className="size-3" />
                {needsPrescription
                  ? t("بالفاتورة أصناف تتطلب روشتة")
                  : t("صرف آمن بنظام FEFO")}
              </span>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="size-4 text-brand-600" />
                <p className="text-sm font-bold">{t("أصناف الفاتورة")}</p>
                <Badge tone="neutral">{t("{count} صنف", { count: cart.length })}</Badge>
              </div>
              {cart.length ? (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                >
                  {t("مسح الكل")}
                </button>
              ) : null}
            </div>

            {cart.length === 0 ? (
              <EmptyState
                icon={ShoppingBasket}
                title={t("الفاتورة فارغة")}
                description={t("ابدأ بمسح باركود دواء أو البحث بالاسم لإضافته إلى الفاتورة.")}
                action={
                  <Button variant="soft" onClick={() => searchRef.current?.focus()}>
                    <ScanBarcode className="size-4" />
                    {t("ابدأ البحث")}
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/50 text-[10px] text-muted">
                      <th className="px-5 py-2.5 text-start font-semibold">{t("الصنف")}</th>
                      <th className="px-2 py-2.5 text-center font-semibold">{t("الوحدة")}</th>
                      <th className="px-2 py-2.5 text-center font-semibold">{t("الكمية")}</th>
                      <th className="px-2 py-2.5 text-center font-semibold">{t("السعر")}</th>
                      <th className="px-2 py-2.5 text-center font-semibold">{t("الإجمالي")}</th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((line, index) => {
                      const price = line.unit_type === "box" ? line.box_price : line.strip_price;
                      return (
                        <tr key={`${line.id}-${line.unit_type}`} className="border-b border-line/60 last:border-0">
                          <td className="max-w-56 px-5 py-3">
                            <p className="truncate text-xs font-bold">{line.trade_name}</p>
                            <p className="truncate text-[10px] text-muted">{line.scientific_name}</p>
                          </td>
                          <td className="px-2 py-3">
                            <div className="mx-auto flex w-fit rounded-lg border border-line p-0.5">
                              <button
                                type="button"
                                onClick={() => changeUnit(index, "box")}
                                className={cn(
                                  "rounded-md px-2 py-1 text-[10px] font-bold transition",
                                  line.unit_type === "box"
                                    ? "bg-brand-700 text-white dark:bg-brand-600"
                                    : "text-muted hover:text-ink"
                                )}
                              >
                                {t("علبة")}
                              </button>
                              <button
                                type="button"
                                onClick={() => changeUnit(index, "strip")}
                                className={cn(
                                  "rounded-md px-2 py-1 text-[10px] font-bold transition",
                                  line.unit_type === "strip"
                                    ? "bg-brand-700 text-white dark:bg-brand-600"
                                    : "text-muted hover:text-ink"
                                )}
                              >
                                {t("شريط")}
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="mx-auto flex w-fit items-center gap-1 rounded-lg border border-line p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, -1)}
                                className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink"
                                aria-label={t("تقليل الكمية")}
                              >
                                <Minus className="size-3.5" />
                              </button>
                              <input
                                value={line.quantity}
                                onChange={(event) => setQuantity(index, event.target.value)}
                                className="w-9 bg-transparent text-center text-xs font-bold outline-none nums"
                                inputMode="numeric"
                                aria-label={t("الكمية")}
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, 1)}
                                className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink"
                                aria-label={t("زيادة الكمية")}
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center text-xs nums">{money(price, currency, false)}</td>
                          <td className="px-2 py-3 text-center text-xs font-bold nums">
                            {money(price * line.quantity, currency)}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(index)}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                              aria-label={t("حذف الصنف")}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card className="sticky top-20 overflow-hidden">
            <div className="brand-gradient relative px-5 py-4 text-white">
              <div className="grid-pattern absolute inset-0 opacity-30" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-white/75">{t("الفاتورة الحالية")}</p>
                  <p className="text-lg font-bold">{t("ملخص الدفع")}</p>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-white/15">
                  <Wallet className="size-5" />
                </span>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">{t("عدد الوحدات")}</span>
                  <span className="font-semibold nums">{totalItems}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">{t("المجموع الفرعي")}</span>
                  <span className="font-semibold nums">{money(subtotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">{t("الخصم")}</span>
                  <div className="flex items-center gap-1">
                    <input
                      value={discount}
                      onChange={(event) => setDiscount(event.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                      className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-end text-xs nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                    />
                    <span className="text-[10px] text-muted">{displayCurrency(currency)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-surface-2 p-3.5">
                <div className="flex items-end justify-between">
                  <span className="text-xs font-semibold text-muted">{t("الصافي المطلوب")}</span>
                  <span className="text-2xl font-bold text-brand-700 nums dark:text-brand-300">
                    {money(net, currency)}
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-muted">{t("طريقة الدفع")}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {paymentOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMethod(option.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-bold transition",
                        method === option.value
                          ? "border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/60 dark:text-brand-200"
                          : "border-line text-muted hover:border-brand-300 hover:text-ink"
                      )}
                    >
                      <option.icon className="size-4" />
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              </div>

              {method === "آجل" ? (
                <Field label={t("اسم العميل")} required>
                  <Input
                    value={customer}
                    onChange={(event) => setCustomer(event.target.value)}
                    placeholder={t("مثال: أحمد محمود")}
                    size="sm"
                  />
                </Field>
              ) : null}

              <div className="space-y-2">
                <Field
                  label={
                    method === "آجل"
                      ? t("المدفوع مقدمًا (اختياري)")
                      : t("المبلغ المدفوع")
                  }
                >
                  <Input
                    value={paid}
                    onChange={(event) => setPaid(event.target.value)}
                    placeholder={net ? String(net) : "0"}
                    inputMode="decimal"
                    size="sm"
                  />
                </Field>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaid(String(net))}
                    className="rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-muted transition hover:border-brand-300 hover:text-ink"
                  >
                    {t("بالظبط")}
                  </button>
                  {[50, 100, 200, 500].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaid(String(value))}
                      className="rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-muted transition hover:border-brand-300 hover:text-ink nums"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={cn(
                  "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold",
                  shortfall
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                )}
              >
                <span>{shortfall ? t("المبلغ ناقص") : t("الباقي للعميل")}</span>
                <span className="text-base nums">
                  {shortfall ? money(paidValue - net, currency) : money(change, currency)}
                </span>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={submitCheckout}
                loading={checkingOut}
                disabled={!cart.length}
              >
                {t("إتمام البيع")}
                <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">F9</span>
              </Button>
              <p className="text-center text-[10px] text-muted">
                {t("سيتم خصم الكميات من المخزون تلقائيًا بنظام FEFO")}
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title={t("تمت العملية بنجاح")}
        description={
          lastSale
            ? t("الفاتورة {invoice} · الباقي {change}", {
                invoice: lastSale.invoice_number,
                change: money(
                  Math.max(0, Number(lastSale.paid_amount) - Number(lastSale.net_amount)),
                  currency
                ),
              })
            : ""
        }
        icon={FileText}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiptOpen(false)}>
              {t("إغلاق")}
            </Button>
            <Button onClick={printReceipt}>
              <Printer className="size-4" />
              {t("طباعة الفاتورة")}
            </Button>
          </>
        }
      >
        <Receipt sale={lastSale} settings={settings} currency={currency} />
      </Modal>
    </div>
  );
}
