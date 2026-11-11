import common from "./common";
import login from "./pages/login";
import dashboard from "./pages/dashboard";
import pos from "./pages/pos";
import inventory from "./pages/inventory";
import sales from "./pages/sales";
import purchases from "./pages/purchases";
import reports from "./pages/reports";
import settings from "./pages/settings";

/**
 * خريطة الترجمة: المفتاح هو النص العربي كما يظهر في الواجهة،
 * والقيمة هي المقابل الإنجليزي. أي نص غير موجود يبقى كما هو.
 * ملفات الصفحات تُدمج بعد الملف المشترك لتستطيع تخصيص ترجمتها.
 */
export const messages = {
  ar: {},
  en: {
    ...common,
    ...login,
    ...dashboard,
    ...pos,
    ...inventory,
    ...sales,
    ...purchases,
    ...reports,
    ...settings,
  },
};

/**
 * رسائل ديناميكية قادمة من الخادم تحتوي على قيم متغيّرة،
 * تُطابق بتعبير نمطي قبل البحث في الخريطة الثابتة.
 */
export const patterns = [
  [/^الصنف رقم (\d+) غير موجود$/, "Item #$1 not found"],
  [/^الصنف رقم (\d+) غير موجود أو غير مفعّل$/, "Item #$1 not found or inactive"],
  [/^يجب إدخال كمية للصنف «(.+)»$/, 'Please enter a quantity for "$1"'],
  [
    /^تاريخ انتهاء التشغيلة للصنف «(.+)» غير صالح$/,
    'The batch expiry date for "$1" is invalid',
  ],
  [/^تعذر إتمام عملية البيع: (.+)$/, "Could not complete the sale: $1"],
  [
    /^الكمية المطلوبة \((.+)\) من «(.+)» غير متوفرة\. المتاح حاليًا: (.+)$/,
    "The requested quantity ($1) of \"$2\" is unavailable. Available now: $3",
  ],
];

export default messages;
