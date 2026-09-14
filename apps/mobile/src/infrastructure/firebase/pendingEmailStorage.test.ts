import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PendingEmailStorage,
  PENDING_EMAIL_STORAGE_KEY,
  type PendingEmailStorageGateway,
} from "./pendingEmailStorage";

describe("PendingEmailStorage", () => {
  let mockStorage: PendingEmailStorageGateway;

  beforeEach(() => {
    mockStorage = {
      getItem: vi.fn<(key: string) => Promise<string | null>>().mockResolvedValue(null),
      setItem: vi.fn<(key: string, value: string) => Promise<void>>().mockResolvedValue(undefined),
      removeItem: vi.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined),
    };
  });

  it("saves trimmed lowercase email and anonymousUid", async () => {
    const storage = new PendingEmailStorage(mockStorage);
    await storage.savePendingEmail("  User@Example.COM ", "anon-uid-123");

    expect(mockStorage.setItem).toHaveBeenCalledOnce();
    const [key, value] = vi.mocked(mockStorage.setItem).mock.calls[0];
    expect(key).toBe(PENDING_EMAIL_STORAGE_KEY);
    const parsed = JSON.parse(value);
    expect(parsed.email).toBe("user@example.com");
    expect(parsed.anonymousUid).toBe("anon-uid-123");
    expect(parsed.requestedAt).toBeDefined();
  });

  it("does not save empty email", async () => {
    const storage = new PendingEmailStorage(mockStorage);
    await storage.savePendingEmail("   ");

    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it("retrieves valid pending email", async () => {
    const storage = new PendingEmailStorage(mockStorage);
    const now = new Date().toISOString();
    vi.mocked(mockStorage.getItem).mockResolvedValueOnce(
      JSON.stringify({
        email: "traveler@karri.com",
        anonymousUid: "uid-abc",
        requestedAt: now,
      }),
    );

    const record = await storage.getPendingEmail();
    expect(record).toEqual({
      email: "traveler@karri.com",
      anonymousUid: "uid-abc",
      requestedAt: now,
    });
  });

  it("clears and returns null if record is expired", async () => {
    const storage = new PendingEmailStorage(mockStorage, 1000); // 1 second TTL
    const twoSecondsAgo = new Date(Date.now() - 2000).toISOString();
    vi.mocked(mockStorage.getItem).mockResolvedValueOnce(
      JSON.stringify({
        email: "traveler@karri.com",
        anonymousUid: null,
        requestedAt: twoSecondsAgo,
      }),
    );

    const record = await storage.getPendingEmail();
    expect(record).toBeNull();
    expect(mockStorage.removeItem).toHaveBeenCalledWith(PENDING_EMAIL_STORAGE_KEY);
  });

  it("clears and returns null if stored JSON is corrupt", async () => {
    const storage = new PendingEmailStorage(mockStorage);
    vi.mocked(mockStorage.getItem).mockResolvedValueOnce(JSON.stringify({ invalid: true }));

    const record = await storage.getPendingEmail();
    expect(record).toBeNull();
    expect(mockStorage.removeItem).toHaveBeenCalledWith(PENDING_EMAIL_STORAGE_KEY);
  });

  it("clears pending email upon request", async () => {
    const storage = new PendingEmailStorage(mockStorage);
    await storage.clearPendingEmail();

    expect(mockStorage.removeItem).toHaveBeenCalledWith(PENDING_EMAIL_STORAGE_KEY);
  });
});
