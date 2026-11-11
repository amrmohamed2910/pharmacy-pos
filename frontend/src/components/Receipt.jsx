import { formatDateTime, money, paymentLabels, unitLabels } from "../lib/utils";
import { useI18n } from "../i18n";

export function Receipt({ sale, settings, currency = "ج.م" }) {
  const { t, rtl } = useI18n();
  if (!sale) return null;
  const items = sale.items || [];
  const discount = Number(sale.discount || 0);
  const paid = Number(sale.paid_amount || 0);
  const net = Number(sale.net_amount || 0);
  const change = Math.max(0, paid - net);

  return (
    <div
      className="receipt-print mx-auto w-full max-w-[340px] rounded-xl border border-line bg-white p-5 text-black"
      dir={rtl ? "rtl" : "ltr"}
      style={{ fontFamily: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif" }}
    >
      <div className="text-center">
        <p className="text-base font-bold">{settings?.pharmacy_name || t("صيدليتي")}</p>
        {settings?.pharmacy_address ? (
          <p className="mt-0.5 text-[10px] leading-4 text-black/60">{settings.pharmacy_address}</p>
        ) : null}
        {settings?.pharmacy_phone ? (
          <p className="text-[10px] text-black/60" dir="ltr">
            {settings.pharmacy_phone}
          </p>
        ) : null}
      </div>

      <div className="my-3 border-y border-dashed border-black/30 py-2 text-[10px]">
        <div className="flex justify-between">
          <span>{t("رقم الفاتورة")}</span>
          <span className="font-bold" dir="ltr">
            {sale.invoice_number}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t("التاريخ")}</span>
          <span>{formatDateTime(sale.created_at)}</span>
        </div>
        {sale.customer_name ? (
          <div className="flex justify-between">
            <span>{t("العميل")}</span>
            <span>{sale.customer_name}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span>{t("طريقة الدفع")}</span>
          <span>{paymentLabels[sale.payment_method] || sale.payment_method}</span>
        </div>
      </div>

      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-black/20 text-black/60">
            <th className="pb-1 text-start font-semibold">{t("الصنف")}</th>
            <th className="pb-1 text-center font-semibold">{t("الكمية")}</th>
            <th className="pb-1 text-end font-semibold">{t("الإجمالي")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const qty = item.quantity_boxes_sold || item.quantity_strips_sold || 0;
            const unit = item.quantity_boxes_sold > 0 ? "box" : "strip";
            return (
              <tr key={item.id} className="border-b border-black/10 last:border-0">
                <td className="py-1.5">
                  <p className="font-semibold">{item.medicine_name || t("صنف")}</p>
                  <p className="text-[9px] text-black/50">
                    {qty} {unitLabels[unit]} × {money(item.unit_price, currency, false)}
                  </p>
                </td>
                <td className="py-1.5 text-center">{qty}</td>
                <td className="py-1.5 text-end font-semibold">{money(item.subtotal, currency, false)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-t border-dashed border-black/30 pt-2 text-[11px]">
        <div className="flex justify-between">
          <span>{t("المجموع")}</span>
          <span className="nums">{money(sale.total_amount, currency)}</span>
        </div>
        {discount > 0 ? (
          <div className="flex justify-between">
            <span>{t("الخصم")}</span>
            <span className="nums">- {money(discount, currency)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-black/20 pt-1.5 text-sm font-bold">
          <span>{t("الصافي")}</span>
          <span className="nums">{money(net, currency)}</span>
        </div>
        <div className="flex justify-between text-black/70">
          <span>{t("المدفوع")}</span>
          <span className="nums">{money(paid, currency)}</span>
        </div>
        <div className="flex justify-between text-black/70">
          <span>{t("الباقي")}</span>
          <span className="nums">{money(change, currency)}</span>
        </div>
      </div>

      <p className="mt-4 text-center text-[10px] leading-4 text-black/55">
        {settings?.receipt_footer || t("شكرًا لثقتكم بنا")}
      </p>
      <p className="mt-1 text-center text-[9px] tracking-[0.3em] text-black/35">
        {sale.invoice_number}
      </p>
    </div>
  );
}
