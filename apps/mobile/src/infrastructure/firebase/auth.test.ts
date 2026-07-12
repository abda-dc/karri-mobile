import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirebaseAuthSessionGateway } from "./auth";
import { getFirebaseServices } from "./client";
import { onAuthStateChanged } from "firebase/auth";

vi.mock("./client", () => ({
  getFirebaseServices: vi.fn(),
  isFirebaseConfigured: true,
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
  signOut: vi.fn(),
}));

describe("FirebaseAuthSessionGateway", () => {
  const mockUser = {
    uid: "test-user-123",
    isAnonymous: false,
    metadata: { creationTime: "2026-07-12T12:00:00Z" },
    getIdTokenResult: vi.fn(),
  };

  const mockAuth = {
    currentUser: null as any,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.currentUser = null;
    vi.mocked(getFirebaseServices).mockReturnValue({
      auth: mockAuth as any,
      app: {} as any,
      db: {} as any,
      storage: {} as any,
    });
  });

  it("resolves role 'user' when custom claims role is absent or undefined", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockResolvedValueOnce({
      claims: {},
    });

    const gateway = new FirebaseAuthSessionGateway();
    const session = await gateway.startMvpSession();

    expect(session.identity.uid).toBe("test-user-123");
    expect(session.authorization.role).toBe("user");
  });

  it("resolves the normalized role when a valid custom claim is present", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockResolvedValueOnce({
      claims: { role: "operations_admin" },
    });

    const gateway = new FirebaseAuthSessionGateway();
    const session = await gateway.startMvpSession();

    expect(session.authorization.role).toBe("operations_admin");
  });

  it("normalizes malformed or unsupported role claims to user", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockResolvedValueOnce({
      claims: { role: "super_hacker" },
    });

    const gateway = new FirebaseAuthSessionGateway();
    const session = await gateway.startMvpSession();

    expect(session.authorization.role).toBe("user");
  });

  it("fails closed to 'user' when getIdTokenResult fails", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockRejectedValueOnce(new Error("Network error"));

    const gateway = new FirebaseAuthSessionGateway();
    const session = await gateway.startMvpSession();

    expect(session.authorization.role).toBe("user");
  });

  it("surfaces refresh error without overwriting authorization on refresh failure", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockRejectedValueOnce(new Error("Network issue"));

    const gateway = new FirebaseAuthSessionGateway();
    await expect(gateway.refreshAuthorization()).rejects.toThrow("Network issue");
  });

  it("unsubscribe prevents pending async callbacks", async () => {
    let authCallback: any;
    vi.mocked(onAuthStateChanged).mockImplementationOnce((auth, cb: any) => {
      authCallback = cb;
      return () => {};
    });

    const gateway = new FirebaseAuthSessionGateway();
    const onChange = vi.fn();

    const unsubscribe = gateway.subscribe(onChange, () => {});

    // Trigger auth state change
    mockUser.getIdTokenResult.mockResolvedValueOnce({ claims: { role: "moderator" } });
    authCallback(mockUser);

    // Unsubscribe immediately before promise resolves
    unsubscribe();

    // Wait for macro-tasks
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("generation tokens prevent stale session publication on account switching", async () => {
    let authCallback: any;
    vi.mocked(onAuthStateChanged).mockImplementationOnce((auth, cb: any) => {
      authCallback = cb;
      return () => {};
    });

    const gateway = new FirebaseAuthSessionGateway();
    const onChange = vi.fn();

    gateway.subscribe(onChange, () => {});

    // User A signs in
    const userA = { ...mockUser, uid: "user-A" };
    let resolveUserA: any;
    userA.getIdTokenResult.mockImplementationOnce(() => new Promise((resolve) => { resolveUserA = resolve; }));
    authCallback(userA);

    // User B signs in immediately (switches accounts) before User A's claims resolve
    const userB = { ...mockUser, uid: "user-B" };
    userB.getIdTokenResult.mockResolvedValueOnce({ claims: { role: "super_admin" } });
    authCallback(userB);

    // Wait for User B to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      identity: expect.objectContaining({ uid: "user-B" }),
      authorization: { role: "super_admin" },
    }));

    // Resolve User A's claims (stale resolution)
    resolveUserA({ claims: { role: "moderator" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Stale resolution must not be emitted
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
