import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirebaseAuthSessionGateway } from "./auth";
import { getFirebaseServices } from "./client";
import {
  EmailAuthProvider,
  isSignInWithEmailLink,
  linkWithCredential,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
} from "firebase/auth";
import { ApplicationErrorCode } from "../../application/errors/ApplicationError";

vi.mock("./client", () => ({
  getFirebaseServices: vi.fn(),
  isFirebaseConfigured: true,
}));

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: {
    credentialWithLink: vi.fn((email: string, link: string) => ({
      providerId: "password",
      signInMethod: "emailLink",
      email,
      link,
    })),
  },
  isSignInWithEmailLink: vi.fn(),
  linkWithCredential: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithEmailLink: vi.fn(),
  signOut: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
}));

describe("FirebaseAuthSessionGateway", () => {
  const mockUser = {
    uid: "test-user-123",
    email: "test-user-123@karri.com",
    isAnonymous: false,
    metadata: { creationTime: "2026-07-12T12:00:00Z" },
    getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
  };

  const mockAuth = {
    currentUser: null as any,
  };

  let mockPendingStorage: {
    clearPendingEmail: ReturnType<typeof vi.fn>;
    getPendingEmail: ReturnType<typeof vi.fn>;
    savePendingEmail: ReturnType<typeof vi.fn>;
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

    mockPendingStorage = {
      clearPendingEmail: vi.fn().mockResolvedValue(undefined),
      getPendingEmail: vi.fn().mockResolvedValue(null),
      savePendingEmail: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("returns the current authenticated user ID without changing auth state", () => {
    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);

    expect(gateway.getCurrentUserId()).toBeNull();

    mockAuth.currentUser = mockUser;
    expect(gateway.getCurrentUserId()).toBe("test-user-123");
  });

  it("signs out only when the current user matches the captured user", async () => {
    mockAuth.currentUser = mockUser;
    vi.mocked(signOut).mockResolvedValueOnce(undefined);

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
    await gateway.signOut("test-user-123");

    expect(signOut).toHaveBeenCalledWith(mockAuth);
  });

  it("does not sign out a newly authenticated different user", async () => {
    mockAuth.currentUser = {
      ...mockUser,
      uid: "user-next",
    };

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
    await gateway.signOut("user-previous");

    expect(signOut).not.toHaveBeenCalled();
  });

  it("resolves role 'user' when custom claims role is absent or undefined", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockResolvedValueOnce({
      claims: {},
    });

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
    const session = await gateway.startMvpSession();

    expect(session.identity.uid).toBe("test-user-123");
    expect(session.authorization.role).toBe("user");
  });

  it("resolves the normalized role when a valid custom claim is present", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockResolvedValueOnce({
      claims: { role: "operations_admin" },
    });

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
    const session = await gateway.startMvpSession();

    expect(session.authorization.role).toBe("operations_admin");
  });

  it("normalizes malformed or unsupported role claims to user", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockResolvedValueOnce({
      claims: { role: "super_hacker" },
    });

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
    const session = await gateway.startMvpSession();

    expect(session.authorization.role).toBe("user");
  });

  it("fails closed to 'user' when getIdTokenResult fails", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockRejectedValueOnce(new Error("Network error"));

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
    const session = await gateway.startMvpSession();

    expect(session.authorization.role).toBe("user");
  });

  it("surfaces refresh error without overwriting authorization on refresh failure", async () => {
    mockAuth.currentUser = mockUser;
    mockUser.getIdTokenResult.mockRejectedValueOnce(new Error("Network issue"));

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
    await expect(gateway.refreshAuthorization()).rejects.toThrow("Network issue");
  });

  it("unsubscribe prevents pending async callbacks", async () => {
    let authCallback: any;
    vi.mocked(onAuthStateChanged).mockImplementationOnce((auth, cb: any) => {
      authCallback = cb;
      return () => {};
    });

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
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

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
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

  // Admin regression tests
  it("signInWithEmail successfully logs in admin and returns mapped session", async () => {
    const mockCredential = {
      user: mockUser,
    };
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce(mockCredential as any);
    mockUser.getIdTokenResult.mockResolvedValueOnce({
      claims: { role: "super_admin" },
    });

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
    const session = await gateway.signInWithEmail("admin@karri.com", "securePassword123");

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), "admin@karri.com", "securePassword123");
    expect(session.identity.uid).toBe("test-user-123");
    expect(session.authorization.role).toBe("super_admin");
  });

  it("signInWithEmail throws a generic error when admin credentials are invalid", async () => {
    const firebaseError = new Error("Auth failed");
    (firebaseError as any).code = "auth/invalid-credential";
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(firebaseError);

    const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
    await expect(
      gateway.signInWithEmail("admin@karri.com", "wrongPassword"),
    ).rejects.toThrow("The email or password is incorrect, or this account cannot access the administrator console.");
  });

  // R02 — Customer Passwordless Authentication Tests

  describe("sendSignInLinkToEmail", () => {
    it("sends magic link and persists pending email state", async () => {
      vi.mocked(sendSignInLinkToEmail).mockResolvedValueOnce(undefined);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      await gateway.sendSignInLinkToEmail("customer@karri.com");

      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        mockAuth,
        "customer@karri.com",
        expect.objectContaining({
          handleCodeInApp: true,
          iOS: { bundleId: "com.karrimobile.app" },
          android: expect.objectContaining({ packageName: "com.karrimobile.app" }),
        }),
      );
      expect(mockPendingStorage.savePendingEmail).toHaveBeenCalledWith(
        "customer@karri.com",
        null,
      );
    });

    it("captures current anonymous UID when anonymous user requests magic link", async () => {
      mockAuth.currentUser = {
        uid: "anon-uid-100",
        isAnonymous: true,
      };
      vi.mocked(sendSignInLinkToEmail).mockResolvedValueOnce(undefined);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      await gateway.sendSignInLinkToEmail("upgrade@karri.com");

      expect(mockPendingStorage.savePendingEmail).toHaveBeenCalledWith(
        "upgrade@karri.com",
        "anon-uid-100",
      );
    });

    it("validates that email is not empty", async () => {
      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      await expect(gateway.sendSignInLinkToEmail("  ")).rejects.toThrow(
        "Email address is required.",
      );
      expect(sendSignInLinkToEmail).not.toHaveBeenCalled();
    });

    it("maps send failure error cleanly", async () => {
      const error = new Error("Quota exceeded");
      (error as any).code = "auth/too-many-requests";
      vi.mocked(sendSignInLinkToEmail).mockRejectedValueOnce(error);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      await expect(
        gateway.sendSignInLinkToEmail("customer@karri.com"),
      ).rejects.toThrow("Karri has received too many sign-in attempts.");
    });

    it("maps operation-not-allowed to Configuration error when email link provider is disabled", async () => {
      const error = new Error("Operation not allowed");
      (error as any).code = "auth/operation-not-allowed";
      vi.mocked(sendSignInLinkToEmail).mockRejectedValueOnce(error);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      await expect(
        gateway.sendSignInLinkToEmail("customer@karri.com"),
      ).rejects.toMatchObject({
        code: ApplicationErrorCode.Configuration,
        message: "Email link authentication is not enabled for this Firebase project.",
      });
    });
  });

  describe("completeEmailLinkSignIn", () => {
    const validLink = "https://karri-mobile.firebaseapp.com/__/auth/action?apiKey=test&mode=signIn&oobCode=12345";

    it("rejects invalid links before hitting Firebase", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(false);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      await expect(
        gateway.completeEmailLinkSignIn("https://invalid.com/link", "test@karri.com"),
      ).rejects.toThrow("The provided link is not a valid Karri sign-in link.");
    });

    it("recovers email from pending storage when emailConfirm is not passed", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true);
      mockPendingStorage.getPendingEmail.mockResolvedValueOnce({
        email: "saved@karri.com",
        anonymousUid: null,
        requestedAt: new Date().toISOString(),
      });

      const permanentUser = {
        ...mockUser,
        uid: "new-user-uid",
        email: "saved@karri.com",
        isAnonymous: false,
      };
      vi.mocked(signInWithEmailLink).mockResolvedValueOnce({
        user: permanentUser,
      } as any);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      const result = await gateway.completeEmailLinkSignIn(validLink);

      expect(signInWithEmailLink).toHaveBeenCalledWith(mockAuth, "saved@karri.com", validLink);
      expect(result.session.identity.email).toBe("saved@karri.com");
      expect(result.session.identity.uid).toBe("new-user-uid");
      expect(result.isUpgrade).toBe(false);
      expect(mockPendingStorage.clearPendingEmail).toHaveBeenCalledOnce();
    });

    it("New customer flow: no current user -> creates permanent session with new UID", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true);
      mockAuth.currentUser = null;

      const newUser = {
        ...mockUser,
        uid: "brand-new-uid-999",
        email: "new@karri.com",
        isAnonymous: false,
      };
      vi.mocked(signInWithEmailLink).mockResolvedValueOnce({
        user: newUser,
      } as any);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      const result = await gateway.completeEmailLinkSignIn(validLink, "new@karri.com");

      expect(signInWithEmailLink).toHaveBeenCalledWith(mockAuth, "new@karri.com", validLink);
      expect(result.session.identity.uid).toBe("brand-new-uid-999");
      expect(result.session.identity.isAnonymous).toBe(false);
      expect(result.isUpgrade).toBe(false);
      expect(mockPendingStorage.clearPendingEmail).toHaveBeenCalledOnce();
    });

    it("Anonymous upgrade flow: anonymous UID A -> links credential -> UID remains A and isAnonymous becomes false", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true);

      const anonymousUser = {
        uid: "anon-original-uid-42",
        email: null,
        isAnonymous: true,
        metadata: { creationTime: "2026-07-12T12:00:00Z" },
        getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
      };
      mockAuth.currentUser = anonymousUser;

      const upgradedUser = {
        ...anonymousUser,
        uid: "anon-original-uid-42", // Must be identical!
        email: "upgraded@karri.com",
        isAnonymous: false,
      };

      vi.mocked(linkWithCredential).mockResolvedValueOnce({
        user: upgradedUser,
      } as any);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      const result = await gateway.completeEmailLinkSignIn(validLink, "upgraded@karri.com");

      expect(EmailAuthProvider.credentialWithLink).toHaveBeenCalledWith(
        "upgraded@karri.com",
        validLink,
      );
      expect(linkWithCredential).toHaveBeenCalledWith(
        anonymousUser,
        expect.objectContaining({ email: "upgraded@karri.com" }),
      );

      // Verify UID preservation invariant:
      expect(result.session.identity.uid).toBe("anon-original-uid-42");
      expect(result.session.identity.email).toBe("upgraded@karri.com");
      expect(result.session.identity.isAnonymous).toBe(false);
      expect(result.isUpgrade).toBe(true);
      expect(mockPendingStorage.clearPendingEmail).toHaveBeenCalledOnce();
    });

    it("Returning customer flow: permanent user signs out -> completes link -> original UID restored", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true);

      // Customer previously signed out
      mockAuth.currentUser = null;

      const returningUser = {
        ...mockUser,
        uid: "original-customer-uid-77",
        email: "returning@karri.com",
        isAnonymous: false,
      };
      vi.mocked(signInWithEmailLink).mockResolvedValueOnce({
        user: returningUser,
      } as any);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);
      const result = await gateway.completeEmailLinkSignIn(validLink, "returning@karri.com");

      expect(signInWithEmailLink).toHaveBeenCalledWith(mockAuth, "returning@karri.com", validLink);
      expect(result.session.identity.uid).toBe("original-customer-uid-77");
      expect(result.session.identity.email).toBe("returning@karri.com");
      expect(result.session.identity.isAnonymous).toBe(false);
      expect(result.isUpgrade).toBe(false);
    });

    it("Collision flow: linking email that belongs to another account throws Conflict error without modifying anonymous user", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true);

      const anonymousUser = {
        uid: "anon-active-uid",
        email: null,
        isAnonymous: true,
        metadata: { creationTime: "2026-07-12T12:00:00Z" },
        getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
      };
      mockAuth.currentUser = anonymousUser;

      const collisionError = new Error("Email in use");
      (collisionError as any).code = "auth/email-already-in-use";
      vi.mocked(linkWithCredential).mockRejectedValueOnce(collisionError);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);

      await expect(
        gateway.completeEmailLinkSignIn(validLink, "existing-user@karri.com"),
      ).rejects.toMatchObject({
        code: ApplicationErrorCode.Conflict,
        message: "This email address is already associated with another Karri account.",
      });

      // Anonymous session must remain untouched
      expect(mockAuth.currentUser.uid).toBe("anon-active-uid");
      expect(mockAuth.currentUser.isAnonymous).toBe(true);
      // Pending email must not be cleared on collision so user can try again or resolve
      expect(mockPendingStorage.clearPendingEmail).not.toHaveBeenCalled();
    });

    it("Expired or invalid action code throws friendly Authentication error", async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true);
      mockAuth.currentUser = null;

      const expiredError = new Error("Action code expired");
      (expiredError as any).code = "auth/expired-action-code";
      vi.mocked(signInWithEmailLink).mockRejectedValueOnce(expiredError);

      const gateway = new FirebaseAuthSessionGateway(mockPendingStorage as any);

      await expect(
        gateway.completeEmailLinkSignIn(validLink, "customer@karri.com"),
      ).rejects.toMatchObject({
        code: ApplicationErrorCode.Authentication,
        message: "This sign-in link is invalid or has expired.",
        retryable: true,
      });
    });
  });
});
