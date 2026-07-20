import { vi } from "vitest";

// Mock react-native globally to prevent Rolldown parse crash
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import { describe, expect, it } from "vitest";
import {
  PushTokenPersistenceStatus,
} from "../../../application/services/PushRegistrationService";
import { FirebasePushTokenRepository, type PushTokenTransport } from "./FirebasePushTokenRepository";
import type { PushToken } from "../../../application/notifications/PushToken";

const deviceId = "karri-device-123456789012";
const userId = "user-abc";
const tokenVal = "ExpoPushToken[val123]";
const registeredAt = "2026-07-20T10:00:00.000Z";

const validToken: PushToken = {
  deviceId,
  platform: "ios",
  provider: "expo",
  userId,
  value: tokenVal,
  registeredAt,
};

function createHarness(transportOverrides: Partial<PushTokenTransport> = {}) {
  const registerPushToken = vi.fn(async () => ({
    success: true,
    deviceId,
    status: "registered" as const,
    alreadyExisted: false,
  })) as any;
  const unregisterPushToken = vi.fn(async () => ({
    success: true,
    deviceId,
    status: "unregistered" as const,
    alreadyInactive: false,
  })) as any;
  const transport: PushTokenTransport = {
    registerPushToken,
    unregisterPushToken,
    ...transportOverrides,
  };
  const repository = new FirebasePushTokenRepository(transport);
  return { registerPushToken, unregisterPushToken, repository };
}

describe("FirebasePushTokenRepository", () => {
  describe("save", () => {
    it("maps the domain token to the exact backend payload and returns Stored on success", async () => {
      const { repository, registerPushToken } = createHarness();

      const result = await repository.save(validToken);
      expect(result).toEqual({ status: PushTokenPersistenceStatus.Stored });

      expect(registerPushToken).toHaveBeenCalledTimes(1);
      expect(registerPushToken).toHaveBeenCalledWith({
        deviceId,
        platform: "ios",
        provider: "expo",
        token: tokenVal,
        registeredAt,
      });
      const callArgs = registerPushToken.mock.calls[0][0];
      expect(Object.keys(callArgs).sort()).toEqual([
        "deviceId",
        "platform",
        "provider",
        "registeredAt",
        "token",
      ]);
      expect(callArgs.userId).toBeUndefined();
    });

    it("returns Stored even if registration already existed (repeat registration)", async () => {
      const { repository } = createHarness({
        registerPushToken: async () => ({
          success: true,
          deviceId,
          status: "registered",
          alreadyExisted: true,
        }),
      });

      const result = await repository.save(validToken);
      expect(result).toEqual({ status: PushTokenPersistenceStatus.Stored });
    });

    it("returns Deferred with safe reason if invalid token shape without calling transport", async () => {
      const { repository, registerPushToken } = createHarness();
      const invalidToken = { ...validToken, value: "" };

      const result = (await repository.save(invalidToken)) as any;
      expect(result.status).toBe(PushTokenPersistenceStatus.Deferred);
      expect(result.reason).toContain("Invalid push token details");
      expect(result.reason).not.toContain(tokenVal);
      expect(registerPushToken).not.toHaveBeenCalled();
    });

    it("returns Deferred with safe reason on unsupported platform without calling transport", async () => {
      const { repository, registerPushToken } = createHarness();
      const token = { ...validToken, platform: "web" as any };

      const result = (await repository.save(token)) as any;
      expect(result.status).toBe(PushTokenPersistenceStatus.Deferred);
      expect(result.reason).toContain("Unsupported provider or platform");
      expect(result.reason).not.toContain(tokenVal);
      expect(registerPushToken).not.toHaveBeenCalled();
    });

    it("returns Deferred with safe reason on unsupported provider without calling transport", async () => {
      const { repository, registerPushToken } = createHarness();
      const token = { ...validToken, provider: "apns" as any };

      const result = (await repository.save(token)) as any;
      expect(result.status).toBe(PushTokenPersistenceStatus.Deferred);
      expect(result.reason).toContain("Unsupported provider or platform");
      expect(result.reason).not.toContain(tokenVal);
      expect(registerPushToken).not.toHaveBeenCalled();
    });

    it("returns Deferred with safe reason and never leaks token on transport failure", async () => {
      const { repository } = createHarness({
        registerPushToken: async () => {
          throw new Error(`Connection failed for token: ${tokenVal}`);
        },
      });

      const result = (await repository.save(validToken)) as any;
      expect(result.status).toBe(PushTokenPersistenceStatus.Deferred);
      expect(result.reason).toContain("persistence could not be completed");
      expect(result.reason).not.toContain(tokenVal);
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["string", "invalid"],
      ["array", []],
      ["empty object", {}],
      ["missing success", { deviceId, status: "registered", alreadyExisted: false }],
      ["success false", { success: false, deviceId, status: "registered", alreadyExisted: false }],
      ["success wrong type", { success: "true", deviceId, status: "registered", alreadyExisted: false }],
      ["missing deviceId", { success: true, status: "registered", alreadyExisted: false }],
      ["deviceId wrong type", { success: true, deviceId: 123, status: "registered", alreadyExisted: false }],
      ["mismatched deviceId", { success: true, deviceId: "mismatched-device", status: "registered", alreadyExisted: false }],
      ["missing status", { success: true, deviceId, alreadyExisted: false }],
      ["incorrect status", { success: true, deviceId, status: "unregistered", alreadyExisted: false }],
      ["status wrong type", { success: true, deviceId, status: 123, alreadyExisted: false }],
      ["missing alreadyExisted", { success: true, deviceId, status: "registered" }],
      ["alreadyExisted wrong type", { success: true, deviceId, status: "registered", alreadyExisted: "false" }],
    ])("returns exact Deferred result for malformed save response (%s)", async (_label, responseBody) => {
      const { repository } = createHarness({
        registerPushToken: async () => responseBody as any,
      });

      const result = await repository.save(validToken);
      expect(result).toEqual({
        status: PushTokenPersistenceStatus.Deferred,
        reason: "Push-token registration returned an invalid response.",
      });
    });
  });

  describe("remove", () => {
    it("sends only deviceId and returns Removed on success", async () => {
      const { repository, unregisterPushToken } = createHarness();

      const result = await repository.remove(validToken);
      expect(result).toEqual({ status: PushTokenPersistenceStatus.Removed });

      expect(unregisterPushToken).toHaveBeenCalledTimes(1);
      expect(unregisterPushToken).toHaveBeenCalledWith({ deviceId });

      const callArgs = unregisterPushToken.mock.calls[0][0];
      expect(Object.keys(callArgs)).toEqual(["deviceId"]);
      expect(callArgs.token).toBeUndefined();
      expect(callArgs.userId).toBeUndefined();
    });

    it("returns Removed even if device was already inactive", async () => {
      const { repository } = createHarness({
        unregisterPushToken: async () => ({
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: true,
        }),
      });

      const result = await repository.remove(validToken);
      expect(result).toEqual({ status: PushTokenPersistenceStatus.Removed });
    });

    it("returns Deferred with safe reason if invalid token shape without calling transport", async () => {
      const { repository, unregisterPushToken } = createHarness();
      const invalidToken = { ...validToken, deviceId: "" };

      const result = (await repository.remove(invalidToken)) as any;
      expect(result.status).toBe(PushTokenPersistenceStatus.Deferred);
      expect(result.reason).toContain("Invalid push token details");
      expect(result.reason).not.toContain(tokenVal);
      expect(unregisterPushToken).not.toHaveBeenCalled();
    });

    it("returns Deferred with safe reason on unsupported platform without calling transport", async () => {
      const { repository, unregisterPushToken } = createHarness();
      const token = { ...validToken, platform: "web" as any };

      const result = (await repository.remove(token)) as any;
      expect(result.status).toBe(PushTokenPersistenceStatus.Deferred);
      expect(result.reason).toContain("Unsupported provider or platform");
      expect(result.reason).not.toContain(tokenVal);
      expect(unregisterPushToken).not.toHaveBeenCalled();
    });

    it("returns Deferred with safe reason on unsupported provider without calling transport", async () => {
      const { repository, unregisterPushToken } = createHarness();
      const token = { ...validToken, provider: "apns" as any };

      const result = (await repository.remove(token)) as any;
      expect(result.status).toBe(PushTokenPersistenceStatus.Deferred);
      expect(result.reason).toContain("Unsupported provider or platform");
      expect(result.reason).not.toContain(tokenVal);
      expect(unregisterPushToken).not.toHaveBeenCalled();
    });

    it("returns Deferred on transport failure", async () => {
      const { repository } = createHarness({
        unregisterPushToken: async () => {
          throw new Error(`Timeout for token ${tokenVal}`);
        },
      });

      const result = (await repository.remove(validToken)) as any;
      expect(result.status).toBe(PushTokenPersistenceStatus.Deferred);
      expect(result.reason).toContain("unregistration could not be completed");
      expect(result.reason).not.toContain(tokenVal);
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["string", "invalid"],
      ["array", []],
      ["empty object", {}],
      ["missing success", { deviceId, status: "unregistered", alreadyInactive: false }],
      ["success false", { success: false, deviceId, status: "unregistered", alreadyInactive: false }],
      ["success wrong type", { success: "true", deviceId, status: "unregistered", alreadyInactive: false }],
      ["missing deviceId", { success: true, status: "unregistered", alreadyInactive: false }],
      ["deviceId wrong type", { success: true, deviceId: 123, status: "unregistered", alreadyInactive: false }],
      ["mismatched deviceId", { success: true, deviceId: "mismatched-device", status: "unregistered", alreadyInactive: false }],
      ["missing status", { success: true, deviceId, alreadyInactive: false }],
      ["incorrect status", { success: true, deviceId, status: "registered", alreadyInactive: false }],
      ["status wrong type", { success: true, deviceId, status: 123, alreadyInactive: false }],
      ["missing alreadyInactive", { success: true, deviceId, status: "unregistered" }],
      ["alreadyInactive wrong type", { success: true, deviceId, status: "unregistered", alreadyInactive: "false" }],
    ])("returns exact Deferred result for malformed remove response (%s)", async (_label, responseBody) => {
      const { repository } = createHarness({
        unregisterPushToken: async () => responseBody as any,
      });

      const result = await repository.remove(validToken);
      expect(result).toEqual({
        status: PushTokenPersistenceStatus.Deferred,
        reason: "Push-token unregistration returned an invalid response.",
      });
    });
  });
});
