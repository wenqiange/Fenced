import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import { markSignedIn, markSignedOut, resetOnboarding } from "./onboarding-state";
import { resetAppState } from "./local-store";

export interface AuthUser {
  id: string;
  authId: string;
  displayName: string;
  email: string | null;
}

interface AuthContextValue {
  mode: "supabase" | "dev";
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  getToken: () => Promise<string | null>;
  signInDev: (displayName?: string) => void;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const DEV_USER_ID = "dev-user-local";

const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          storage: secureStorageAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === "web",
        },
      })
    : null;

export function isSupabaseConfigured() {
  return supabase !== null;
}

export async function exchangeCodeForSession(code: string) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data;
}

function toAuthUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? null;
  return {
    id: user.id,
    authId: user.id,
    displayName: meta.full_name || meta.name || email?.split("@")[0] || "You",
    email,
  };
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const client = supabase!;
  const [isLoaded, setIsLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoaded(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [client]);

  const user = useMemo(() => (session ? toAuthUser(session.user) : null), [session]);

  useEffect(() => {
    if (user) markSignedIn(user.displayName);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: "supabase",
      isLoaded,
      isSignedIn: !!user,
      user,
      getToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
      signInDev: () => console.warn("signInDev is only available without Supabase keys"),
      signInWithPassword: async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUpWithPassword: async (email, password) => {
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        // No session back means the project requires email confirmation first.
        return { needsEmailConfirm: !data.session };
      },
      signInWithGoogle: async () => {
        if (Platform.OS === "web") {
          const redirectTo =
            typeof window !== "undefined"
              ? `${window.location.origin}/sso-callback`
              : Linking.createURL("sso-callback");
          const { data, error } = await client.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo },
          });
          if (error) throw error;
          if (data?.url && typeof window !== "undefined") {
            window.location.href = data.url;
          }
          return;
        }

        const redirectTo = Linking.createURL("sso-callback");
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type !== "success") return;
        // PKCE flow: the redirect carries ?code=..., exchanged for a session.
        const code = new URL(res.url).searchParams.get("code");
        if (!code) throw new Error("Google sign-in returned no code");
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      },
      signOut: async () => {
        try {
          await client.auth.signOut();
        } finally {
          markSignedOut();
          await resetAppState();
          await resetOnboarding();
        }
      },
    }),
    [client, isLoaded, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function DevAuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: "dev",
      isLoaded,
      isSignedIn: !!user,
      user,
      getToken: async () => (user ? `dev:${user.authId}` : null),
      signInDev: (displayName = "Dev user") => {
        setUser({
          id: DEV_USER_ID,
          authId: DEV_USER_ID,
          displayName,
          email: "dev@fenced.local",
        });
        markSignedIn(displayName);
      },
      signInWithPassword: async () => {},
      signUpWithPassword: async () => ({ needsEmailConfirm: false }),
      signInWithGoogle: async () => {},
      signOut: async () => {
        setUser(null);
        markSignedOut();
        await resetAppState();
        await resetOnboarding();
      },
    }),
    [isLoaded, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return supabase ? (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  ) : (
    <DevAuthProvider>{children}</DevAuthProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
