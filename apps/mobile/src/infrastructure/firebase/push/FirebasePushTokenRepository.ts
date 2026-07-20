import {
  PushTokenPersistenceStatus,
  type PushTokenPersistenceResult,
  type PushTokenRepository,
} from "../../../application/services/PushRegistrationService";
import { assertPushToken, type PushToken } from "../../../application/notifications/PushToken";
import type {
  RegisterPushTokenPayload,
  RegisterPushTokenResult,
  UnregisterPushTokenPayload,
  UnregisterPushTokenResult,
} from "../privilegedCallableTransport";

export interface PushTokenTransport {
  registerPushToken(payload: RegisterPushTokenPayload): Promise<RegisterPushTokenResult>;
  unregisterPushToken(payload: UnregisterPushTokenPayload): Promise<UnregisterPushTokenResult>;
}

export class FirebasePushTokenRepository implements PushTokenRepository {
  constructor(private readonly transport: PushTokenTransport) {}

  private isValidRegisterResponse(
    res: unknown,
    deviceId: string,
  ): res is RegisterPushTokenResult {
    return (
      typeof res === "object" &&
      res !== null &&
      !Array.isArray(res) &&
      (res as any).success === true &&
      typeof (res as any).deviceId === "string" &&
      (res as any).deviceId === deviceId &&
      (res as any).status === "registered" &&
      typeof (res as any).alreadyExisted === "boolean"
    );
  }

  private isValidUnregisterResponse(
    res: unknown,
    deviceId: string,
  ): res is UnregisterPushTokenResult {
    return (
      typeof res === "object" &&
      res !== null &&
      !Array.isArray(res) &&
      (res as any).success === true &&
      typeof (res as any).deviceId === "string" &&
      (res as any).deviceId === deviceId &&
      (res as any).status === "unregistered" &&
      typeof (res as any).alreadyInactive === "boolean"
    );
  }

  async remove(token: PushToken): Promise<PushTokenPersistenceResult> {
    try {
      assertPushToken(token, token.userId);
    } catch {
      return {
        reason: "Invalid push token details.",
        status: PushTokenPersistenceStatus.Deferred,
      };
    }

    if (
      token.provider !== "expo" ||
      (token.platform !== "android" && token.platform !== "ios")
    ) {
      return {
        reason:
          "Unsupported provider or platform for push token unregistration.",
        status: PushTokenPersistenceStatus.Deferred,
      };
    }

    try {
      const res = await this.transport.unregisterPushToken({
        deviceId: token.deviceId,
      });
      if (this.isValidUnregisterResponse(res, token.deviceId)) {
        return { status: PushTokenPersistenceStatus.Removed };
      }
      return {
        status: PushTokenPersistenceStatus.Deferred,
        reason: "Push-token unregistration returned an invalid response.",
      };
    } catch {
      return {
        reason:
          "Trusted server token unregistration could not be completed.",
        status: PushTokenPersistenceStatus.Deferred,
      };
    }
  }

  async save(token: PushToken): Promise<PushTokenPersistenceResult> {
    try {
      assertPushToken(token, token.userId);
    } catch {
      return {
        reason: "Invalid push token details.",
        status: PushTokenPersistenceStatus.Deferred,
      };
    }

    if (
      token.provider !== "expo" ||
      (token.platform !== "android" && token.platform !== "ios")
    ) {
      return {
        reason:
          "Unsupported provider or platform for push token registration.",
        status: PushTokenPersistenceStatus.Deferred,
      };
    }

    try {
      const res = await this.transport.registerPushToken({
        deviceId: token.deviceId,
        platform: token.platform,
        provider: token.provider,
        token: token.value,
        registeredAt: token.registeredAt,
      });
      if (this.isValidRegisterResponse(res, token.deviceId)) {
        return { status: PushTokenPersistenceStatus.Stored };
      }
      return {
        status: PushTokenPersistenceStatus.Deferred,
        reason: "Push-token registration returned an invalid response.",
      };
    } catch {
      return {
        reason: "Trusted server token persistence could not be completed.",
        status: PushTokenPersistenceStatus.Deferred,
      };
    }
  }
}
