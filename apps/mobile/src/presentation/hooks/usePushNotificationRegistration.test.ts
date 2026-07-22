import { beforeEach, describe, expect, it, vi } from "vitest";

const hookRuntime = vi.hoisted(() => {
  let stateValues: unknown[] = [];
  let refValues: Array<{ current: unknown }> = [];
  let effectDependencies: Array<ReadonlyArray<unknown> | undefined> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;

  const sameDependencies = (
    left: ReadonlyArray<unknown> | undefined,
    right: ReadonlyArray<unknown> | undefined,
  ) => Boolean(
    left && right && left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index])),
  );

  return {
    reset() {
      stateValues = [];
      refValues = [];
      effectDependencies = [];
    },
    startRender() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    useCallback<T>(callback: T): T {
      return callback;
    },
    useEffect(effect: () => void, dependencies?: ReadonlyArray<unknown>) {
      const index = effectIndex++;
      if (!sameDependencies(effectDependencies[index], dependencies)) {
        effectDependencies[index] = dependencies;
        effect();
      }
    },
    useRef<T>(initialValue: T): { current: T } {
      const index = refIndex++;
      if (!refValues[index]) {
        refValues[index] = { current: initialValue };
      }
      return refValues[index] as { current: T };
    },
    useState<T>(initialValue: T): [T, (value: T | ((current: T) => T)) => void] {
      const index = stateIndex++;
      if (!(index in stateValues)) {
        stateValues[index] = initialValue;
      }
      return [
        stateValues[index] as T,
        (value) => {
          stateValues[index] = typeof value === "function"
            ? (value as (current: T) => T)(stateValues[index] as T)
            : value;
        },
      ];
    },
  };
});

const pushRegistration = vi.hoisted(() => ({
  availability: "available",
  unregistrationAvailability: "available",
  getPermissionStatus: vi.fn(async () => "granted"),
  register: vi.fn(),
  unregisterCurrentInstallation: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));
vi.mock("../services/mobileServices", () => ({
  mobileServices: { pushRegistration },
}));

import { PushRegistrationStatus } from "../../application/services/PushRegistrationService";
import { usePushNotificationRegistration } from "./usePushNotificationRegistration";

const userId = "user-current";
const preferences = (push: boolean) => ({
  channels: { push },
}) as never;

function render(currentUserId: string | null, pushEnabled: boolean) {
  hookRuntime.startRender();
  return usePushNotificationRegistration(currentUserId, preferences(pushEnabled));
}

function deferredResult<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  hookRuntime.reset();
  vi.clearAllMocks();
  pushRegistration.availability = "available";
  pushRegistration.unregistrationAvailability = "available";
  pushRegistration.getPermissionStatus.mockResolvedValue("granted");
  pushRegistration.register.mockResolvedValue({ status: PushRegistrationStatus.Deferred, reason: "test" });
  pushRegistration.unregisterCurrentInstallation.mockResolvedValue({
    status: PushRegistrationStatus.Unregistered,
  });
});

describe("usePushNotificationRegistration manual unregistration", () => {
  it("coalesces duplicate unregistration presses into one operation", async () => {
    const pending = deferredResult<{ status: "unregistered" }>();
    pushRegistration.unregisterCurrentInstallation.mockReturnValue(pending.promise);
    const registration = render(userId, false);

    const first = registration.unregister();
    await registration.unregister();

    expect(pushRegistration.unregisterCurrentInstallation).toHaveBeenCalledTimes(1);
    pending.resolve({ status: PushRegistrationStatus.Unregistered });
    await first;
  });

  it("does not allow registration and unregistration to overlap", async () => {
    const pending = deferredResult<{ status: "deferred"; reason: string }>();
    pushRegistration.register.mockReturnValue(pending.promise);
    const registration = render(userId, true);

    const first = registration.register();
    await registration.unregister();

    expect(pushRegistration.register).toHaveBeenCalledTimes(1);
    expect(pushRegistration.unregisterCurrentInstallation).not.toHaveBeenCalled();
    pending.resolve({ status: PushRegistrationStatus.Deferred, reason: "test" });
    await first;
  });

  it("coalesces duplicate registration presses into one operation", async () => {
    const pending = deferredResult<{ status: "deferred"; reason: string }>();
    pushRegistration.register.mockReturnValue(pending.promise);
    const registration = render(userId, true);

    const first = registration.register();
    await registration.register();

    expect(pushRegistration.register).toHaveBeenCalledTimes(1);
    pending.resolve({ status: PushRegistrationStatus.Deferred, reason: "test" });
    await first;
  });

  it("blocks registration while unregistration is running", async () => {
    const pending = deferredResult<{ status: "unregistered" }>();
    pushRegistration.unregisterCurrentInstallation.mockReturnValue(pending.promise);
    const registration = render(userId, true);

    const first = registration.unregister();
    await registration.register();

    expect(pushRegistration.unregisterCurrentInstallation).toHaveBeenCalledTimes(1);
    expect(pushRegistration.register).not.toHaveBeenCalled();
    pending.resolve({ status: PushRegistrationStatus.Unregistered });
    await first;
  });

  it("keeps unregistration locked across a user change until its promise settles", async () => {
    const pending = deferredResult<{ status: "unregistered" }>();
    pushRegistration.unregisterCurrentInstallation.mockReturnValue(pending.promise);
    const firstUser = render(userId, false);

    const operation = firstUser.unregister();
    const nextUserWhilePending = render("user-next", true);

    expect(nextUserWhilePending.busy).toBe(true);
    expect(nextUserWhilePending.activeOperation).toBe("unregister");
    await nextUserWhilePending.register();
    await nextUserWhilePending.unregister();
    expect(pushRegistration.register).not.toHaveBeenCalled();
    expect(pushRegistration.unregisterCurrentInstallation).toHaveBeenCalledTimes(1);

    pending.resolve({ status: PushRegistrationStatus.Unregistered });
    await operation;

    const nextUser = render("user-next", false);
    expect(nextUser.busy).toBe(false);
    expect(nextUser.activeOperation).toBeNull();
    expect(nextUser.message).toBeNull();
    expect(nextUser.outcome).toBe("idle");

    await nextUser.unregister();
    expect(pushRegistration.unregisterCurrentInstallation).toHaveBeenCalledTimes(2);
    expect(pushRegistration.unregisterCurrentInstallation).toHaveBeenLastCalledWith(
      "user-next",
    );
  });

  it("keeps registration locked across a user change until its promise settles", async () => {
    const pending = deferredResult<{ status: "deferred"; reason: string }>();
    pushRegistration.register.mockReturnValue(pending.promise);
    const firstUser = render(userId, true);

    const operation = firstUser.register();
    const nextUserWhilePending = render("user-next", false);

    expect(nextUserWhilePending.busy).toBe(true);
    expect(nextUserWhilePending.activeOperation).toBe("register");
    await nextUserWhilePending.unregister();
    expect(pushRegistration.register).toHaveBeenCalledTimes(1);
    expect(pushRegistration.unregisterCurrentInstallation).not.toHaveBeenCalled();

    pending.resolve({ status: PushRegistrationStatus.Deferred, reason: "stale" });
    await operation;

    const nextUser = render("user-next", false);
    expect(nextUser.busy).toBe(false);
    expect(nextUser.activeOperation).toBeNull();
    expect(nextUser.message).toBeNull();
    expect(nextUser.outcome).toBe("idle");
    expect(nextUser.permissionStatus).toBeNull();

    await nextUser.unregister();
    expect(pushRegistration.unregisterCurrentInstallation).toHaveBeenCalledOnce();
    expect(pushRegistration.unregisterCurrentInstallation).toHaveBeenCalledWith(
      "user-next",
    );
  });

  it("does not require the Push preference and maps success safely", async () => {
    const registration = render(userId, false);

    await registration.unregister();
    const result = render(userId, false);

    expect(pushRegistration.unregisterCurrentInstallation).toHaveBeenCalledWith(userId);
    expect(result.outcome).toBe("success");
    expect(result.message).toBe(
      "This installation is no longer registered for remote push delivery.",
    );
  });

  it("maps a deferred result to a non-secret warning", async () => {
    pushRegistration.unregisterCurrentInstallation.mockResolvedValue({
      reason: "internal detail",
      status: PushRegistrationStatus.Deferred,
    });
    const registration = render(userId, false);

    await registration.unregister();
    const result = render(userId, false);

    expect(result.outcome).toBe("warning");
    expect(result.message).toBe(
      "This installation could not be unregistered safely. Try again from a supported build.",
    );
    expect(result.message).not.toContain("internal detail");
  });
});
