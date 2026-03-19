import axios from "axios";

// In dev, default to same-origin so LAN clients work with Vite proxy.
const apiUrl = import.meta.env.VITE_API_URL || "/api";
let getAuthToken = null;

if (import.meta.env.PROD && apiUrl.includes("localhost")) {
  throw new Error("Invalid VITE_API_URL for production. Use your deployed backend URL.");
}

const axiosInstance = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // by adding this field browser will send the cookies to server automatically, on every single req
});

axiosInstance.interceptors.request.use(async (config) => {
  if (!getAuthToken) return config;

  const token = await getAuthToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const setAuthTokenGetter = (tokenGetter) => {
  getAuthToken = tokenGetter;
};

export default axiosInstance;
