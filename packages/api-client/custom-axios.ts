import axios, { AxiosRequestConfig } from "axios";

const AXIOS_INSTANCE = axios.create({
  baseURL: "http://localhost:3030",
  withCredentials: true,
});

/**
 * Point the client at an API. Call once at startup, before any request
 * (e.g. with `import.meta.env.VITE_API_URL` in a Vite app).
 */
export const configureApiClient = (options: { baseURL: string }) => {
  AXIOS_INSTANCE.defaults.baseURL = options.baseURL;
};

export const customInstance = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  const response = await AXIOS_INSTANCE({
    ...config,
    ...options,
  });
  return response.data;
};
