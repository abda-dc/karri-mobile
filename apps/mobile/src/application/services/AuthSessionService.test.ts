import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthSessionService,
  type AuthSessionGateway,
  type AuthenticatedSession,
  type AuthSessionSignOutCleanup,
} from "./AuthSessionService";

const userSession: AuthenticatedSession = {
  identity: {
    uid: "user-123",
    email: null,
    createdAt: "2026-07-12T12:00:00Z",
    isAnonymous: false,
  },
  authorization: {
    role: "user",
  },
};

const adminSession: AuthenticatedSession = {
  identity: {
    uid: "admin-123",
    email: "admin@karri.com",
    createdAt: "2026-07-12T12:00:00Z",
    isAnonymous: false,
  },
  authorization: {
    role: "super_admin",
  },
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

function createHarness(signOutCleanupTimeoutMs = 3_000) {
  const gateway: AuthSessionGateway = {
    configured: true,
    getCurrentUserId: vi.fn(() => "user-123"),
    refreshAuthorization: vi.fn(),
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
    startMvpSession: vi.fn(),
    subscribe: vi.fn(),
  };

  const cleanup: AuthSessionSignOutCleanup = {
    invalidatePendingOperations: vi.fn(),
    unregisterCurrentInstallation: vi.fn(),
  };

  return {
    cleanup,
    gateway,
    service: new AuthSessionService(
      gateway,
      cleanup,
      signOutCleanupTimeoutMs,
    ),
  };
}

describe("AuthSessionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates configured state", () => {
    const { service } = createHarness();

    expect(service.isConfigured).toBe(true);
  });

  it("captures the current user and cleans up before Firebase sign-out", async () => {
    const { cleanup, gateway, service } = createHarness();
    const order: string[] = [];

    vi.mocked(cleanup.unregisterCurrentInstallation).mockImplementation(
      async (userId) => {
        order.push(`cleanup:${userId}`);
      },
    );
    vi.mocked(gateway.signOut).mockImplementation(async () => {
      order.push("sign-out");
    });

    await service.signOut();

    expect(gateway.getCurrentUserId).toHaveBeenCalledOnce();
    expect(cleanup.unregisterCurrentInstallation).toHaveBeenCalledWith(
      "user-123",
    );
    expect(order).toEqual(["cleanup:user-123", "sign-out"]);
  });

  it("skips push cleanup when there is no authenticated user", async () => {
    const { cleanup, gateway, service } = createHarness();

    vi.mocked(gateway.getCurrentUserId).mockReturnValue(null);
    vi.mocked(gateway.signOut).mockResolvedValue();

    await service.signOut();

    expect(cleanup.unregisterCurrentInstallation).not.toHaveBeenCalled();
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it("continues Firebase sign-out when cleanup rejects", async () => {
    const { cleanup, gateway, service } = createHarness();

    vi.mocked(cleanup.unregisterCurrentInstallation).mockRejectedValue(
      new Error("private cleanup failure"),
    );
    vi.mocked(gateway.signOut).mockResolvedValue();

    await expect(service.signOut()).resolves.toBeUndefined();
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it("continues Firebase sign-out when cleanup throws synchronously", async () => {
    const { cleanup, gateway, service } = createHarness();

    vi.mocked(cleanup.unregisterCurrentInstallation).mockImplementation(
      () => {
        throw new Error("private synchronous cleanup failure");
      },
    );
    vi.mocked(gateway.signOut).mockResolvedValue();

    await expect(service.signOut()).resolves.toBeUndefined();
    expect(gateway.signOut).toHaveBeenCalledWith("user-123");
  });

  it("continues sign-out when cleanup never settles", async () => {
    vi.useFakeTimers();

    const { cleanup, gateway, service } = createHarness(1_000);
    const pendingCleanup = deferred<unknown>();

    vi.mocked(cleanup.unregisterCurrentInstallation).mockReturnValue(
      pendingCleanup.promise,
    );
    vi.mocked(gateway.signOut).mockResolvedValue();

    const operation = service.signOut();

    await Promise.resolve();
    expect(gateway.signOut).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(operation).resolves.toBeUndefined();
    expect(cleanup.invalidatePendingOperations).toHaveBeenCalledOnce();
    expect(gateway.signOut).toHaveBeenCalledWith("user-123");
  });

  it("does not invalidate push operations after completed cleanup", async () => {
    const { cleanup, gateway, service } = createHarness();

    vi.mocked(cleanup.unregisterCurrentInstallation).mockResolvedValue(
      undefined,
    );
    vi.mocked(gateway.signOut).mockResolvedValue();

    await service.signOut();

    expect(cleanup.invalidatePendingOperations).not.toHaveBeenCalled();
  });

  it("coalesces duplicate sign-out requests", async () => {
    const { cleanup, gateway, service } = createHarness();
    const pendingCleanup = deferred<unknown>();

    vi.mocked(cleanup.unregisterCurrentInstallation).mockReturnValue(
      pendingCleanup.promise,
    );
    vi.mocked(gateway.signOut).mockResolvedValue();

    const first = service.signOut();
    const second = service.signOut();

    expect(second).toBe(first);

    await Promise.resolve();
    expect(cleanup.unregisterCurrentInstallation).toHaveBeenCalledOnce();

    pendingCleanup.resolve(undefined);
    await Promise.all([first, second]);

    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it("serializes sign-in behind an active sign-out", async () => {
    const { cleanup, gateway, service } = createHarness();
    const pendingCleanup = deferred<unknown>();

    vi.mocked(cleanup.unregisterCurrentInstallation).mockReturnValue(
      pendingCleanup.promise,
    );
    vi.mocked(gateway.signOut).mockResolvedValue();
    vi.mocked(gateway.signInWithEmail).mockResolvedValue(adminSession);

    const signOutOperation = service.signOut();
    const signInOperation = service.signInWithEmail(
      "admin@karri.com",
      "password123",
    );

    await Promise.resolve();
    expect(gateway.signInWithEmail).not.toHaveBeenCalled();

    pendingCleanup.resolve(undefined);
    await signOutOperation;

    await expect(signInOperation).resolves.toEqual(adminSession);
    expect(gateway.signInWithEmail).toHaveBeenCalledWith(
      "admin@karri.com",
      "password123",
    );
  });

  it("serializes sign-out behind an active MVP session start", async () => {
    const { cleanup, gateway, service } = createHarness();
    const pendingSession = deferred<AuthenticatedSession>();

    vi.mocked(gateway.startMvpSession).mockReturnValue(pendingSession.promise);
    vi.mocked(cleanup.unregisterCurrentInstallation).mockResolvedValue(
      undefined,
    );
    vi.mocked(gateway.signOut).mockResolvedValue();

    const sessionOperation = service.startMvpSession();
    const signOutOperation = service.signOut();

    await Promise.resolve();
    expect(gateway.getCurrentUserId).not.toHaveBeenCalled();

    pendingSession.resolve(userSession);
    await sessionOperation;
    await signOutOperation;

    expect(gateway.getCurrentUserId).toHaveBeenCalledOnce();
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it("clears sign-out coalescing state after Firebase sign-out fails", async () => {
    const { cleanup, gateway, service } = createHarness();

    vi.mocked(cleanup.unregisterCurrentInstallation).mockResolvedValue(
      undefined,
    );
    vi.mocked(gateway.signOut)
      .mockRejectedValueOnce(new Error("sign-out failed"))
      .mockResolvedValueOnce();

    await expect(service.signOut()).rejects.toThrow("sign-out failed");
    await expect(service.signOut()).resolves.toBeUndefined();

    expect(gateway.signOut).toHaveBeenCalledTimes(2);
  });

  it("delegates authorization refresh", async () => {
    const { gateway, service } = createHarness();
    const authorization = {
      uid: "admin-123",
      role: "operations_admin" as const,
    };

    vi.mocked(gateway.refreshAuthorization).mockResolvedValue(authorization);

    await expect(service.refreshAuthorization()).resolves.toEqual(
      authorization,
    );
  });

  it("delegates subscriptions", () => {
    const { gateway, service } = createHarness();
    const onChange = vi.fn();
    const onError = vi.fn();
    const unsubscribe = vi.fn();

    vi.mocked(gateway.subscribe).mockReturnValue(unsubscribe);

    expect(service.subscribe(onChange, onError)).toBe(unsubscribe);
    expect(gateway.subscribe).toHaveBeenCalledWith(onChange, onError);
  });
});
