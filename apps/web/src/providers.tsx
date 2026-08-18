"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./lib/trpc";
import { ClerkProvider } from "@clerk/nextjs";

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
          headers() {
            return {
              authorization: "Bearer test_user_developer_1",
            };
          },
        }),
      ],
    })
  );

  const clerkKey = process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  const content = (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );

  if (clerkKey) {
    return <ClerkProvider publishableKey={clerkKey}>{content}</ClerkProvider>;
  }

  return content;
}
