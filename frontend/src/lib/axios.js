import axios from "axios";

function normalizeApiBaseUrl(rawUrl) {
  // In dev, default to same-origin and hit backend through Vite proxy.
  if (!rawUrl) return "/api";

  // Absolute URL: ensure requests go to backend api prefix.
  if (/^https?:\/\//i.test(rawUrl)) {
    const parsed = new URL(rawUrl);
    const normalizedPath = parsed.pathname === "/" ? "/api" : parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = normalizedPath.endsWith("/api") ? normalizedPath : `${normalizedPath}/api`;
    return parsed.toString().replace(/\/+$/, "");
  }

  // Relative URL: ensure it starts with / and includes /api.
  const withLeadingSlash = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  const noTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return noTrailingSlash.endsWith("/api") ? noTrailingSlash : `${noTrailingSlash}/api`;
}

const apiUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

if (import.meta.env.PROD && apiUrl.includes("localhost")) {
  throw new Error("Invalid VITE_API_URL for production. Use your deployed backend URL.");
}

const axiosInstance = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // by adding this field browser will send the cookies to server automatically, on every single req
});

export default axiosInstance;
