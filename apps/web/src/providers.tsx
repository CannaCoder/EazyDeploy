"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./lib/trpc";

// Prevent third-party browser extensions (like MetaMask inpage.js) from triggering the Next.js dev overlay
if (typeof window !== "undefined") {
  const isExtensionError = (error: any, filename?: string) => {
    if (filename && (filename.includes("chrome-extension://") || filename.includes("moz-extension://"))) {
      return true;
    }
    const msg = error?.message || String(error || "");
    if (msg.includes("MetaMask") || msg.includes("inpage.js")) {
      return true;
    }
    return false;
  };

  window.addEventListener(
    "error",
    (event) => {
      if (isExtensionError(event.error, event.filename)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (isExtensionError(event.reason)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:4000"}/trpc`,
          async headers() {
            if (typeof window !== "undefined" && (window as any).Clerk?.session) {
              try {
                const token = await (window as any).Clerk.session.getToken();
                if (token) {
                  return {
                    authorization: `Bearer ${token}`,
                  };
                }
              } catch {
                // Fallback
              }
            }

            // In development or test environments, fallback to mock developer token
            if (process.env.NODE_ENV !== "production") {
              return {
                authorization: "Bearer test_user_developer_1",
              };
            }

            return {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
