import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error("Missing VITE_API_URL");
}

if (import.meta.env.PROD && apiUrl.includes("localhost")) {
  throw new Error("Invalid VITE_API_URL for production. Use your deployed backend URL.");
}

const axiosInstance = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // by adding this field browser will send the cookies to server automatically, on every single req
});

export default axiosInstance;
