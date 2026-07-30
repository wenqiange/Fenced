import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ClerkProvider,
  useAuth as useClerkAuth,
  useClerk,
  useUser,
} from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { markSignedIn, markSignedOut } from "./onboarding-state";

export interface AuthUser {
  id: string;
  clerkId: string;
  displayName: string;
  email: string | null;
}

interface AuthContextValue {
  mode: "clerk" | "dev";
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  getToken: () => Promise<string | null>;
  signInDev: (displayName?: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
const DEV_USER_ID = "dev-user-local";

function displayNameFromClerk(user: {
  fullName: string | null;
  firstName: string | null;
  username: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
}): string {
  return (
    user.fullName ||
    user.firstName ||
    user.username ||
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "You"
  );
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, userId } = useClerkAuth();
  const { user } = useUser();
  const clerk = useClerk();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    markSignedIn(displayNameFromClerk(user));
  }, [isLoaded, isSignedIn, user]);

  const value = useMemo<AuthContextValue>(() => {
    const authUser: AuthUser | null =
      isSignedIn && userId
        ? {
            id: userId,
            clerkId: userId,
            displayName: user ? displayNameFromClerk(user) : "You",
            email: user?.primaryEmailAddress?.emailAddress ?? null,
          }
        : null;

    return {
      mode: "clerk",
      isLoaded,
      isSignedIn: !!isSignedIn,
      user: authUser,
      getToken: async () => {
        try {
          return (await getToken()) ?? null;
        } catch {
          return null;
        }
      },
      signInDev: () => {
        console.warn("signInDev is only available without Clerk keys");
      },
      signOut: async () => {
        await clerk.signOut();
        markSignedOut();
      },
    };
  }, [isLoaded, isSignedIn, userId, user, getToken, clerk]);

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
      getToken: async () => (user ? `dev:${user.clerkId}` : null),
      signInDev: (displayName = "Dev user") => {
        const next: AuthUser = {
          id: DEV_USER_ID,
          clerkId: DEV_USER_ID,
          displayName,
          email: "dev@fenced.local",
        };
        setUser(next);
        markSignedIn(displayName);
      },
      signOut: async () => {
        setUser(null);
        markSignedOut();
      },
    }),
    [isLoaded, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (CLERK_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
        <ClerkAuthBridge>{children}</ClerkAuthBridge>
      </ClerkProvider>
    );
  }

  return <DevAuthProvider>{children}</DevAuthProvider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function isClerkConfigured() {
  return Boolean(CLERK_KEY);
}
