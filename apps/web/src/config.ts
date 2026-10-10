const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3030";

const config = {
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  apiUrl,
  backendUrl: `${apiUrl}/api`,
  betterAuthUrl: `${apiUrl}/api/auth`,
};

export const getConfig = () => {
  return config;
};
