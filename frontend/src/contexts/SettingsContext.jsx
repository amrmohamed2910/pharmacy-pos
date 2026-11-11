import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

const defaultSettings = {
  pharmacy_name: "صيدليتي",
  pharmacy_phone: "",
  pharmacy_address: "",
  currency: "ج.م",
  tax_rate: 0,
  low_stock_threshold: 10,
  expiry_warning_days: 90,
  receipt_footer: "شكرًا لثقتكم بنا",
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.get("/settings");
      setSettings({ ...defaultSettings, ...data });
    } catch {
      /* تجاهل أخطاء الإعدادات غير الحرجة */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (payload) => {
    const data = await api.put("/settings", payload);
    setSettings({ ...defaultSettings, ...data });
    return data;
  }, []);

  const value = useMemo(
    () => ({
      settings,
      loading,
      refresh,
      update,
      currency: settings.currency || "ج.م",
    }),
    [settings, loading, refresh, update]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
