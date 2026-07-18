import { useEffect, useState, useRef, useReducer } from "react";
import type { Href } from "expo-router";
import { evaluateAdminRouteDecision } from "../../domain/authorization/authorization";

export interface AdminLayoutControllerDependencies {
  readonly user: { readonly uid: string; readonly isAnonymous: boolean } | null;
  readonly loading: boolean;
  readonly refreshAuthorization: () => Promise<{ readonly uid: string; readonly role: unknown } | null>;
  readonly signOut: () => Promise<void>;
  readonly navigateTo: (route: Href) => void;
}

export type AdminVerificationState =
  | { readonly status: "idle" }
  | { readonly status: "checking"; readonly uid: string }
  | {
      readonly status: "verified";
      readonly uid: string;
      readonly role: unknown;
    }
  | {
      readonly status: "failed";
      readonly uid: string;
      readonly message: string;
    };

export type AdminVerificationAction =
  | { readonly type: "IDENTITY_CHANGED"; readonly uid: string | null }
  | { readonly type: "REFRESH_STARTED"; readonly uid: string }
  | { readonly type: "REFRESH_SUCCESS"; readonly uid: string; readonly role: unknown }
  | { readonly type: "REFRESH_FAILURE"; readonly uid: string; readonly message: string }
  | { readonly type: "RESET" };

export function verificationReducer(
  state: AdminVerificationState,
  action: AdminVerificationAction,
): AdminVerificationState {
  switch (action.type) {
    case "IDENTITY_CHANGED":
    case "RESET":
      return { status: "idle" };
    case "REFRESH_STARTED":
      return { status: "checking", uid: action.uid };
    case "REFRESH_SUCCESS":
      return { status: "verified", uid: action.uid, role: action.role };
    case "REFRESH_FAILURE":
      return { status: "failed", uid: action.uid, message: action.message };
    default:
      return state;
  }
}

export function useAdminLayoutController(dependencies: AdminLayoutControllerDependencies) {
  const { user, loading, refreshAuthorization, signOut, navigateTo } = dependencies;

  const [verificationState, dispatch] = useReducer(verificationReducer, { status: "idle" });
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const activeUidRef = useRef<string | null>(null);
  const activeIsAnonymousRef = useRef<boolean>(false);
  const refreshGenerationRef = useRef(0);
  const signingOutRef = useRef(false);

  const currentUid = user?.uid ?? null;
  const isAnonymous = user?.isAnonymous ?? false;

  // Detect identity/anonymous change synchronously during render
  const previousUid = activeUidRef.current;
  const previousIsAnonymous = activeIsAnonymousRef.current;
  activeUidRef.current = currentUid;
  activeIsAnonymousRef.current = isAnonymous;

  if (currentUid !== previousUid || isAnonymous !== previousIsAnonymous) {
    refreshGenerationRef.current += 1;
  }

  // Reset the reducer state in an effect responding to identity changes
  useEffect(() => {
    dispatch({ type: "IDENTITY_CHANGED", uid: currentUid });
  }, [currentUid, isAnonymous]);

  const verificationMatchesCurrentUser =
    verificationState.status !== "idle" &&
    verificationState.uid === currentUid;

  useEffect(() => {
    if (loading || !currentUid || isAnonymous) {
      return;
    }

    if (!verificationMatchesCurrentUser) {
      void triggerRefresh(currentUid);
    }
  }, [currentUid, isAnonymous, loading, verificationMatchesCurrentUser]);

  async function triggerRefresh(expectedUid = currentUid) {
    if (!expectedUid) return;

    dispatch({ type: "REFRESH_STARTED", uid: expectedUid });
    const generation = ++refreshGenerationRef.current;

    try {
      const result = await refreshAuthorization();

      // Accept only if generation, current active ref UID, and result UID all match the expected UID
      if (
        generation === refreshGenerationRef.current &&
        activeUidRef.current === expectedUid
      ) {
        if (result && result.uid === expectedUid) {
          dispatch({
            type: "REFRESH_SUCCESS",
            uid: expectedUid,
            role: result.role,
          });
        } else {
          dispatch({
            type: "REFRESH_FAILURE",
            uid: expectedUid,
            message: "Mismatched or invalid verification result received.",
          });
        }
      }
    } catch (err: unknown) {
      if (
        generation === refreshGenerationRef.current &&
        activeUidRef.current === expectedUid
      ) {
        dispatch({
          type: "REFRESH_FAILURE",
          uid: expectedUid,
          message: "Failed to refresh authorization claims.",
        });
      }
    }
  }

  async function handleSignOut() {
    if (signingOutRef.current) {
      return;
    }

    signingOutRef.current = true;
    setSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();
      setSigningOut(false);
      dispatch({ type: "RESET" });
      navigateTo("/admin-login");
    } catch (err: unknown) {
      setSignOutError("Sign out failed.");
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  }

  const isVerifiedCurrentUser =
    verificationState.status === "verified" &&
    verificationState.uid === currentUid;

  const verifiedRole = isVerifiedCurrentUser
    ? (verificationState as { readonly role: unknown }).role
    : undefined;

  const shouldShowError =
    verificationState.status === "failed" &&
    verificationState.uid === currentUid;

  const decision = evaluateAdminRouteDecision({
    loading,
    user,
    role: verifiedRole,
    verified: isVerifiedCurrentUser,
    error: shouldShowError ? (verificationState as { readonly message: string }).message : null,
  });

  const shouldRedirectToLogin = !loading && (decision === "sign-in-required" || decision === "anonymous-denied");
  const shouldRedirectToAccessDenied = !loading && decision === "access-denied";
  const shouldRenderSlot = !loading && decision === "allowed" && isVerifiedCurrentUser;

  const shouldShowSpinner =
    loading ||
    Boolean(
      user &&
      !user.isAnonymous &&
      !shouldShowError &&
      !shouldRedirectToAccessDenied &&
      !shouldRenderSlot
    );

  return {
    shouldShowSpinner,
    shouldShowError,
    shouldRedirectToLogin,
    shouldRedirectToAccessDenied,
    shouldRenderSlot,
    signOutError,
    signingOut,
    triggerRefresh,
    handleSignOut,
  };
}
