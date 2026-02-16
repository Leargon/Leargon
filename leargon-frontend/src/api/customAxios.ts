import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

const axiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - inject JWT token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      tokenStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Orval mutator function
export const customAxios = <T>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  return axiosInstance.request<T>(config);
};

export default customAxios;
