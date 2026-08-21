import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/** Extract a human-readable message from API errors thrown by apiRequest. */
export function parseApiError(err: unknown): string {
  if (!err) return "An unknown error occurred. Please try again.";
  const msg = (err as any)?.message ?? String(err);
  if (!msg || msg === "Failed to fetch") {
    return "Network error. Please check your connection and try again.";
  }
  // Server errors come back as "404: {\"message\":\"...\"}" — parse them
  const colonIdx = msg.indexOf(": ");
  if (colonIdx !== -1) {
    const rest = msg.slice(colonIdx + 2).trim();
    try {
      const parsed = JSON.parse(rest);
      if (parsed?.message) return parsed.message;
    } catch {}
    return rest;
  }
  return msg;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  additionalHeaders?: HeadersInit,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...additionalHeaders },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
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
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

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
