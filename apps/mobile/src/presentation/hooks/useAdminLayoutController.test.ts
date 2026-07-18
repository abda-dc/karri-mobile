import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock React hooks locally to run in standard Node environment without JSDOM
let stateValues: unknown[] = [];
let stateIndex = 0;
let refValues: Array<{ current: unknown }> = [];
let refIndex = 0;
let effectCallbacks: Array<{ callback: () => void | (() => void); deps?: unknown[] }> = [];
let dispatchCallCount = 0;

vi.mock("react", () => {
  return {
    useState: <T>(init: T | (() => T)) => {
      const idx = stateIndex++;
      if (stateValues[idx] === undefined) {
        stateValues[idx] = typeof init === "function" ? (init as () => T)() : init;
      }
      const setter = (valOrFn: unknown) => {
        if (typeof valOrFn === "function") {
          stateValues[idx] = valOrFn(stateValues[idx]);
        } else {
          stateValues[idx] = valOrFn;
        }
      };
      return [stateValues[idx] as T, setter];
    },
    useReducer: <S, A>(reducer: (state: S, action: A) => S, initialArg: S) => {
      const idx = stateIndex++;
      if (stateValues[idx] === undefined) {
        stateValues[idx] = initialArg;
      }
      const dispatch = (action: A) => {
        dispatchCallCount++;
        stateValues[idx] = reducer(stateValues[idx] as S, action);
      };
      return [stateValues[idx] as S, dispatch];
    },
    useRef: <T>(init: T) => {
      const idx = refIndex++;
      if (refValues[idx] === undefined) {
        refValues[idx] = { current: init };
      }
      return refValues[idx] as { current: T };
    },
    useEffect: (cb: () => void | (() => void), deps: unknown[]) => {
      effectCallbacks.push({ callback: cb, deps });
    },
    useMemo: <T>(fn: () => T) => fn(),
    useCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

import {
  useAdminLayoutController,
  AdminLayoutControllerDependencies,
  verificationReducer,
  AdminVerificationState,
  AdminVerificationAction,
} from "./useAdminLayoutController";

const act = async (cb: () => Promise<void> | void) => {
  await cb();
};

function runHook(deps: AdminLayoutControllerDependencies) {
  stateIndex = 0;
  refIndex = 0;
  effectCallbacks = [];
  return useAdminLayoutController(deps);
}

function triggerEffects() {
  const callbacks = [...effectCallbacks];
  effectCallbacks = [];
  for (const item of callbacks) {
    item.callback();
  }
}

describe("verificationReducer Pure Transition Logic", () => {
  it("Transitions from idle to checking on REFRESH_STARTED", () => {
    const state: AdminVerificationState = { status: "idle" };
    const nextState = verificationReducer(state, { type: "REFRESH_STARTED", uid: "user-123" });
    expect(nextState).toEqual({ status: "checking", uid: "user-123" });
  });

  it("Transitions from checking to verified on REFRESH_SUCCESS", () => {
    const state: AdminVerificationState = { status: "checking", uid: "user-123" };
    const nextState = verificationReducer(state, { type: "REFRESH_SUCCESS", uid: "user-123", role: "super_admin" });
    expect(nextState).toEqual({ status: "verified", uid: "user-123", role: "super_admin" });
  });

  it("Transitions from checking to failed on REFRESH_FAILURE", () => {
    const state: AdminVerificationState = { status: "checking", uid: "user-123" };
    const nextState = verificationReducer(state, { type: "REFRESH_FAILURE", uid: "user-123", message: "Error" });
    expect(nextState).toEqual({ status: "failed", uid: "user-123", message: "Error" });
  });

  it("Resets to idle on RESET or IDENTITY_CHANGED", () => {
    const state: AdminVerificationState = { status: "verified", uid: "user-123", role: "super_admin" };
    const resetState1 = verificationReducer(state, { type: "RESET" });
    const resetState2 = verificationReducer(state, { type: "IDENTITY_CHANGED", uid: "user-456" });
    expect(resetState1).toEqual({ status: "idle" });
    expect(resetState2).toEqual({ status: "idle" });
  });
});

describe("useAdminLayoutController Layout Guard Hook Integration", () => {
  beforeEach(() => {
    stateValues = [];
    refValues = [];
    stateIndex = 0;
    refIndex = 0;
    effectCallbacks = [];
    dispatchCallCount = 0;
    vi.clearAllMocks();
  });

  it("Signed-out direct-route redirect", () => {
    const deps: AdminLayoutControllerDependencies = {
      user: null,
      loading: false,
      refreshAuthorization: vi.fn(),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();
    const finalResult = runHook(deps);

    expect(finalResult.shouldRedirectToLogin).toBe(true);
    expect(finalResult.shouldShowSpinner).toBe(false);
    expect(finalResult.shouldRenderSlot).toBe(false);
    expect(deps.refreshAuthorization).not.toHaveBeenCalled();
  });

  it("Anonymous redirect", () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "anon-1", isAnonymous: true },
      loading: false,
      refreshAuthorization: vi.fn(),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();
    const finalResult = runHook(deps);

    expect(finalResult.shouldRedirectToLogin).toBe(true);
    expect(finalResult.shouldShowSpinner).toBe(false);
    expect(finalResult.shouldRenderSlot).toBe(false);
    expect(deps.refreshAuthorization).not.toHaveBeenCalled();
  });

  it("No protected content during verification", () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockImplementation(() => new Promise(() => {})), // remains in flight
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result1 = runHook(deps);
    triggerEffects();
    const result2 = runHook(deps);

    expect(result2.shouldShowSpinner).toBe(true);
    expect(result2.shouldRenderSlot).toBe(false);
    expect(result2.shouldRedirectToLogin).toBe(false);
  });

  it("Refresh failure", async () => {
    let rejectRefresh: (err: unknown) => void = () => {};
    const refreshPromise = new Promise<{ readonly uid: string; readonly role: unknown } | null>((_, reject) => {
      rejectRefresh = reject;
    });

    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockImplementation(() => refreshPromise),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result1 = runHook(deps);
    triggerEffects();
    const result2 = runHook(deps);

    expect(result2.shouldShowSpinner).toBe(true);
    expect(result2.shouldShowError).toBe(false);

    try {
      rejectRefresh(new Error("Network connection error"));
      await refreshPromise;
    } catch (e: unknown) {
      // Ignored for triggering state machine
    }

    const result3 = runHook(deps);
    expect(result3.shouldShowSpinner).toBe(false);
    expect(result3.shouldShowError).toBe(true);
    expect(result3.shouldRenderSlot).toBe(false);
  });

  it("User A/User B stale-refresh race", async () => {
    let resolveUserA: (val: { readonly uid: string; readonly role: unknown } | null) => void = () => {};
    const promiseA = new Promise<{ readonly uid: string; readonly role: unknown } | null>((resolve) => {
      resolveUserA = resolve;
    });

    const depsA: AdminLayoutControllerDependencies = {
      user: { uid: "user-a", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockImplementation(() => promiseA),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const resultA = runHook(depsA);
    triggerEffects();

    // Switch mid-flight to User B (leave User B refresh pending as well)
    const promiseB = new Promise<{ readonly uid: string; readonly role: unknown } | null>(() => {});
    const depsB: AdminLayoutControllerDependencies = {
      user: { uid: "user-b", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockImplementation(() => promiseB),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const resultB = runHook(depsB);
    triggerEffects();

    // Now resolve User A's stale promise
    resolveUserA({ uid: "user-a", role: "super_admin" });
    await promiseA;

    const finalResult = runHook(depsB);
    // User A's claims must be discarded because the active UID is now user-b
    expect(finalResult.shouldRenderSlot).toBe(false);
    expect(finalResult.shouldShowSpinner).toBe(true);
  });

  it("Successful sign-out navigation", async () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockRejectedValue(new Error("Network offline")),
      signOut: vi.fn().mockResolvedValue(undefined),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();

    try {
      await result.triggerRefresh();
    } catch {
      // Ignored
    }

    const errorStateResult = runHook(deps);
    expect(errorStateResult.shouldShowError).toBe(true);

    await errorStateResult.handleSignOut();

    const signedOutResult = runHook(deps);
    expect(deps.signOut).toHaveBeenCalled();
    expect(deps.navigateTo).toHaveBeenCalledWith("/admin-login");
    expect(signedOutResult.signOutError).toBeNull();
  });

  it("Failed sign-out remains fail-closed", async () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockRejectedValue(new Error("Network offline")),
      signOut: vi.fn().mockRejectedValue(new Error("Firebase network error")),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();

    try {
      await result.triggerRefresh();
    } catch {
      // Ignored
    }

    const errorStateResult = runHook(deps);
    expect(errorStateResult.shouldShowError).toBe(true);

    await errorStateResult.handleSignOut();

    const signedOutFailedResult = runHook(deps);
    expect(deps.signOut).toHaveBeenCalled();
    expect(deps.navigateTo).not.toHaveBeenCalled();
    expect(signedOutFailedResult.signOutError).toBe("Sign out failed.");
  });

  it("Verified administrator renders the protected slot", async () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "admin-1", role: "super_admin" }),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();

    await act(async () => {
      await result.triggerRefresh();
    });

    const finalResult = runHook(deps);
    expect(finalResult.shouldRenderSlot).toBe(true);
    expect(finalResult.shouldShowSpinner).toBe(false);
    expect(finalResult.shouldShowError).toBe(false);
  });

  it("Immediate account-switch closure", async () => {
    // 1. Render verified User A
    const depsA: AdminLayoutControllerDependencies = {
      user: { uid: "user-a", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "user-a", role: "super_admin" }),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };
    const result1 = runHook(depsA);
    triggerEffects();

    await act(async () => {
      await result1.triggerRefresh();
    });

    const verifiedResultA = runHook(depsA);
    expect(verifiedResultA.shouldRenderSlot).toBe(true);

    // 2. Switch dependencies to User B
    const depsB: AdminLayoutControllerDependencies = {
      user: { uid: "user-b", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockImplementation(() => new Promise(() => {})), // stays pending
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    // 3. Re-render the controller without running User B's effect yet
    const resultB = runHook(depsB);

    // 4. Assert shouldRenderSlot is false immediately
    expect(resultB.shouldRenderSlot).toBe(false);
  });

  it("Stale completion before new effect", async () => {
    // 1. Start User A's refresh
    let resolveUserA: (val: { readonly uid: string; readonly role: unknown } | null) => void = () => {};
    const promiseA = new Promise<{ readonly uid: string; readonly role: unknown } | null>((resolve) => {
      resolveUserA = resolve;
    });

    const depsA: AdminLayoutControllerDependencies = {
      user: { uid: "user-a", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockImplementation(() => promiseA),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const resultA = runHook(depsA);
    triggerEffects(); // starts User A's verification

    // 2. Render User B without triggering User B's effect
    const depsB: AdminLayoutControllerDependencies = {
      user: { uid: "user-b", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn(),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };
    const resultB = runHook(depsB); // updates activeUidRef.current to user-b, but doesn't trigger effect

    // 3. Resolve User A's refresh
    resolveUserA({ uid: "user-a", role: "super_admin" });
    await promiseA;

    // 4. Assert User A's result is rejected, and protected content remains hidden
    const finalResult = runHook(depsB);
    expect(finalResult.shouldRenderSlot).toBe(false);
  });

  it("User B verification", async () => {
    // 1. Start User B's refresh
    const depsB: AdminLayoutControllerDependencies = {
      user: { uid: "user-b", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "user-b", role: "moderator" }),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result = runHook(depsB);
    triggerEffects();

    // 2. Resolve with User B's UID and verify it renders slot only after accepted
    const preVerifyResult = runHook(depsB);
    expect(preVerifyResult.shouldRenderSlot).toBe(false); // not yet verified

    await act(async () => {
      await result.triggerRefresh();
    });

    const postVerifyResult = runHook(depsB);
    expect(postVerifyResult.shouldRenderSlot).toBe(true); // verified and slot is rendering
  });

  it("Same UID, anonymous-state transition starts a new verification", () => {
    // Start with anonymous user-123
    const depsAnon: AdminLayoutControllerDependencies = {
      user: { uid: "user-123", isAnonymous: true },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "user-123", role: "super_admin" }),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result1 = runHook(depsAnon);
    triggerEffects();

    // Expect: Verification not started (anonymous is denied immediately)
    const result2 = runHook(depsAnon);
    expect(result2.shouldRedirectToLogin).toBe(true);
    expect(depsAnon.refreshAuthorization).not.toHaveBeenCalled();

    // Transition same UID to non-anonymous
    const depsNonAnon: AdminLayoutControllerDependencies = {
      user: { uid: "user-123", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "user-123", role: "super_admin" }),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result3 = runHook(depsNonAnon);
    triggerEffects(); // triggers new verification effect due to anonymous transition

    expect(depsNonAnon.refreshAuthorization).toHaveBeenCalled();
  });

  it("Duplicate sign-out attempts are ignored and loading state is exposed", async () => {
    let resolveSignOut: () => void = () => {};
    const signOutPromise = new Promise<void>((resolve) => {
      resolveSignOut = resolve;
    });

    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "admin-1", role: "super_admin" }),
      signOut: vi.fn().mockImplementation(() => signOutPromise),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();

    // Verify initial signingOut state is false
    expect(result.signingOut).toBe(false);

    // Call sign out once
    const handleSignOutPromise1 = result.handleSignOut();

    const loadingSignOutResult = runHook(deps);
    expect(loadingSignOutResult.signingOut).toBe(true);

    // Try calling handleSignOut again while it is in progress
    const handleSignOutPromise2 = loadingSignOutResult.handleSignOut();

    // Resolve initial sign out
    resolveSignOut();
    await handleSignOutPromise1;
    await handleSignOutPromise2;

    // Check that signOut gateway was only called once
    expect(deps.signOut).toHaveBeenCalledTimes(1);
    expect(deps.navigateTo).toHaveBeenCalledTimes(1);
    expect(deps.navigateTo).toHaveBeenCalledWith("/admin-login");
  });

  it("No repeated refresh while checking", () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockImplementation(() => new Promise(() => {})), // stays pending
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    // First render
    const result1 = runHook(deps);
    triggerEffects();

    // Re-render
    const result2 = runHook(deps);
    triggerEffects();

    expect(deps.refreshAuthorization).toHaveBeenCalledTimes(1);
  });

  it("Verified role is bound to the refresh result", async () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "user-b", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "user-b", role: "user" }), // refresh returns "user"
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();

    await act(async () => {
      await result.triggerRefresh();
    });

    const finalResult = runHook(deps);
    expect(finalResult.shouldRenderSlot).toBe(false);
    expect(finalResult.shouldRedirectToAccessDenied).toBe(true);
  });

  it("Refreshed role grants access", async () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-b", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "admin-b", role: "operations_admin" }), // refresh returns operations_admin
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();

    await act(async () => {
      await result.triggerRefresh();
    });

    const finalResult = runHook(deps);
    expect(finalResult.shouldRenderSlot).toBe(true);
    expect(finalResult.shouldRedirectToAccessDenied).toBe(false);
  });

  it("Account switch during in-flight refresh", async () => {
    let resolveUserA: (val: { readonly uid: string; readonly role: unknown } | null) => void = () => {};
    const promiseA = new Promise<{ readonly uid: string; readonly role: unknown } | null>((resolve) => {
      resolveUserA = resolve;
    });

    let resolveUserB: (val: { readonly uid: string; readonly role: unknown } | null) => void = () => {};
    const promiseB = new Promise<{ readonly uid: string; readonly role: unknown } | null>((resolve) => {
      resolveUserB = resolve;
    });

    const depsA: AdminLayoutControllerDependencies = {
      user: { uid: "user-a", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockImplementation(() => promiseA),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const resultA = runHook(depsA);
    triggerEffects(); // starts User A refresh

    const depsB: AdminLayoutControllerDependencies = {
      user: { uid: "user-b", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockImplementation(() => promiseB),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const resultB = runHook(depsB); // User B re-render, ref updates to user-b
    triggerEffects(); // starts User B refresh

    // Confirm both refreshes were scheduled
    expect(depsA.refreshAuthorization).toHaveBeenCalledTimes(1);
    expect(depsB.refreshAuthorization).toHaveBeenCalledTimes(1);

    // Resolve User B
    resolveUserB({ uid: "user-b", role: "moderator" });
    await promiseB;

    const postResolveB = runHook(depsB);
    expect(postResolveB.shouldRenderSlot).toBe(true); // User B is verified and slot renders

    // Now resolve User A
    resolveUserA({ uid: "user-a", role: "super_admin" });
    await promiseA;

    const postResolveAStale = runHook(depsB);
    expect(postResolveAStale.shouldRenderSlot).toBe(true); // User B is STILL verified, stale User A has no effect
  });

  it("Null result does not hang and fails closed", async () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue(null), // returns null
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();

    await act(async () => {
      await result.triggerRefresh();
    });

    const finalResult = runHook(deps);
    expect(finalResult.shouldShowSpinner).toBe(false);
    expect(finalResult.shouldShowError).toBe(true);
    expect(finalResult.shouldRenderSlot).toBe(false);
  });

  it("Mismatched UID result does not hang and fails closed", async () => {
    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "wrong-uid", role: "super_admin" }), // mismatched UID
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);
    triggerEffects();

    await act(async () => {
      await result.triggerRefresh();
    });

    const finalResult = runHook(deps);
    expect(finalResult.shouldShowSpinner).toBe(false);
    expect(finalResult.shouldShowError).toBe(true);
    expect(finalResult.shouldRenderSlot).toBe(false);
  });

  it("Immediate identity-switch spinner", async () => {
    // 1. Verify User A
    const depsA: AdminLayoutControllerDependencies = {
      user: { uid: "user-a", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn().mockResolvedValue({ uid: "user-a", role: "super_admin" }),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };
    const result1 = runHook(depsA);
    triggerEffects();

    await act(async () => {
      await result1.triggerRefresh();
    });
    const verifiedResultA = runHook(depsA);
    expect(verifiedResultA.shouldRenderSlot).toBe(true);

    // 2. Render User B without running effects
    const depsB: AdminLayoutControllerDependencies = {
      user: { uid: "user-b", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn(),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };
    const resultB = runHook(depsB);

    // 3. Assert
    expect(resultB.shouldRenderSlot).toBe(false);
    expect(resultB.shouldShowSpinner).toBe(true);
  });

  it("No render-phase dispatch", () => {
    // 1. Initial render with User A
    const depsA: AdminLayoutControllerDependencies = {
      user: { uid: "user-a", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn(),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };
    runHook(depsA);
    triggerEffects();

    // 2. Switch to User B and render (without running effects)
    const depsB: AdminLayoutControllerDependencies = {
      user: { uid: "user-b", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn(),
      signOut: vi.fn(),
      navigateTo: vi.fn(),
    };

    // Reset spy counter
    dispatchCallCount = 0;
    runHook(depsB);

    // 3. Assert dispatch was not called during render
    expect(dispatchCallCount).toBe(0);
  });

  it("Same-closure duplicate sign-out", async () => {
    let resolveSignOut: () => void = () => {};
    const signOutPromise = new Promise<void>((resolve) => {
      resolveSignOut = resolve;
    });

    const deps: AdminLayoutControllerDependencies = {
      user: { uid: "admin-1", isAnonymous: false },
      loading: false,
      refreshAuthorization: vi.fn(),
      signOut: vi.fn().mockImplementation(() => signOutPromise),
      navigateTo: vi.fn(),
    };

    const result = runHook(deps);

    // Trigger handleSignOut twice from the same closure (without simulated rerender)
    const promise1 = result.handleSignOut();
    const promise2 = result.handleSignOut();

    resolveSignOut();
    await promise1;
    await promise2;

    expect(deps.signOut).toHaveBeenCalledTimes(1);
    expect(deps.navigateTo).toHaveBeenCalledTimes(1);
  });
});
