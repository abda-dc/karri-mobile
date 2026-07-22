import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  setAutoServerRegistrationEnabledAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  platform: { OS: "ios" },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: mocks.getItem,
    removeItem: mocks.removeItem,
    setItem: mocks.setItem,
  },
}));
vi.mock("expo-constants", () => ({
  default: { easConfig: { projectId: "test-project" }, expoConfig: null },
}));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3, LOW: 2 },
  IosAuthorizationStatus: {
    AUTHORIZED: 1,
    DENIED: 0,
    EPHEMERAL: 4,
    NOT_DETERMINED: -1,
    PROVISIONAL: 3,
  },
  PermissionStatus: {
    DENIED: "denied",
    GRANTED: "granted",
    UNDETERMINED: "undetermined",
  },
  getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
  getPermissionsAsync: mocks.getPermissionsAsync,
  requestPermissionsAsync: mocks.requestPermissionsAsync,
  setAutoServerRegistrationEnabledAsync:
    mocks.setAutoServerRegistrationEnabledAsync,
  setNotificationChannelAsync: mocks.setNotificationChannelAsync,
}));
vi.mock("react-native", () => ({ Platform: mocks.platform }));

import {
  ExistingPushInstallationStatus,
  PushRegistrationStatus,
  type PushRegistrationIdentity,
} from "../../../application/services/PushRegistrationService";
import { ExpoPushTokenRegistrationGateway as NativeGateway } from "./ExpoPushTokenRegistrationGateway.native";
import { ExpoPushTokenRegistrationGateway as UnsupportedGateway } from "./ExpoPushTokenRegistrationGateway";

const deviceId = "karri-device-123456789012";
const identity: PushRegistrationIdentity = { deviceId, userId: "user-current" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.OS = "ios";
  mocks.getItem.mockResolvedValue(null);
  mocks.setItem.mockResolvedValue(undefined);
  mocks.removeItem.mockResolvedValue(undefined);
  mocks.setAutoServerRegistrationEnabledAsync.mockResolvedValue(undefined);
});

describe("ExpoPushTokenRegistrationGateway existing installation lookup", () => {
  it("returns an existing valid installation ID", async () => {
    mocks.getItem.mockResolvedValue(deviceId);

    await expect(new NativeGateway().getExistingInstallationId()).resolves.toEqual({
      deviceId,
      status: ExistingPushInstallationStatus.Found,
    });
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(new NativeGateway().unregistrationAvailability).toBe("available");
  });

  it("returns missing without creating or persisting an installation ID", async () => {
    await expect(new NativeGateway().getExistingInstallationId()).resolves.toEqual({
      status: ExistingPushInstallationStatus.Missing,
    });
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(mocks.removeItem).not.toHaveBeenCalled();
  });

  it("fails closed for malformed stored state", async () => {
    mocks.getItem.mockResolvedValue("malformed-installation");

    const result = await new NativeGateway().getExistingInstallationId();
    expect(result.status).toBe(ExistingPushInstallationStatus.Deferred);
    expect(mocks.setItem).not.toHaveBeenCalled();
  });

  it("disables Expo automatic updates without permission or token APIs and retains the ID", async () => {
    mocks.getItem.mockResolvedValue(deviceId);
    const gateway = new NativeGateway();

    await expect(gateway.unregister(identity)).resolves.toEqual({
      status: PushRegistrationStatus.Unregistered,
    });
    await expect(gateway.getExistingInstallationId()).resolves.toEqual({
      deviceId,
      status: ExistingPushInstallationStatus.Found,
    });

    expect(mocks.setAutoServerRegistrationEnabledAsync).toHaveBeenCalledWith(false);
    expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(mocks.removeItem).not.toHaveBeenCalled();
  });

  it("defers when Expo automatic updates cannot be disabled", async () => {
    mocks.setAutoServerRegistrationEnabledAsync.mockRejectedValue(new Error("test failure"));

    const result = await new NativeGateway().unregister(identity);
    expect(result.status).toBe(PushRegistrationStatus.Deferred);
  });

  it("defers safely in the unsupported implementation", async () => {
    const gateway = new UnsupportedGateway();

    expect(gateway.unregistrationAvailability).toBe("deferred");
    expect((await gateway.getExistingInstallationId()).status).toBe(
      ExistingPushInstallationStatus.Deferred,
    );
    expect((await gateway.unregister(identity)).status).toBe(
      PushRegistrationStatus.Deferred,
    );
  });
});
