import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { createFencedClient } from "@fenced/api-client";
import { useAuth } from "./auth";

type Client = ReturnType<typeof createFencedClient>;

const ApiContext = createContext<Client | null>(null);

function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // On native device running Expo Go, localhost points to the phone, so use hostUri if available
  if (Platform.OS !== "web") {
    const host = Constants.expoConfig?.hostUri?.split(":")[0];
    if (host) return `http://${host}:3001`;
  }
  return "http://localhost:3001";
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;

  const baseUrl = resolveApiBaseUrl();

  const client = useMemo(
    () =>
      createFencedClient({
        baseUrl,
        getToken: () => authRef.current.getToken(),
      }),
    [baseUrl]
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used within ApiProvider");
  return client;
}
