import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the API server.
 * Priority: EXPO_PUBLIC_API_URL (Vercel) > EXPO_PUBLIC_DOMAIN (Replit/local)
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // Kalau sudah deploy ke Vercel, set EXPO_PUBLIC_API_URL di .env
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) {
    return apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
  }

  // Fallback ke Replit/local
  const host = process.env.EXPO_PUBLIC_DOMAIN;
  if (!host) {
    throw new Error("Set EXPO_PUBLIC_API_URL (Vercel URL) or EXPO_PUBLIC_DOMAIN");
  }

  return new URL(`https://${host}`).href;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | FormData,
  options?: { headers?: Record<string, string> },
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const isFormData = data instanceof FormData;
  const headers: Record<string, string> = { ...options?.headers };

  if (data && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: isFormData ? (data as any) : data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url.toString());

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
