import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { messages, patterns } from "./messages";

const STORAGE_KEY = "pharmacy-language";
export const LANGUAGES = ["ar", "en"];

export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : "ar";
}

function readInitialLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "ar";
  }
}

/**
 * اللغة النشطة متاحة على مستوى الوحدة حتى تستطيع الدوال المساعدة
 * (تنسيق التواريخ، الأرقام، رسائل الأخطاء) معرفة اللغة الحالية.
 */
let activeLanguage = readInitialLanguage();

export function getLanguage() {
  return activeLanguage;
}

export function setActiveLanguage(language) {
  activeLanguage = normalizeLanguage(language);
}

export function isRTL(language = activeLanguage) {
  return normalizeLanguage(language) === "ar";
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined || vars[name] === null ? match : String(vars[name])
  );
}

function translateDynamic(text) {
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return null;
}

/** ترجمة نص مصدره العربية إلى اللغة المطلوبة. */
export function translate(language, key, vars) {
  if (key === null || key === undefined || key === "") return "";
  const text = String(key);
  if (normalizeLanguage(language) === "en") {
    const direct = messages.en[text];
    if (direct !== undefined) return interpolate(direct, vars);
    const dynamic = translateDynamic(text);
    return interpolate(dynamic ?? text, vars);
  }
  return interpolate(messages.ar[text] ?? text, vars);
}

/**
 * دالة ترجمة عامة تعتمد على اللغة النشطة.
 * داخل مكوّنات React استخدم `const { t } = useI18n()` لضمان إعادة الرسم.
 */
export function t(key, vars) {
  return translate(activeLanguage, key, vars);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(readInitialLanguage);

  // مزامنة فورية للدوال المساعدة التي لا تستخدم الهوك.
  activeLanguage = language;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* التخزين المحلي قد يكون معطلًا */
    }
    const root = document.documentElement;
    root.lang = language;
    root.dir = isRTL(language) ? "rtl" : "ltr";
    document.title =
      language === "en"
        ? "Pharmacy Suite | Pharmacy Management System"
        : "صيدليتي | نظام إدارة الصيدلية";
  }, [language]);

  const setLanguage = useCallback((next) => {
    setLanguageState(normalizeLanguage(next));
  }, []);

  const value = useMemo(() => {
    const rtl = isRTL(language);
    return {
      language,
      dir: rtl ? "rtl" : "ltr",
      rtl,
      isRTL: rtl,
      isEnglish: language === "en",
      setLanguage,
      toggleLanguage: () => setLanguageState((current) => (current === "ar" ? "en" : "ar")),
      t: (key, vars) => translate(language, key, vars),
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

/** اختصار شائع: الحصول على دالة الترجمة فقط. */
export function useT() {
  return useI18n().t;
}
