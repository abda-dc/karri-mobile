import { useEffect, useState } from "react";
import {
  getFriendlyAuthError,
  subscribeToAuthSession,
  type AuthIdentity,
} from "../../infrastructure/firebase/auth";
import { isFirebaseConfigured } from "../../infrastructure/firebase/client";

export interface AuthSessionState {
  readonly user: AuthIdentity | null;
  readonly loading: boolean;
  readonly error: string | null;
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

    try {
      return subscribeToAuthSession(
        (user) => setState({ user, loading: false, error: null }),
        (error) =>
          setState({ user: null, loading: false, error: getFriendlyAuthError(error) }),
      );
    } catch (error) {
      setState({ user: null, loading: false, error: getFriendlyAuthError(error) });
      return;
    }
  }, []);

  return state;
}
