import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "../stores/authStore";

const API_BASE_URL = "http://localhost:8000";

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for CORS with credentials
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Import useAuthStore at the top of the file
    const { accessToken, company } = useAuthStore.getState();

    console.log("Access Token:", accessToken);

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add company_id to token if available (handled by backend middleware)
    if (company?.id) {
      config.headers["X-Company-ID"] = company.id;
    }
    // The backend TenantMiddleware extracts company from JWT

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const { refreshToken, setAccessToken, logout } =
          useAuthStore.getState();

        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/token/refresh/`,
            {
              refresh: refreshToken,
            },
          );

          const { access } = response.data;
          setAccessToken(access);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

// Helper for handling API errors
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    // Handle different error formats
    if (data?.error) return data.error;
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
    if (data?.non_field_errors) return data.non_field_errors.join(", ");

    // Handle field-specific errors
    const firstKey = Object.keys(data || {})[0];
    if (firstKey && data) {
      const fieldError = data[firstKey];
      if (Array.isArray(fieldError))
        return `${firstKey}: ${fieldError.join(", ")}`;
      return `${firstKey}: ${fieldError}`;
    }

    return error.message;
  }

  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}
