import { describe, it, expect, vi } from "vitest";
import { AuthSessionService, type AuthSessionGateway } from "./AuthSessionService";

describe("AuthSessionService", () => {
  const mockGateway: AuthSessionGateway = {
    configured: true,
    signOut: vi.fn(),
    startMvpSession: vi.fn(),
    signInWithEmail: vi.fn(),
    refreshAuthorization: vi.fn(),
    subscribe: vi.fn(),
  };

  const service = new AuthSessionService(mockGateway);

  it("delegates isConfigured to gateway configured property", () => {
    expect(service.isConfigured).toBe(true);
  });

  it("delegates signOut to gateway", async () => {
    vi.mocked(mockGateway.signOut).mockResolvedValueOnce();
    await service.signOut();
    expect(mockGateway.signOut).toHaveBeenCalled();
  });

  it("delegates startMvpSession to gateway", async () => {
    const mockSession = {
      identity: {
        uid: "user-123",
        email: null,
        createdAt: "2026-07-12T12:00:00Z",
        isAnonymous: false,
      },
      authorization: {
        role: "user" as const,
      },
    };
    vi.mocked(mockGateway.startMvpSession).mockResolvedValueOnce(mockSession);
    const result = await service.startMvpSession();
    expect(result).toEqual(mockSession);
  });

  it("delegates signInWithEmail to gateway", async () => {
    const mockSession = {
      identity: {
        uid: "admin-123",
        email: "admin@karri.com",
        createdAt: "2026-07-12T12:00:00Z",
        isAnonymous: false,
      },
      authorization: {
        role: "super_admin" as const,
      },
    };
    vi.mocked(mockGateway.signInWithEmail).mockResolvedValueOnce(mockSession);
    const result = await service.signInWithEmail("admin@karri.com", "password123");
    expect(result).toEqual(mockSession);
    expect(mockGateway.signInWithEmail).toHaveBeenCalledWith("admin@karri.com", "password123");
  });

  it("delegates refreshAuthorization to gateway", async () => {
    const mockAuthSession = {
      uid: "admin-123",
      role: "operations_admin" as const,
    };
    vi.mocked(mockGateway.refreshAuthorization).mockResolvedValueOnce(mockAuthSession);
    const result = await service.refreshAuthorization();
    expect(result).toEqual(mockAuthSession);
  });

  it("delegates subscribe to gateway", () => {
    const onChange = vi.fn();
    const onError = vi.fn();
    const mockUnsubscribe = vi.fn();
    vi.mocked(mockGateway.subscribe).mockReturnValueOnce(mockUnsubscribe);

    const unsubscribe = service.subscribe(onChange, onError);
    expect(mockGateway.subscribe).toHaveBeenCalledWith(onChange, onError);

    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
