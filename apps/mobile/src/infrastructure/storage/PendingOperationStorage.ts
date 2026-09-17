import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

export interface StorageGateway {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type OperationType = "shipment" | "trip" | "booking";

export interface PendingOperationRecord {
  readonly operationId: string;
  readonly operationType: OperationType;
  readonly scopeId: string;
  readonly createdAt: string;
}

export function generateSecureId(prefix = ""): string {
  const uuid = Crypto.randomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export class PendingOperationStorage {
  constructor(private readonly storage: StorageGateway = AsyncStorage) {}

  private getStorageKey(type: OperationType, scopeId: string): string {
    return `@karri/pending-op/v1/${type}/${scopeId}`;
  }

  async getPendingOperation(
    type: OperationType,
    scopeId: string,
  ): Promise<string | null> {
    try {
      const raw = await this.storage.getItem(this.getStorageKey(type, scopeId));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<PendingOperationRecord>;
      if (
        typeof parsed?.operationId === "string" &&
        parsed.operationId.trim().length > 0
      ) {
        return parsed.operationId;
      }
      return null;
    } catch {
      return null;
    }
  }

  async savePendingOperation(
    type: OperationType,
    scopeId: string,
    operationId: string,
  ): Promise<void> {
    const record: PendingOperationRecord = {
      operationId,
      operationType: type,
      scopeId,
      createdAt: new Date().toISOString(),
    };
    try {
      await this.storage.setItem(
        this.getStorageKey(type, scopeId),
        JSON.stringify(record),
      );
    } catch {
      // Best-effort write
    }
  }

  async getOrCreatePendingOperation(
    type: OperationType,
    scopeId: string,
    prefix: string = type,
  ): Promise<string> {
    const existing = await this.getPendingOperation(type, scopeId);
    if (existing) {
      return existing;
    }
    const newId = generateSecureId(prefix);
    await this.savePendingOperation(type, scopeId, newId);
    return newId;
  }

  async clearPendingOperation(
    type: OperationType,
    scopeId: string,
  ): Promise<void> {
    try {
      await this.storage.removeItem(this.getStorageKey(type, scopeId));
    } catch {
      // Best-effort removal
    }
  }
}

export const defaultPendingOperationStorage = new PendingOperationStorage();
