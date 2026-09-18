import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminOperationsOverview } from "../../domain/admin/AdminOperationsOverview";
import type { AuthorizationRole } from "../../domain/authorization/roles";

let stateValues: unknown[] = [];
let stateIndex = 0;
let refValues: Array<{ current: unknown }> = [];
let refIndex = 0;
let effectSlots: Array<{
  deps: ReadonlyArray<unknown> | undefined;
  cleanup?: () => void;
}> = [];
let effectIndex = 0;
let pendingEffects: Array<() => void> = [];
let harnessUnmounted = false;
let stateUpdatesAfterUnmount = 0;

function dependenciesChanged(
  previous: ReadonlyArray<unknown> | undefined,
  next: ReadonlyArray<unknown> | undefined,
): boolean {
  if (!previous || !next || previous.length !== next.length) {
    return true;
  }
  return previous.some((value, index) => !Object.is(value, next[index]));
}

vi.mock("react", () => ({
  useState: <T>(initial: T | (() => T)) => {
    const index = stateIndex++;
    if (stateValues[index] === undefined) {
      stateValues[index] =
        typeof initial === "function" ? (initial as () => T)() : initial;
    }
    const setter = (value: T | ((current: T) => T)) => {
      if (harnessUnmounted) {
        stateUpdatesAfterUnmount += 1;
      }
      stateValues[index] =
        typeof value === "function"
          ? (value as (current: T) => T)(stateValues[index] as T)
          : value;
    };
    return [stateValues[index] as T, setter] as const;
  },
  useRef: <T>(initial: T) => {
    const index = refIndex++;
    if (!refValues[index]) {
      refValues[index] = { current: initial };
    }
    return refValues[index] as { current: T };
  },
  useEffect: (
    callback: () => void | (() => void),
    deps?: ReadonlyArray<unknown>,
  ) => {
    const index = effectIndex++;
    const previous = effectSlots[index];
    if (!previous || dependenciesChanged(previous.deps, deps)) {
      pendingEffects.push(() => {
        previous?.cleanup?.();
        const cleanup = callback();
        effectSlots[index] = {
          deps,
          cleanup: typeof cleanup === "function" ? cleanup : undefined,
        };
      });
    }
  },
  useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}));

const serviceMocks = vi.hoisted(() => ({
  getOverview: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../services/mobileServices", () => ({
  mobileServices: {
    adminOperations: { getOverview: serviceMocks.getOverview },
    auth: { signOut: serviceMocks.signOut },
  },
}));

const authSessionMock = vi.hoisted(() => vi.fn());

vi.mock("./useAuthSession", () => ({
  useAuthSession: authSessionMock,
}));

vi.mock("expo-router", () => ({
  router: { replace: vi.fn() },
}));

vi.mock("react-native", () => ({
  StyleSheet: { create: <T>(styles: T) => styles },
  Text: "Text",
  View: "View",
  useWindowDimensions: () => ({ width: 1200, height: 800 }),
}));

vi.mock("../../components/Badge", () => ({ Badge: "Badge" }));
vi.mock("../../components/Banner", () => ({ Banner: "Banner" }));
vi.mock("../../components/Card", () => ({ Card: "Card" }));
vi.mock("../../components/EmptyState", () => ({ EmptyState: "EmptyState" }));
vi.mock("../../components/LoadingState", () => ({ LoadingState: "LoadingState" }));
vi.mock("../../components/PrimaryButton", () => ({ PrimaryButton: "PrimaryButton" }));
vi.mock("../../components/Screen", () => ({ Screen: "Screen" }));
vi.mock("../../components/SectionHeader", () => ({ SectionHeader: "SectionHeader" }));
vi.mock("../../components/StatusChip", () => ({ StatusChip: "StatusChip" }));

import {
  getAdministratorIdentityLabel,
  useAdminOperationsOverview,
  type UseAdminOperationsOverviewOptions,
} from "./useAdminOperationsOverview";
import AdminOperationsOverviewScreen, {
  getSummaryValueLabel,
  shortReference,
} from "../../../app/(admin)/index";

function available<T>(value: T) {
  return { status: "available" as const, value };
}

const unauthorized = {
  status: "unauthorized" as const,
  reason: "insufficient-role" as const,
};
const unavailable = {
  status: "unavailable" as const,
  reason: "query-failed" as const,
};

function overview(
  overrides: Partial<AdminOperationsOverview> = {},
): AdminOperationsOverview {
  return {
    activeShipments: available(4),
    activeTrips: available(3),
    pendingBookingRequests: available(2),
    activeBookings: available(1),
    recentShipmentSafetyReviews: available([]),
    activeAdministrativeHolds: available([]),
    recentBookings: available([]),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function resetHarness() {
  stateValues = [];
  stateIndex = 0;
  refValues = [];
  refIndex = 0;
  effectSlots = [];
  effectIndex = 0;
  pendingEffects = [];
  harnessUnmounted = false;
  stateUpdatesAfterUnmount = 0;
}

function renderHook(options: UseAdminOperationsOverviewOptions) {
  stateIndex = 0;
  refIndex = 0;
  effectIndex = 0;
  pendingEffects = [];
  return useAdminOperationsOverview(options);
}

function flushEffects() {
  const effects = [...pendingEffects];
  pendingEffects = [];
  for (const effect of effects) {
    effect();
  }
}

function unmountHook() {
  harnessUnmounted = true;
  for (const slot of effectSlots) {
    slot?.cleanup?.();
  }
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

function options(
  loadOverview: (role: AuthorizationRole) => Promise<AdminOperationsOverview>,
  overrides: Partial<UseAdminOperationsOverviewOptions> = {},
): UseAdminOperationsOverviewOptions {
  return {
    authorizationRole: "super_admin",
    identityKey: "private-admin-uid",
    loadOverview,
    ...overrides,
  };
}

describe("useAdminOperationsOverview", () => {
  beforeEach(() => {
    resetHarness();
    vi.clearAllMocks();
    serviceMocks.getOverview.mockResolvedValue(overview());
    serviceMocks.signOut.mockResolvedValue(undefined);
  });

  it("starts in loading state and passes the current role to the repository", async () => {
    const pending = deferred<AdminOperationsOverview>();
    const loadOverview = vi.fn(() => pending.promise);
    const hookOptions = options(loadOverview, {
      authorizationRole: "operations_admin",
    });

    const initial = renderHook(hookOptions);
    expect(initial.loading).toBe(true);
    expect(initial.overview).toBeNull();

    flushEffects();
    expect(loadOverview).toHaveBeenCalledOnce();
    expect(loadOverview).toHaveBeenCalledWith("operations_admin");

    pending.resolve(overview());
    await pending.promise;
    await settle();
  });

  it("loads a successful super_admin overview", async () => {
    const expected = overview();
    const loadOverview = vi.fn().mockResolvedValue(expected);
    const hookOptions = options(loadOverview);

    renderHook(hookOptions);
    flushEffects();
    await settle();

    const result = renderHook(hookOptions);
    expect(result.loading).toBe(false);
    expect(result.error).toBeNull();
    expect(result.overview).toBe(expected);
  });

  it("uses mobileServices.adminOperations by default", async () => {
    const hookOptions: UseAdminOperationsOverviewOptions = {
      authorizationRole: "safety_admin",
      identityKey: "private-admin-uid",
    };

    renderHook(hookOptions);
    flushEffects();
    await settle();

    expect(serviceMocks.getOverview).toHaveBeenCalledOnce();
    expect(serviceMocks.getOverview).toHaveBeenCalledWith("safety_admin");
  });

  it("preserves independent partial section failures", async () => {
    const expected = overview({ activeTrips: unavailable });
    const hookOptions = options(vi.fn().mockResolvedValue(expected));

    renderHook(hookOptions);
    flushEffects();
    await settle();

    const result = renderHook(hookOptions);
    expect(result.overview?.activeShipments).toEqual(available(4));
    expect(result.overview?.activeTrips).toEqual(unavailable);
    expect(result.error).toBeNull();
  });

  it("preserves a complete section failure for the dashboard state", async () => {
    const expected = overview({
      activeShipments: unavailable,
      activeTrips: unavailable,
      pendingBookingRequests: unavailable,
      activeBookings: unavailable,
      recentShipmentSafetyReviews: unavailable,
      activeAdministrativeHolds: unavailable,
      recentBookings: unavailable,
    });
    const hookOptions = options(vi.fn().mockResolvedValue(expected));

    renderHook(hookOptions);
    flushEffects();
    await settle();

    const result = renderHook(hookOptions);
    expect(
      Object.values(result.overview ?? {}).every(
        (section) => section.status === "unavailable",
      ),
    ).toBe(true);
  });

  it("retries after a safe top-level failure", async () => {
    const loadOverview = vi
      .fn()
      .mockRejectedValueOnce(new Error("private first failure"))
      .mockResolvedValueOnce(overview());
    const hookOptions = options(loadOverview);

    renderHook(hookOptions);
    flushEffects();
    await settle();

    const failed = renderHook(hookOptions);
    expect(failed.error).toBe(
      "Operations data could not be loaded. Please check your connection and try again.",
    );

    await failed.reload();
    const retried = renderHook(hookOptions);
    expect(retried.overview?.activeShipments).toEqual(available(4));
    expect(retried.error).toBeNull();
    expect(loadOverview).toHaveBeenCalledTimes(2);
  });

  it("suppresses stale responses after role or identity changes", async () => {
    const first = deferred<AdminOperationsOverview>();
    const second = deferred<AdminOperationsOverview>();
    const loadOverview = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const firstOptions = options(loadOverview, {
      authorizationRole: "operations_admin",
      identityKey: "admin-a",
    });
    const secondOptions = options(loadOverview, {
      authorizationRole: "safety_admin",
      identityKey: "admin-b",
    });

    renderHook(firstOptions);
    flushEffects();
    renderHook(secondOptions);
    flushEffects();

    first.resolve(overview({ activeTrips: available(99) }));
    await first.promise;
    await settle();
    const beforeSecondCompletes = renderHook(secondOptions);
    expect(beforeSecondCompletes.overview).toBeNull();
    expect(beforeSecondCompletes.loading).toBe(true);

    const currentOverview = overview({ activeShipments: available(8) });
    second.resolve(currentOverview);
    await second.promise;
    await settle();
    expect(renderHook(secondOptions).overview).toBe(currentOverview);
    expect(loadOverview).toHaveBeenNthCalledWith(1, "operations_admin");
    expect(loadOverview).toHaveBeenNthCalledWith(2, "safety_admin");
  });

  it("does not update state after unmount", async () => {
    const pending = deferred<AdminOperationsOverview>();
    const hookOptions = options(vi.fn(() => pending.promise));

    renderHook(hookOptions);
    flushEffects();
    unmountHook();
    pending.resolve(overview());
    await pending.promise;
    await settle();

    expect(stateUpdatesAfterUnmount).toBe(0);
  });

  it("never exposes a raw load error", async () => {
    const privateMarker = "raw-firebase-private-marker";
    const hookOptions = options(
      vi.fn().mockRejectedValue(new Error(privateMarker)),
    );

    renderHook(hookOptions);
    flushEffects();
    await settle();

    const result = renderHook(hookOptions);
    expect(result.error).not.toContain(privateMarker);
    expect(JSON.stringify(result)).not.toContain(privateMarker);
  });

  it("deduplicates concurrent reload attempts", async () => {
    const pending = deferred<AdminOperationsOverview>();
    const loadOverview = vi.fn(() => pending.promise);
    const hookOptions = options(loadOverview);

    const initial = renderHook(hookOptions);
    flushEffects();
    const firstReload = initial.reload();
    const secondReload = initial.reload();

    expect(loadOverview).toHaveBeenCalledOnce();
    pending.resolve(overview());
    await Promise.all([firstReload, secondReload]);
  });

  it("deduplicates sign-out and navigates only once", async () => {
    const pendingSignOut = deferred<void>();
    const signOut = vi.fn(() => pendingSignOut.promise);
    const onSignedOut = vi.fn();
    const hookOptions = options(vi.fn().mockResolvedValue(overview()), {
      signOut,
      onSignedOut,
    });

    const initial = renderHook(hookOptions);
    flushEffects();
    const firstSignOut = initial.handleSignOut();
    const secondSignOut = initial.handleSignOut();
    expect(renderHook(hookOptions).signingOut).toBe(true);
    expect(signOut).toHaveBeenCalledOnce();

    pendingSignOut.resolve();
    await Promise.all([firstSignOut, secondSignOut]);
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it("returns a safe sign-out failure without raw error details", async () => {
    const privateMarker = "private-sign-out-error";
    const hookOptions = options(vi.fn().mockResolvedValue(overview()), {
      signOut: vi.fn().mockRejectedValue(new Error(privateMarker)),
      onSignedOut: vi.fn(),
    });

    const initial = renderHook(hookOptions);
    flushEffects();
    await initial.handleSignOut();

    const result = renderHook(hookOptions);
    expect(result.signOutError).toBe(
      "Sign out failed. Please check your connection and try again.",
    );
    expect(JSON.stringify(result)).not.toContain(privateMarker);
  });
});

describe("Operations Overview display safety", () => {
  beforeEach(() => {
    resetHarness();
    vi.clearAllMocks();
    serviceMocks.getOverview.mockResolvedValue(overview());
    serviceMocks.signOut.mockResolvedValue(undefined);
    authSessionMock.mockReturnValue({
      user: {
        uid: "raw-private-firebase-uid",
        email: "admin@example.com",
        createdAt: null,
        isAnonymous: false,
      },
      authorizationRole: "super_admin",
    });
  });

  it("renders the authenticated email but never the raw UID", () => {
    const tree = AdminOperationsOverviewScreen();
    const serialized = JSON.stringify(tree);
    const identityWithoutEmail = {
      uid: "raw-private-firebase-uid",
      email: null,
    };

    expect(serialized).toContain("Operations Overview");
    expect(serialized).toContain("admin@example.com");
    expect(serialized).not.toContain("raw-private-firebase-uid");
    expect(getAdministratorIdentityLabel(identityWithoutEmail)).toBe(
      "Authenticated administrator",
    );
  });

  it("does not represent unauthorized counts as zero", () => {
    expect(getSummaryValueLabel(unauthorized)).toBe("Restricted");
    expect(getSummaryValueLabel(unauthorized)).not.toBe("0");
    expect(getSummaryValueLabel(unavailable)).toBe("Unavailable");
  });

  it("always shortens operational identifiers", () => {
    expect(shortReference("shipment-primary-123456")).toBe("…123456");
    expect(shortReference("abc")).toBe("…bc");
    expect(shortReference("shipment-primary-123456")).not.toContain(
      "shipment-primary",
    );
  });
});
