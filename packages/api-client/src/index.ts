import type { AppRouter } from "@fenced/api/router";
import {
  createTRPCClient,
  httpBatchLink,
  type TRPCClient,
} from "@trpc/client";
import superjson from "superjson";

export type { AppRouter };

export interface CreateFencedClientOptions {
  baseUrl: string;
  getToken?: () => Promise<string | null> | string | null;
}

export function createFencedClient(
  options: CreateFencedClientOptions
): TRPCClient<AppRouter> {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${options.baseUrl.replace(/\/$/, "")}/trpc`,
        transformer: superjson,
        async headers() {
          const token = await options.getToken?.();
          if (!token) return {};
          return { Authorization: `Bearer ${token}` };
        },
      }),
    ],
  });
}
