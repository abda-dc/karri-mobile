import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AuthIdentity,
  AuthorizationSession,
  AuthenticatedSession,
} from "../../application/services/AuthSessionService";
import type { AuthorizationRole } from "../../domain/authorization/roles";
import type { Permission } from "../../domain/authorization/permissions";
import { hasPermission as authHasPermission } from "../../domain/authorization/authorization";
import { reportFriendlyError } from "../errors/getFriendlyError";
import { mobileServices } from "../services/mobileServices";

export interface AuthSessionState {
  readonly session: AuthenticatedSession | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export type UseAuthSessionResult = {
  readonly user: AuthIdentity | null;
  readonly authorization: AuthorizationSession | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly authorizationRole: AuthorizationRole;
  hasPermission(permission: Permission): boolean;
  refreshAuthorization(): Promise<{ readonly uid: string; readonly role: AuthorizationRole } | null>;
};

export function useAuthSession(): UseAuthSessionResult {
  const [state, setState] = useState<AuthSessionState>({
    session: null,
    loading: mobileServices.auth.isConfigured,
    error: mobileServices.auth.isConfigured
      ? null
      : "Karri is not configured for this environment. Add the documented mobile environment values.",
  });

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!mobileServices.auth.isConfigured) {
      return;
    }

    try {
      return mobileServices.auth.subscribe(
        (session) => setState({ session, loading: false, error: null }),
        (error) =>
          setState({
            session: null,
            loading: false,
            error: reportFriendlyError(error, "auth.watch-session"),
          }),
      );
    } catch (error) {
      setState({
        session: null,
        loading: false,
        error: reportFriendlyError(error, "auth.start-session-watch"),
      });
      return;
    }
  }, []);

  const authorizationRole = useMemo<AuthorizationRole>(() => {
    if (state.loading || !state.session) {
      return "user";
    }
    return state.session.authorization.role;
  }, [state.loading, state.session]);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return authHasPermission(authorizationRole, permission);
    },
    [authorizationRole],
  );

  const generationRef = useRef(0);

  const refreshAuthorization = useCallback(async (): Promise<{ readonly uid: string; readonly role: AuthorizationRole } | null> => {
    setRefreshing(true);
    const generation = ++generationRef.current;

    try {
      const updatedAuth = await mobileServices.auth.refreshAuthorization();
      if (generation !== generationRef.current) {
        return null;
      }

      if (updatedAuth) {
        setState((current) => {
          if (!current.session || current.session.identity.uid !== updatedAuth.uid) {
            return current;
          }
          return {
            ...current,
            session: {
              identity: current.session.identity,
              authorization: { role: updatedAuth.role },
            },
          };
        });
        return updatedAuth;
      }
      return null;
    } catch (error) {
      if (generation === generationRef.current) {
        setState((current) => ({
          ...current,
          error: reportFriendlyError(error, "auth.refresh-claims"),
        }));
      }
      throw error;
    } finally {
      if (generation === generationRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  return {
    user: state.session?.identity ?? null,
    authorization: state.session?.authorization ?? null,
    loading: state.loading || refreshing,
    error: state.error,
    authorizationRole,
    hasPermission,
    refreshAuthorization,
  };
}
