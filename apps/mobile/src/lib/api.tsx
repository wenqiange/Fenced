import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createFencedClient } from "@fenced/api-client";
import { useAuth } from "./auth";

type Client = ReturnType<typeof createFencedClient>;

const ApiContext = createContext<Client | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

  const client = useMemo(
    () =>
      createFencedClient({
        baseUrl,
        getToken: () => auth.getToken(),
      }),
    [auth, baseUrl]
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used within ApiProvider");
  return client;
}
