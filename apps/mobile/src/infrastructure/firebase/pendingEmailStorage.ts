import AsyncStorage from "@react-native-async-storage/async-storage";

export const PENDING_EMAIL_STORAGE_KEY = "@karri/pending-email-auth/v1";
export const PENDING_EMAIL_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PendingEmailRecord {
  readonly email: string;
  readonly anonymousUid: string | null;
  readonly requestedAt: string;
}

export interface PendingEmailStorageGateway {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class PendingEmailStorage {
  constructor(
    private readonly storage: PendingEmailStorageGateway = AsyncStorage,
    private readonly maxAgeMs: number = PENDING_EMAIL_MAX_AGE_MS,
  ) {}

  async savePendingEmail(
    email: string,
    anonymousUid?: string | null,
  ): Promise<void> {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return;
    }

    const record: PendingEmailRecord = {
      email: trimmedEmail,
      anonymousUid: anonymousUid ?? null,
      requestedAt: new Date().toISOString(),
    };

    try {
      await this.storage.setItem(
        PENDING_EMAIL_STORAGE_KEY,
        JSON.stringify(record),
      );
    } catch {
      // Best-effort storage write; non-blocking on storage errors
    }
  }

  async getPendingEmail(): Promise<PendingEmailRecord | null> {
    try {
      const raw = await this.storage.getItem(PENDING_EMAIL_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<PendingEmailRecord>;
      if (
        typeof parsed.email !== "string" ||
        !parsed.email ||
        typeof parsed.requestedAt !== "string"
      ) {
        await this.clearPendingEmail();
        return null;
      }

      const requestedTime = new Date(parsed.requestedAt).getTime();
      if (isNaN(requestedTime) || Date.now() - requestedTime > this.maxAgeMs) {
        await this.clearPendingEmail();
        return null;
      }

      return {
        email: parsed.email,
        anonymousUid:
          typeof parsed.anonymousUid === "string" ? parsed.anonymousUid : null,
        requestedAt: parsed.requestedAt,
      };
    } catch {
      return null;
    }
  }

  async clearPendingEmail(): Promise<void> {
    try {
      await this.storage.removeItem(PENDING_EMAIL_STORAGE_KEY);
    } catch {
      // Best-effort removal
    }
  }
}

export const pendingEmailStorage = new PendingEmailStorage();
