/**
 * نصوص مشتركة بين كل الشاشات: التنقل، عناصر الواجهة العامة،
 * الحالات، الأدوار، وحدات القياس ورسائل الأخطاء.
 */
const common = {
  /* ------------------------------ Navigation ----------------------------- */
  "لوحة التحكم": "Dashboard",
  "نقطة البيع": "Point of Sale",
  "المخزون": "Inventory",
  "الفواتير": "Invoices",
  "المشتريات": "Purchases",
  "التقارير": "Reports",
  "الإعدادات": "Settings",
  "إدارة الصيدلية بذكاء": "Smart pharmacy management",
  "التشغيل اليومي": "Daily operations",
  "إغلاق القائمة": "Close menu",
  "نظام آمن ومحلي": "Secure and local",
  "بياناتك محفوظة على سيرفر الصيدلية ولا تغادر الشبكة.":
    "Your data stays on the pharmacy server and never leaves the network.",
  "متصل · الإصدار 3.0": "Online · Version 3.0",

  /* -------------------------------- Topbar ------------------------------- */
  "فتح القائمة": "Open menu",
  "ابحث عن دواء أو فاتورة...": "Search for a medicine or invoice...",
  "البحث السريع": "Quick search",
  "تبديل الوضع الليلي": "Toggle dark mode",
  "تبديل اللغة": "Switch language",
  "التنبيهات": "Alerts",
  "مركز التنبيهات": "Alerts center",
  "تنبيه واحد": "1 alert",
  "{count} تنبيه": "{count} alerts",
  "لا تنبيهات": "No alerts",
  "مخزون منخفض · {boxes} علبة / {strips} شريط":
    "Low stock · {boxes} box(es) / {strips} strip(s)",
  "تنتهي صلاحيته خلال {days} يوم · تشغيلة {batch}":
    "Expires in {days} day(s) · Batch {batch}",
  "كل شيء تحت السيطرة، لا توجد تنبيهات حالياً.":
    "Everything is under control. No alerts right now.",
  "فتح إدارة المخزون": "Open inventory",
  "تغيير كلمة المرور": "Change password",
  "تسجيل الخروج": "Sign out",
  "كلمتا المرور غير متطابقتين": "Passwords do not match",
  "تم تغيير كلمة المرور بنجاح": "Password changed successfully",
  "تعذر تغيير كلمة المرور": "Could not change password",
  "اختر كلمة مرور قوية لا تقل عن 6 أحرف":
    "Choose a strong password of at least 6 characters",
  "كلمة المرور الحالية": "Current password",
  "كلمة المرور الجديدة": "New password",
  "تأكيد كلمة المرور": "Confirm password",
  "6 أحرف على الأقل": "At least 6 characters",
  "سيتم استخدام كلمة المرور الجديدة في تسجيل الدخول القادم.":
    "The new password will be used the next time you sign in.",

  /* ------------------------------ Shared UI ------------------------------ */
  "حفظ": "Save",
  "حفظ التغييرات": "Save changes",
  "إضافة": "Add",
  "تعديل": "Edit",
  "حذف": "Delete",
  "بحث": "Search",
  "بحث...": "Search...",
  "إغلاق": "Close",
  "تأكيد": "Confirm",
  "إلغاء": "Cancel",
  "الكل": "All",
  "عرض": "Show",
  "عرض {from}–{to} من {total}": "Showing {from}–{to} of {total}",
  "السابق": "Previous",
  "التالي": "Next",
  "إغلاق التنبيه": "Dismiss notification",
  "تأكيد الإجراء": "Confirm action",
  "جارٍ التحميل…": "Loading…",
  "لا توجد بيانات": "No data",
  "لا توجد نتائج": "No results",
  "اختر": "Select",
  "من": "From",
  "إلى": "To",
  "الاسم": "Name",
  "الهاتف": "Phone",
  "العنوان": "Address",
  "البريد الإلكتروني": "Email",
  "التاريخ": "Date",
  "الحالة": "Status",
  "الإجمالي": "Total",
  "الصافي": "Net",
  "الخصم": "Discount",
  "الكمية": "Quantity",
  "السعر": "Price",
  "الصنف": "Item",
  "العميل": "Customer",
  "المورد": "Supplier",
  "ملاحظات": "Notes",
  "اختياري": "Optional",
  "مطلوب": "Required",
  "الكل ": "All",
  "مفعّل": "Active",
  "موقوف": "Suspended",

  /* -------------------------------- App ---------------------------------- */
  "جارٍ تجهيز مساحة العمل…": "Preparing your workspace…",
  "لا تملك صلاحية الوصول": "Access denied",
  "حسابك ({name}) لا يملك صلاحية فتح هذه الشاشة. تواصل مع مدير النظام.":
    "Your account ({name}) is not allowed to open this screen. Contact the system administrator.",
  "العودة للوحة التحكم": "Back to dashboard",

  /* ------------------------------- Statuses ------------------------------ */
  "متاح": "In stock",
  "منخفض": "Low",
  "نافد": "Out of stock",
  "قريب الانتهاء": "Expiring soon",
  "منتهي الصلاحية": "Expired",
  "مكتملة": "Completed",
  "مرتجعة": "Refunded",
  "مستلمة": "Received",
  "غير محدد": "Not specified",
  "غير معروف": "Unknown",
  "غير مصنف": "Uncategorized",
  "منتهية الصلاحية": "Expired",
  "صالحة": "Valid",

  /* -------------------------------- Roles -------------------------------- */
  "مدير النظام": "Administrator",
  "صيدلي": "Pharmacist",
  "كاشير": "Cashier",

  /* ------------------------------- Payments ------------------------------ */
  "كاش": "Cash",
  "شبكة": "Card",
  "آجل": "Credit",
  "شبكة / فيزا": "Card / Visa",

  /* -------------------------------- Units -------------------------------- */
  "علبة": "Box",
  "شريط": "Strip",
  "قرص": "Tablet",
  "زجاجة": "Bottle",
  "أمبول": "Ampoule",
  "علب": "Boxes",
  "أشرطة": "Strips",
  "علبة واحدة": "1 box",
  "شريط واحد": "1 strip",
  "؟": "?",

  /* ------------------------------- Receipt ------------------------------- */
  "رقم الفاتورة": "Invoice no.",
  "طريقة الدفع": "Payment method",
  "المجموع": "Subtotal",
  "المدفوع": "Paid",
  "الباقي": "Change",
  "صنف": "Item",
  "شكرًا لثقتكم بنا": "Thank you for your trust",
  "صيدليتي": "My Pharmacy",

  /* ------------------------------ Chart keys ----------------------------- */
  "المبيعات": "Sales",
  "المشتريات": "Purchases",
  "الأرباح": "Profit",
  "التكلفة": "Cost",
  "عدد الفواتير": "Invoices count",
  "إجمالي المبيعات": "Total sales",
  "صافي الربح": "Net profit",
  "متوسط الفاتورة": "Average invoice",
  "أفضل الأصناف": "Top items",
  "توزيع طرق الدفع": "Payment methods",
  "أقل الأصناف مبيعًا": "Slowest movers",
  "حالة المخزون": "Inventory status",
  "حركة المبيعات": "Sales trend",

  /* ---------------------------- API / errors ----------------------------- */
  "تعذر الاتصال بالخادم. تأكد من تشغيل الخادم ثم أعد المحاولة.":
    "Could not reach the server. Make sure it is running and try again.",
  "حدث خطأ غير متوقع، برجاء المحاولة مرة أخرى":
    "Something went wrong. Please try again.",
  "تعذر تحميل الملف": "Could not download the file",
  "مطلوب تسجيل الدخول للمتابعة": "Please sign in to continue",
  "الجلسة انتهت أو غير صالحة، برجاء تسجيل الدخول مرة أخرى":
    "Your session has expired or is invalid. Please sign in again.",
  "الحساب غير موجود أو موقوف": "Account not found or suspended",
  "لا تملك صلاحية تنفيذ هذا الإجراء": "You are not allowed to perform this action",
  "اسم المستخدم أو كلمة المرور غير صحيحة": "Incorrect username or password",
  "هذا الحساب موقوف، تواصل مع مدير النظام":
    "This account is suspended. Contact the system administrator.",
  "كلمة المرور الحالية غير صحيحة": "Current password is incorrect",
  "تم تحديث كلمة المرور بنجاح": "Password updated successfully",
  "التشغيلة غير موجودة": "Batch not found",
  "تاريخ الانتهاء يجب أن يكون في المستقبل": "Expiry date must be in the future",
  "لا يمكن حذف تشغيلة تم البيع منها. يمكنك تصفير الكميات بدلًا من ذلك.":
    "A batch that has been sold cannot be deleted. You can zero its quantities instead.",
  "تم حذف التشغيلة": "Batch deleted",
  "هذا الباركود مستخدم بالفعل لصنف آخر":
    "This barcode is already used by another item",
  "الصنف غير موجود": "Item not found",
  "تم أرشفة الصنف لوجود فواتير مرتبطة به":
    "Item archived because it has linked invoices",
  "تم حذف الصنف نهائيًا": "Item permanently deleted",
  "لا يمكن إضافة تشغيلة منتهية الصلاحية": "An expired batch cannot be added",
  "رقم التشغيلة مستخدم بالفعل لهذا الصنف":
    "This batch number is already used for this item",
  "المورد غير موجود": "Supplier not found",
  "تم أرشفة المورد لوجود فواتير شراء مرتبطة به":
    "Supplier archived because it has linked purchase invoices",
  "تم حذف المورد": "Supplier deleted",
  "العميل غير موجود": "Customer not found",
  "فاتورة الشراء غير موجودة": "Purchase invoice not found",
  "أمر الشراء لا يحتوي على أصناف": "The purchase order has no items",
  "مورد نقدي": "Cash supplier",
  "الفاتورة لا تحتوي على أي أصناف": "The invoice has no items",
  "الخصم لا يمكن أن يتجاوز إجمالي الفاتورة":
    "Discount cannot exceed the invoice total",
  "البيع الآجل يتطلب تحديد اسم العميل": "Credit sales require a customer name",
  "المبلغ المدفوع أقل من صافي الفاتورة":
    "The paid amount is less than the invoice net total",
  "الفاتورة غير موجودة": "Invoice not found",
  "تم إرجاع هذه الفاتورة بالفعل": "This invoice has already been refunded",
  "اسم المستخدم مستخدم بالفعل": "Username is already taken",
  "المستخدم غير موجود": "User not found",
  "لا يمكنك تعطيل حسابك الحالي": "You cannot deactivate your own account",
  "لا يمكن تغيير دور آخر مدير للنظام":
    "You cannot change the role of the last system administrator",
  "لا يمكنك حذف حسابك الحالي": "You cannot delete your own account",
  "لا يمكن حذف آخر مدير للنظام": "You cannot delete the last system administrator",
  "تم حذف المستخدم": "User deleted",
};

export default common;
