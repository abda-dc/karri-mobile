import { describe, expect, it, vi } from "vitest";
import { NotificationPermissionStatus } from "../notifications/NotificationPermission";
import type { PushToken } from "../notifications/PushToken";
import {
  ExistingPushInstallationStatus,
  PushRegistrationAvailability,
  PushRegistrationService,
  PushRegistrationStatus,
  PushTokenPersistenceStatus,
  type PushRegistrationIdentity,
  type PushTokenRegistrationGateway,
  type PushTokenRepository,
} from "./PushRegistrationService";

const userId = "user-current";
const deviceId = "karri-device-123456789012";
const identity: PushRegistrationIdentity = { deviceId, userId };
const registrationToken: PushToken = {
  deviceId,
  platform: "ios",
  provider: "expo",
  registeredAt: "2026-07-22T12:00:00.000Z",
  userId,
  value: "opaque-registration-test-value",
};

function createHarness(
  gatewayOverrides: Partial<PushTokenRegistrationGateway> = {},
  repositoryOverrides: Partial<PushTokenRepository> = {},
) {
  const gateway: PushTokenRegistrationGateway = {
    availability: PushRegistrationAvailability.Available,
    unregistrationAvailability: PushRegistrationAvailability.Available,
    getExistingInstallationId: vi.fn(async () => ({
      deviceId,
      status: ExistingPushInstallationStatus.Found,
    })),
    getPermissionStatus: vi.fn(async () => NotificationPermissionStatus.Granted),
    register: vi.fn(async () => ({
      status: PushRegistrationStatus.Registered,
      token: registrationToken,
    })),
    unregister: vi.fn(async () => ({ status: PushRegistrationStatus.Unregistered })),
    ...gatewayOverrides,
  };
  const repository: PushTokenRepository = {
    remove: vi.fn(async () => ({ status: PushTokenPersistenceStatus.Removed })),
    save: vi.fn(async () => ({ status: PushTokenPersistenceStatus.Stored })),
    ...repositoryOverrides,
  };
  return {
    gateway,
    repository,
    service: new PushRegistrationService(gateway, repository),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe("PushRegistrationService", () => {
  it("unregisters an existing installation with only the validated identity", async () => {
    const { gateway, repository, service } = createHarness();

    await expect(service.unregisterCurrentInstallation(userId)).resolves.toEqual({
      status: PushRegistrationStatus.Unregistered,
    });

    expect(gateway.unregister).toHaveBeenCalledWith(identity);
    expect(repository.remove).toHaveBeenCalledWith(identity);
    expect(Object.keys(vi.mocked(repository.remove).mock.calls[0][0]).sort()).toEqual([
      "deviceId",
      "userId",
    ]);
  });

  it("treats a missing installation ID as an idempotent successful no-op", async () => {
    const { gateway, repository, service } = createHarness({
      getExistingInstallationId: vi.fn(async () => ({
        status: ExistingPushInstallationStatus.Missing,
      })),
    });

    await expect(service.unregisterCurrentInstallation(userId)).resolves.toEqual({
      status: PushRegistrationStatus.Unregistered,
    });
    expect(gateway.unregister).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("fails closed for a malformed stored installation ID", async () => {
    const { gateway, repository, service } = createHarness({
      getExistingInstallationId: vi.fn(async () => ({
        deviceId: "malformed",
        status: ExistingPushInstallationStatus.Found,
      })),
    });

    await expect(service.unregisterCurrentInstallation(userId)).resolves.toEqual({
      reason: "The stored installation identity is invalid.",
      status: PushRegistrationStatus.Deferred,
    });
    expect(gateway.unregister).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it.each(["", " user-current", "user-current "])(
    "rejects an invalid active user before gateway or repository calls",
    async (invalidUserId) => {
      const { gateway, repository, service } = createHarness();

      await expect(service.unregisterCurrentInstallation(invalidUserId)).rejects.toThrow();
      expect(gateway.getExistingInstallationId).not.toHaveBeenCalled();
      expect(gateway.unregister).not.toHaveBeenCalled();
      expect(repository.remove).not.toHaveBeenCalled();
    },
  );

  it("does not call the repository when installation lookup is deferred", async () => {
    const { gateway, repository, service } = createHarness({
      getExistingInstallationId: vi.fn(async () => ({
        reason: "Installation identity is unavailable.",
        status: ExistingPushInstallationStatus.Deferred,
      })),
    });

    expect(await service.unregisterCurrentInstallation(userId)).toEqual({
      reason: "Installation identity is unavailable.",
      status: PushRegistrationStatus.Deferred,
    });
    expect(gateway.unregister).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("converts an installation lookup failure to a safe deferred result", async () => {
    const { gateway, repository, service } = createHarness({
      getExistingInstallationId: vi.fn(async () => {
        throw new Error("private storage failure");
      }),
    });

    expect(await service.unregisterCurrentInstallation(userId)).toEqual({
      reason: "The stored installation identity could not be read safely.",
      status: PushRegistrationStatus.Deferred,
    });
    expect(gateway.unregister).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("does not call the repository when the native gateway cannot disable automatic updates", async () => {
    const { repository, service } = createHarness({
      unregister: vi.fn(async () => ({
        reason: "Automatic updates could not be disabled safely.",
        status: PushRegistrationStatus.Deferred,
      })),
    });

    expect(await service.unregisterCurrentInstallation(userId)).toEqual({
      reason: "Automatic updates could not be disabled safely.",
      status: PushRegistrationStatus.Deferred,
    });
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("converts a native gateway failure to a safe deferred result", async () => {
    const { repository, service } = createHarness({
      unregister: vi.fn(async () => {
        throw new Error("private native failure");
      }),
    });

    expect(await service.unregisterCurrentInstallation(userId)).toEqual({
      reason: "Device unregistration could not be prepared safely.",
      status: PushRegistrationStatus.Deferred,
    });
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("requires confirmed repository removal before reporting success", async () => {
    const { service } = createHarness({}, {
      remove: vi.fn(async () => ({
        reason: "Trusted removal was not confirmed.",
        status: PushTokenPersistenceStatus.Deferred,
      })),
    });

    expect(await service.unregisterCurrentInstallation(userId)).toEqual({
      reason: "Trusted removal was not confirmed.",
      status: PushRegistrationStatus.Deferred,
    });
  });

  it("keeps registration behavior unchanged", async () => {
    const { gateway, repository, service } = createHarness();

    expect(await service.register(userId)).toEqual({
      status: PushRegistrationStatus.Registered,
      token: registrationToken,
    });
    expect(gateway.register).toHaveBeenCalledWith(userId);
    expect(repository.save).toHaveBeenCalledWith(registrationToken);
  });

  it("allows repeated explicit unregistration while retaining the same identity", async () => {
    const { gateway, repository, service } = createHarness();

    await expect(service.unregisterCurrentInstallation(userId)).resolves.toEqual({
      status: PushRegistrationStatus.Unregistered,
    });
    await expect(service.unregisterCurrentInstallation(userId)).resolves.toEqual({
      status: PushRegistrationStatus.Unregistered,
    });

    expect(gateway.getExistingInstallationId).toHaveBeenCalledTimes(2);
    expect(gateway.unregister).toHaveBeenCalledTimes(2);
    expect(repository.remove).toHaveBeenCalledTimes(2);
  });

  it("serializes unregistration behind an active registration", async () => {
    const pendingRegistration = deferred<{
      status: "registered";
      token: PushToken;
    }>();

    const { gateway, service } = createHarness({
      register: vi.fn(() => pendingRegistration.promise),
    });

    const registration = service.register(userId);
    const unregistration =
      service.unregisterCurrentInstallation(userId);

    await vi.waitFor(() => {
      expect(gateway.register).toHaveBeenCalledOnce();
    });

    expect(gateway.getExistingInstallationId).not.toHaveBeenCalled();

    pendingRegistration.resolve({
      status: PushRegistrationStatus.Registered,
      token: registrationToken,
    });

    await registration;
    await unregistration;

    expect(gateway.getExistingInstallationId).toHaveBeenCalledOnce();
  });

  it("invalidates an abandoned operation and releases the queue", async () => {
    const pendingRegistration = deferred<{
      status: "registered";
      token: PushToken;
    }>();

    const { gateway, repository, service } = createHarness({
      getExistingInstallationId: vi.fn(async () => ({
        status: ExistingPushInstallationStatus.Missing,
      })),
      register: vi.fn(() => pendingRegistration.promise),
    });

    const staleRegistration = service.register(userId);

    await vi.waitFor(() => {
      expect(gateway.register).toHaveBeenCalledOnce();
    });

    service.invalidatePendingOperations();

    await expect(
      service.unregisterCurrentInstallation("user-next"),
    ).resolves.toEqual({
      status: PushRegistrationStatus.Unregistered,
    });

    pendingRegistration.resolve({
      status: PushRegistrationStatus.Registered,
      token: registrationToken,
    });

    await expect(staleRegistration).resolves.toEqual({
      reason: "The push operation was superseded by sign-out.",
      status: PushRegistrationStatus.Deferred,
    });

    expect(repository.save).not.toHaveBeenCalled();
  });

  it("serializes registration behind an active unregistration", async () => {
    const pendingUnregistration = deferred<{
      status: "unregistered";
    }>();

    const { gateway, service } = createHarness({
      unregister: vi.fn(() => pendingUnregistration.promise),
    });

    const unregistration =
      service.unregisterCurrentInstallation(userId);
    const registration = service.register(userId);

    await vi.waitFor(() => {
      expect(gateway.unregister).toHaveBeenCalledOnce();
    });

    expect(gateway.register).not.toHaveBeenCalled();

    pendingUnregistration.resolve({
      status: PushRegistrationStatus.Unregistered,
    });

    await unregistration;
    await registration;

    expect(gateway.register).toHaveBeenCalledOnce();
  });
});
