import { describe, it, expect, vi } from "vitest";
import { AuthSessionService, type AuthSessionGateway } from "./AuthSessionService";

describe("AuthSessionService", () => {
  const mockGateway: AuthSessionGateway = {
    configured: true,
    signOut: vi.fn(),
    startMvpSession: vi.fn(),
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

  it("delegates refreshAuthorization to gateway", async () => {
    const mockAuthSession = {
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
