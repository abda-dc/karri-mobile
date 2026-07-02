import { useEffect, useState } from "react";
import type { AuthIdentity } from "../../application/services/AuthSessionService";
import { reportFriendlyError } from "../errors/getFriendlyError";
import { mobileServices } from "../services/mobileServices";

export interface AuthSessionState {
  readonly user: AuthIdentity | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export function useAuthSession(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>({
    user: null,
    loading: mobileServices.auth.isConfigured,
    error: mobileServices.auth.isConfigured
      ? null
      : "Karri is not configured for this environment. Add the documented mobile environment values.",
  });

  useEffect(() => {
    if (!mobileServices.auth.isConfigured) {
      return;
    }

    try {
      return mobileServices.auth.subscribe(
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
