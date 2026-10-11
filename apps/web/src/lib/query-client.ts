import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: (failureCount, error) => {
        // 4xx answers are final (not found, forbidden, bad input); only retry network/5xx
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});
