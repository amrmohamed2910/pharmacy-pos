import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Eye,
  EyeOff,
  Languages,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button, Field, Input } from "../components/ui";
import { useSettings } from "../contexts/SettingsContext";
import { useI18n } from "../i18n";

const features = [
  {
    icon: Boxes,
    title: "تحكم كامل في المخزون",
    text: "تشغيلات، تواريخ صلاحية، وتنبيهات نواقص تلقائية.",
  },
  {
    icon: ShieldCheck,
    title: "صرف آمن بنظام FEFO",
    text: "بيع أقدم تشغيلة صالحة أولاً وتقليل الهالك.",
  },
  {
    icon: BarChart3,
    title: "تقارير تتحول لقرار",
    text: "أرباح، مبيعات، وأداء الأصناف في لوحة واحدة.",
  },
];

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { t, language, toggleLanguage, rtl } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.username.trim(), form.password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function quickFill(username, password) {
    setForm({ username, password });
    setError("");
  }

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="brand-gradient mesh relative hidden overflow-hidden lg:flex lg:flex-col">
        <div className="grid-pattern absolute inset-0 opacity-60" />
        <div className="relative z-10 flex h-full flex-col p-10 xl:p-14">
          <div className="flex items-center gap-3 text-white">
            <span className="grid size-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <svg viewBox="0 0 24 24" className="size-7" fill="currentColor">
                <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />
              </svg>
            </span>
            <div>
              <p className="text-base font-bold">{settings.pharmacy_name}</p>
              <p className="text-xs text-white/70">
                {t("Pharmacy Suite · الإصدار 3.0")}
              </p>
            </div>
          </div>

          <div className="mt-auto max-w-lg">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/90 ring-1 ring-inset ring-white/20">
              <Sparkles className="size-3.5" />
              {t("كل ما تحتاجه صيدليتك في مكان واحد")}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.25] text-white xl:text-[2.9rem]">
              {t("إدارة صيدليتك")}
              <br />
              <span className="text-brand-100">{t("بذكاء وثقة.")}</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/75">
              {t(
                "نقطة بيع سريعة، مخزون دقيق، وتقارير تفهمها من نظرة — بواجهة مصممة لتناسب يومك داخل الصيدلية."
              )}
            </p>

            <div className="mt-9 space-y-3.5">
              {features.map((feature) => (
                <div key={feature.title} className="flex items-start gap-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12 text-white ring-1 ring-inset ring-white/15">
                    <feature.icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{t(feature.title)}</p>
                    <p className="text-xs leading-6 text-white/65">{t(feature.text)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto flex items-center gap-2 pt-10 text-[11px] text-white/55">
            <ShieldCheck className="size-3.5" />
            {t("بياناتك محفوظة محليًا على سيرفر الصيدلية")}
          </div>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-50/60 to-transparent dark:from-brand-950/30 lg:hidden" />

        <button
          type="button"
          onClick={toggleLanguage}
          className="absolute end-4 top-4 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-[11px] font-bold text-muted shadow-soft transition hover:border-brand-400 hover:text-ink"
          aria-label={t("تبديل اللغة")}
        >
          <Languages className="size-3.5" />
          {language === "ar" ? "English" : "العربية"}
        </button>

        <div className="relative w-full max-w-[26rem]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="brand-gradient grid size-11 place-items-center rounded-2xl text-white shadow-soft">
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
                <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold">{settings.pharmacy_name}</p>
              <p className="text-[11px] text-muted">{t("نظام إدارة الصيدلية")}</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">{t("أهلاً بعودتك 👋")}</h2>
          <p className="mt-1.5 text-sm text-muted">
            {t("سجّل الدخول للمتابعة إلى مساحة عمل الصيدلية.")}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label={t("اسم المستخدم")} required>
              <Input
                icon={UserRound}
                autoFocus
                autoComplete="username"
                placeholder={t("أدخل اسم المستخدم")}
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            </Field>

            <Field label={t("كلمة المرور")} required>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  className="h-10.5 w-full rounded-xl border border-line bg-surface px-3 ps-9 pe-10 text-sm text-ink transition placeholder:text-muted/70 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-ink"
                  aria-label={
                    showPassword ? t("إخفاء كلمة المرور") : t("إظهار كلمة المرور")
                  }
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </div>
            ) : null}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {t("دخول إلى النظام")}
              <ArrowLeft className={`size-4 ${rtl ? "" : "-scale-x-100"}`} />
            </Button>
          </form>

          <div className="mt-7 rounded-2xl border border-dashed border-line bg-surface-2/60 p-4">
            <p className="text-[11px] font-bold text-muted">{t("حسابات تجريبية للاستعراض")}</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickFill("admin", "admin123")}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-start transition hover:border-brand-400 hover:bg-brand-50/60 dark:hover:bg-brand-950/40"
              >
                <span className="block text-xs font-bold">{t("مدير النظام")}</span>
                <span className="block text-[10px] text-muted">admin / admin123</span>
              </button>
              <button
                type="button"
                onClick={() => quickFill("huda", "huda123")}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-start transition hover:border-brand-400 hover:bg-brand-50/60 dark:hover:bg-brand-950/40"
              >
                <span className="block text-xs font-bold">{t("صيدلي")}</span>
                <span className="block text-[10px] text-muted">huda / huda123</span>
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] text-muted">
            © {new Date().getFullYear()} {settings.pharmacy_name} ·{" "}
            {t("جميع الحقوق محفوظة")}
          </p>
        </div>
      </section>
    </div>
  );
}
