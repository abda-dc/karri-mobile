import type { Transaction } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { ValidationError } from "../errors/DomainErrors.js";

export interface RegisterPushTokenInput {
  deviceId: string;
  platform: string;
  provider: string;
  token: string;
  registeredAt: string;
}

export interface UnregisterPushTokenInput {
  deviceId: string;
}

export class PushTokenPersistenceService {
  constructor(private readonly db: admin.firestore.Firestore) {}

  /**
   * Strictly validates that the object has no unknown keys.
   */
  private validateKeys(data: any, allowedKeys: Set<string>): void {
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }
    const keys = Object.keys(data);
    for (const key of keys) {
      if (!allowedKeys.has(key)) {
        throw new ValidationError("Request payload contains unsupported fields.");
      }
    }
    if (keys.length !== allowedKeys.size) {
      throw new ValidationError("Payload is missing required fields.");
    }
  }

  /**
   * Strictly validates an ISO-8601 timestamp string.
   */
  private validateIso8601(val: string): void {
    if (typeof val !== "string") {
      throw new ValidationError("Invalid registeredAt type.");
    }

    // Pattern matches YYYY-MM-DDTHH:mm:ss.sssZ strictly
    const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const match = val.match(pattern);
    if (!match) {
      throw new ValidationError("Invalid registeredAt format (must be YYYY-MM-DDTHH:mm:ss.sssZ).");
    }

    const parsedTime = Date.parse(val);
    if (!Number.isFinite(parsedTime)) {
      throw new ValidationError("Invalid registeredAt timestamp value.");
    }

    try {
      if (new Date(parsedTime).toISOString() !== val) {
        throw new ValidationError("Invalid registeredAt calendar value.");
      }
    } catch {
      throw new ValidationError("Invalid registeredAt calendar value.");
    }

    // registeredAt skew limit: not more than 5 minutes in the future
    const skewLimitMs = 5 * 60 * 1000;
    if (parsedTime > Date.now() + skewLimitMs) {
      throw new ValidationError("registeredAt is unreasonably far in the future.");
    }
  }

  /**
   * Registers or refreshes a push token for an authenticated user and device.
   */
  public async registerPushToken(
    transaction: Transaction,
    uid: string,
    data: any
  ): Promise<{ success: boolean; deviceId: string; status: string; alreadyExisted: boolean }> {
    const allowedKeys = new Set(["deviceId", "platform", "provider", "token", "registeredAt"]);
    this.validateKeys(data, allowedKeys);

    const { deviceId, platform, provider, token, registeredAt } = data;

    // Validate deviceId
    if (
      typeof deviceId !== "string" ||
      deviceId.trim() !== deviceId ||
      deviceId.length === 0 ||
      deviceId.length > 128 ||
      !/^karri-[a-z0-9-]{16,100}$/.test(deviceId)
    ) {
      throw new ValidationError("Invalid deviceId.");
    }

    // Validate platform
    if (platform !== "android" && platform !== "ios") {
      throw new ValidationError("Invalid platform.");
    }

    // Validate provider
    if (provider !== "expo") {
      throw new ValidationError("Invalid provider.");
    }

    // Validate token
    if (
      typeof token !== "string" ||
      token.trim() !== token ||
      token.length === 0 ||
      token.length > 512 ||
      /[\u0000-\u001f\u007f]/.test(token) ||
      !/^(ExponentPushToken|ExpoPushToken)\[[^\]\s\u0000-\u001f\u007f]+\]$/.test(token)
    ) {
      throw new ValidationError("Invalid push token format.");
    }

    // Validate registeredAt
    this.validateIso8601(registeredAt);

    const deviceRef = this.db
      .collection("pushTokenRegistrations")
      .doc(uid)
      .collection("devices")
      .doc(deviceId);

    const deviceSnap = await transaction.get(deviceRef);
    const alreadyExisted = deviceSnap.exists;

    if (alreadyExisted) {
      const existingData = deviceSnap.data() ?? {};
      const currentVersion = existingData.registrationVersion;
      let registrationVersion = 1;

      if (currentVersion !== undefined) {
        if (
          typeof currentVersion !== "number" ||
          !Number.isSafeInteger(currentVersion) ||
          currentVersion < 1
        ) {
          throw new Error("Invalid push registration version.");
        }

        const sameActiveToken =
          existingData.active === true &&
          existingData.token === token;

        if (sameActiveToken) {
          registrationVersion = currentVersion;
        } else {
          if (currentVersion === Number.MAX_SAFE_INTEGER) {
            throw new Error("Push registration version exhausted.");
          }

          registrationVersion = currentVersion + 1;
        }
      }

      const recordUpdate = {
        userId: uid,
        deviceId,
        platform,
        provider,
        token,
        active: true,
        registrationVersion,
        registeredAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedAt: null,
      };
      transaction.update(deviceRef, recordUpdate);
    } else {
      const recordCreate = {
        userId: uid,
        deviceId,
        platform,
        provider,
        token,
        active: true,
        registrationVersion: 1,
        registeredAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedAt: null,
      };
      transaction.set(deviceRef, recordCreate);
    }

    return {
      success: true,
      deviceId,
      status: "registered",
      alreadyExisted,
    };
  }

  /**
   * Unregisters a push token by deactivating the device document and deleting the raw token.
   */
  public async unregisterPushToken(
    transaction: Transaction,
    uid: string,
    data: any
  ): Promise<{ success: boolean; deviceId: string; status: string; alreadyInactive: boolean }> {
    const allowedKeys = new Set(["deviceId"]);
    this.validateKeys(data, allowedKeys);

    const { deviceId } = data;

    // Validate deviceId
    if (
      typeof deviceId !== "string" ||
      deviceId.trim() !== deviceId ||
      deviceId.length === 0 ||
      deviceId.length > 128 ||
      !/^karri-[a-z0-9-]{16,100}$/.test(deviceId)
    ) {
      throw new ValidationError("Invalid deviceId.");
    }

    const deviceRef = this.db
      .collection("pushTokenRegistrations")
      .doc(uid)
      .collection("devices")
      .doc(deviceId);

    const deviceSnap = await transaction.get(deviceRef);

    if (!deviceSnap.exists) {
      return {
        success: true,
        deviceId,
        status: "unregistered",
        alreadyInactive: true,
      };
    }

    const existingData = deviceSnap.data() || {};

    if (existingData.active === false) {
      const hasToken = existingData.token !== undefined;
      const hasValidRevokedAt = existingData.revokedAt instanceof admin.firestore.Timestamp;

      if (!hasToken && hasValidRevokedAt) {
        return {
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: true,
        };
      }

      const updateData: any = {};
      let needsWrite = false;

      if (hasToken) {
        updateData.token = admin.firestore.FieldValue.delete();
        needsWrite = true;
      }
      if (!hasValidRevokedAt) {
        updateData.revokedAt = admin.firestore.FieldValue.serverTimestamp();
        needsWrite = true;
      }

      if (needsWrite) {
        updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        transaction.update(deviceRef, updateData);
      }

      return {
        success: true,
        deviceId,
        status: "unregistered",
        alreadyInactive: true,
      };
    }

    // Deactivate device document and strip token
    const recordUpdate = {
      active: false,
      token: admin.firestore.FieldValue.delete(),
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    transaction.update(deviceRef, recordUpdate);

    return {
      success: true,
      deviceId,
      status: "unregistered",
      alreadyInactive: false,
    };
  }
}
