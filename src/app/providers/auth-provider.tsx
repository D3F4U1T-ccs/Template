import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";

import {
  getFirebaseServices,
  isFirebaseConfigured,
  missingFirebaseEnv,
} from "@/data/firebase";
import type { UserSession, WorkspaceMode } from "@/types/models";

const DEMO_AUTH_KEY = "twiki-control-center:demo-auth";

type AuthContextValue = {
  user: UserSession | null;
  ready: boolean;
  mode: WorkspaceMode;
  isFirebaseConfigured: boolean;
  missingFirebaseEnv: string[];
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  continueInLocalMode: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function createDemoUser(): UserSession {
  return {
    uid: "local-demo",
    email: "demo@local",
    displayName: "Local demo",
    isDemo: true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const isDemoEnabled = localStorage.getItem(DEMO_AUTH_KEY) === "true";
      setUser(isDemoEnabled ? createDemoUser() : null);
      setReady(true);
      return;
    }

    const services = getFirebaseServices();

    if (!services) {
      setReady(true);
      return;
    }

    return onAuthStateChanged(services.auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setReady(true);
        return;
      }

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        isDemo: false,
      });
      setReady(true);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const services = getFirebaseServices();

    if (!services) {
      throw new Error("Firebase Auth is not configured yet.");
    }

    localStorage.removeItem(DEMO_AUTH_KEY);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account",
    });

    await signInWithPopup(services.auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    if (user?.isDemo) {
      localStorage.removeItem(DEMO_AUTH_KEY);
      setUser(null);
      return;
    }

    const services = getFirebaseServices();

    if (!services) {
      setUser(null);
      return;
    }

    await firebaseSignOut(services.auth);
  }, [user]);

  const continueInLocalMode = useCallback(() => {
    localStorage.setItem(DEMO_AUTH_KEY, "true");
    setUser(createDemoUser());
    setReady(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      mode: user?.isDemo || !isFirebaseConfigured ? "local" : "firebase",
      isFirebaseConfigured,
      missingFirebaseEnv,
      signInWithGoogle,
      signOut,
      continueInLocalMode,
    }),
    [continueInLocalMode, ready, signInWithGoogle, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
