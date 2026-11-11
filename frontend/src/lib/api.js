import { getLanguage, t } from "../i18n";

const BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "pharmacy-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function buildUrl(path, params) {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (!params) return url;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.append(key, value);
  });
  const query = search.toString();
  return query ? `${url}?${query}` : url;
}

function normalizeDetail(detail, fallback) {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const field = Array.isArray(item.loc) ? item.loc.filter((p) => p !== "body").join(".") : "";
        return `${field ? `${field}: ` : ""}${item.msg || ""}`.trim();
      })
      .filter(Boolean)
      .join(" · ");
  }
  return fallback;
}

async function request(path, { method = "GET", body, params, signal } = {}) {
  const headers = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: payload,
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(t("تعذر الاتصال بالخادم. تأكد من تشغيل الخادم ثم أعد المحاولة."), 0);
  }

  if (response.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }

  if (!response.ok) {
    let detail;
    try {
      const data = await response.json();
      detail = data.detail;
    } catch {
      detail = null;
    }
    throw new ApiError(
      t(normalizeDetail(detail, "حدث خطأ غير متوقع، برجاء المحاولة مرة أخرى")),
      response.status,
      detail
    );
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return response;
}

export const api = {
  get: (path, params, options) => request(path, { params, ...options }),
  post: (path, body, options) => request(path, { method: "POST", body, ...options }),
  put: (path, body, options) => request(path, { method: "PUT", body, ...options }),
  patch: (path, body, options) => request(path, { method: "PATCH", body, ...options }),
  delete: (path, options) => request(path, { method: "DELETE", ...options }),
};

export async function downloadFile(path, filename, params) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(buildUrl(path, { ...params, lang: getLanguage() }), { headers });
  if (!response.ok) {
    throw new ApiError(t("تعذر تحميل الملف"), response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
