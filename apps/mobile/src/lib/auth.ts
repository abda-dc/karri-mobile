import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import {
  FirebaseConfigurationError,
  getFirebaseServices,
  isFirebaseConfigured,
} from "./firebase";

export type AuthSessionState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

export function getFriendlyAuthError(error: unknown): string {
  if (error instanceof FirebaseConfigurationError) {
    return error.message;
  }

  if (typeof error === "object" && error && "code" in error) {
    const code = String(error.code);

    if (code === "auth/operation-not-allowed") {
      return "Anonymous authentication is not enabled for this Firebase project yet.";
    }

    if (code === "auth/network-request-failed") {
      return "Karri could not reach Firebase. Check your connection and try again.";
    }
  }

  return "Karri could not start your session. Please try again.";
}

export async function startMvpAuthSession(): Promise<User> {
  const { auth } = getFirebaseServices();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function signOutCurrentUser(): Promise<void> {
  const { auth } = getFirebaseServices();
  await signOut(auth);
}

export function useAuthSession(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>({
    user: null,
    loading: isFirebaseConfigured,
    error: isFirebaseConfigured
      ? null
      : "Firebase is not configured. Add the values from apps/mobile/.env.example.",
  });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }

    let auth;

    try {
      auth = getFirebaseServices().auth;
    } catch (error) {
      setState({ user: null, loading: false, error: getFriendlyAuthError(error) });
      return;
    }

    return onAuthStateChanged(
      auth,
      (user) => setState({ user, loading: false, error: null }),
      (error) =>
        setState({ user: null, loading: false, error: getFriendlyAuthError(error) }),
    );
  }, []);

  return state;
}
