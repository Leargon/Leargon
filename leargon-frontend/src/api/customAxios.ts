import axios, { AxiosError } from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

const axiosInstance = axios.create({
  baseURL: '/api',
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

// Orval 8 mutator function — adapts fetch-style RequestInit to axios
export const customAxios = async <T>(
  url: string,
  options?: RequestInit
): Promise<T> => {
  const headers: Record<string, string> = {};
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => { headers[key] = value; });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => { headers[key] = value; });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  const response = await axiosInstance.request({
    url,
    method: (options?.method as string) || 'GET',
    data: options?.body ? JSON.parse(options.body as string) : undefined,
    headers,
    signal: options?.signal ?? undefined,
  });

  return {
    data: response.data,
    status: response.status,
    headers: new Headers(
      Object.entries(response.headers).reduce<Record<string, string>>((acc, [key, val]) => {
        if (val != null) acc[key] = String(val);
        return acc;
      }, {})
    ),
  } as T;
};

export default customAxios;
