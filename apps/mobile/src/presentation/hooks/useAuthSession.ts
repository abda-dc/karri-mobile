import { useEffect, useState } from "react";
import {
  subscribeToAuthSession,
  type AuthIdentity,
} from "../../infrastructure/firebase/auth";
import { isFirebaseConfigured } from "../../infrastructure/firebase/client";
import { reportFriendlyError } from "../errors/getFriendlyError";

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
      : "Karri is not configured for this environment. Add the documented mobile environment values.",
  });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }

    try {
      return subscribeToAuthSession(
        (user) => setState({ user, loading: false, error: null }),
        (error) =>
          setState({
            user: null,
            loading: false,
            error: reportFriendlyError(error, "auth.watch-session"),
          }),
      );
    } catch (error) {
      setState({
        user: null,
        loading: false,
        error: reportFriendlyError(error, "auth.start-session-watch"),
      });
      return;
    }
  }, []);

  return state;
}
