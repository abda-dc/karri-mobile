import { useEffect, useRef, useState } from "react";
import type { AdminOperationsOverview } from "../../domain/admin/AdminOperationsOverview";
import type { AuthorizationRole } from "../../domain/authorization/roles";
import { mobileServices } from "../services/mobileServices";

const LOAD_ERROR_MESSAGE =
  "Operations data could not be loaded. Please check your connection and try again.";
const SIGN_OUT_ERROR_MESSAGE =
  "Sign out failed. Please check your connection and try again.";

export interface UseAdminOperationsOverviewOptions {
  readonly authorizationRole: AuthorizationRole;
  readonly identityKey: string | null;
  readonly loadOverview?: (
    role: AuthorizationRole,
  ) => Promise<AdminOperationsOverview>;
  readonly signOut?: () => Promise<void>;
  readonly onSignedOut?: () => void;
}

interface OverviewState {
  readonly contextKey: string | null;
  readonly overview: AdminOperationsOverview | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export interface UseAdminOperationsOverviewResult {
  readonly overview: AdminOperationsOverview | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly signingOut: boolean;
  readonly signOutError: string | null;
  reload(): Promise<void>;
  handleSignOut(): Promise<void>;
}

function defaultLoadOverview(
  role: AuthorizationRole,
): Promise<AdminOperationsOverview> {
  return mobileServices.adminOperations.getOverview(role);
}

function defaultSignOut(): Promise<void> {
  return mobileServices.auth.signOut();
}

export function getAdministratorIdentityLabel(
  identity: { readonly email: string | null } | null,
): string {
  const email = identity?.email?.trim();
  return email ? email : "Authenticated administrator";
}

export function useAdminOperationsOverview({
  authorizationRole,
  identityKey,
  loadOverview = defaultLoadOverview,
  signOut = defaultSignOut,
  onSignedOut,
}: UseAdminOperationsOverviewOptions): UseAdminOperationsOverviewResult {
  const contextKey = identityKey
    ? `${identityKey}:${authorizationRole}`
    : null;
  const [state, setState] = useState<OverviewState>({
    contextKey: null,
    overview: null,
    loading: Boolean(contextKey),
    error: null,
  });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const activeContextRef = useRef<string | null>(contextKey);
  const requestGenerationRef = useRef(0);
  const inFlightLoadRef = useRef<{
    readonly contextKey: string;
    readonly operation: Promise<void>;
  } | null>(null);
  const signOutOperationRef = useRef<Promise<void> | null>(null);

  if (activeContextRef.current !== contextKey) {
    activeContextRef.current = contextKey;
    requestGenerationRef.current += 1;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
      inFlightLoadRef.current = null;
      signOutOperationRef.current = null;
    };
  }, []);

  function startLoad(
    expectedContextKey: string,
    expectedRole: AuthorizationRole,
  ): Promise<void> {
    const currentLoad = inFlightLoadRef.current;
    if (currentLoad?.contextKey === expectedContextKey) {
      return currentLoad.operation;
    }

    const generation = ++requestGenerationRef.current;
    setState((current) => ({
      contextKey: expectedContextKey,
      overview:
        current.contextKey === expectedContextKey ? current.overview : null,
      loading: true,
      error: null,
    }));

    let operation!: Promise<void>;
    operation = (async () => {
      try {
        const overview = await loadOverview(expectedRole);
        if (
          mountedRef.current &&
          generation === requestGenerationRef.current &&
          activeContextRef.current === expectedContextKey
        ) {
          setState({
            contextKey: expectedContextKey,
            overview,
            loading: false,
            error: null,
          });
        }
      } catch {
        if (
          mountedRef.current &&
          generation === requestGenerationRef.current &&
          activeContextRef.current === expectedContextKey
        ) {
          setState({
            contextKey: expectedContextKey,
            overview: null,
            loading: false,
            error: LOAD_ERROR_MESSAGE,
          });
        }
      } finally {
        if (inFlightLoadRef.current?.operation === operation) {
          inFlightLoadRef.current = null;
        }
      }
    })();

    inFlightLoadRef.current = { contextKey: expectedContextKey, operation };
    return operation;
  }

  useEffect(() => {
    if (!contextKey) {
      setState({
        contextKey: null,
        overview: null,
        loading: false,
        error: null,
      });
      return;
    }

    void startLoad(contextKey, authorizationRole);
  }, [authorizationRole, contextKey, loadOverview]);

  function reload(): Promise<void> {
    if (!contextKey) {
      return Promise.resolve();
    }
    return startLoad(contextKey, authorizationRole);
  }

  function handleSignOut(): Promise<void> {
    const currentOperation = signOutOperationRef.current;
    if (currentOperation) {
      return currentOperation;
    }

    setSignOutError(null);
    setSigningOut(true);

    let operation!: Promise<void>;
    operation = (async () => {
      try {
        await signOut();
        if (mountedRef.current) {
          setSigningOut(false);
          onSignedOut?.();
        }
      } catch {
        if (mountedRef.current) {
          setSignOutError(SIGN_OUT_ERROR_MESSAGE);
        }
      } finally {
        if (signOutOperationRef.current === operation) {
          signOutOperationRef.current = null;
        }
        if (mountedRef.current) {
          setSigningOut(false);
        }
      }
    })();

    signOutOperationRef.current = operation;
    return operation;
  }

  const stateMatchesContext = state.contextKey === contextKey;

  return {
    overview: stateMatchesContext ? state.overview : null,
    loading: contextKey !== null && (!stateMatchesContext || state.loading),
    error: stateMatchesContext ? state.error : null,
    signingOut,
    signOutError,
    reload,
    handleSignOut,
  };
}
