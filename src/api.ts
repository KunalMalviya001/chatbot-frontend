import axios from "axios";

const API_URL = "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
});

// Set access token in headers
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

// Refresh token logic
export const refreshToken = async (): Promise<string | null> => {
  try {
    const refresh_token = localStorage.getItem("refresh_token");
    if (!refresh_token) return null;

    const res = await api.post("/user/refresh", { refresh_token });
    const { access_token: newAccessToken } = res.data;

    if (newAccessToken) {
      localStorage.setItem("access_token", newAccessToken);
      setAuthToken(newAccessToken);
      return newAccessToken;
    }
    return null;
  } catch (err) {
    console.error("Token refresh failed", err);
    return null;
  }
};

// Axios response interceptor for auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      const newAccessToken = await refreshToken();

      if (newAccessToken) {
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return api(originalRequest); // retry original request
      }

      // Optional: auto logout
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }

    return Promise.reject(error);
  }
);
