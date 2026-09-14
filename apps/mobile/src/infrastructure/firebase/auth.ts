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
  type User as FirebaseUser,
} from "firebase/auth";
import type {
  AuthIdentity,
  AuthorizationSession,
  AuthenticatedSession,
  AuthSessionGateway,
  EmailLinkSignInResult,
} from "../../application/services/AuthSessionService";
import { getFirebaseServices, isFirebaseConfigured } from "./client";
import { normalizeAuthorizationRole, type AuthorizationRole } from "../../domain/authorization/roles";
import { ApplicationError, ApplicationErrorCode } from "../../application/errors/ApplicationError";
import { pendingEmailStorage, PendingEmailStorage } from "./pendingEmailStorage";

function mapIdentity(user: FirebaseUser): AuthIdentity {
  return {
    uid: user.uid,
    email: user.email ?? null,
    createdAt: user.metadata.creationTime ?? null,
    isAnonymous: user.isAnonymous,
  };
}

async function mapAuthorization(user: FirebaseUser): Promise<AuthorizationSession> {
  let roleClaim: unknown = "user";
  try {
    const tokenResult = await user.getIdTokenResult();
    roleClaim = tokenResult.claims.role;
  } catch {
    roleClaim = "user";
  }

  return {
    role: normalizeAuthorizationRole(roleClaim),
  };
}

function mapSignInError(error: unknown): ApplicationError {
  let providerCode = "";
  if (error && typeof error === "object" && "code" in error) {
    const codeVal = (error as { code?: unknown }).code;
    if (typeof codeVal === "string") {
      providerCode = codeVal;
    }
  }

  if (providerCode === "auth/network-request-failed") {
    return new ApplicationError({
      code: ApplicationErrorCode.Network,
      originalError: error,
      providerCode,
      retryable: true,
      retryGuidance: "Check your connection and try again.",
      userMessage: "Karri could not start your session while the connection is unavailable.",
    });
  }

  if (providerCode === "auth/too-many-requests") {
    return new ApplicationError({
      code: ApplicationErrorCode.RateLimited,
      originalError: error,
      providerCode,
      retryable: true,
      retryGuidance: "Wait a moment before trying again.",
      userMessage: "Karri has received too many sign-in attempts.",
    });
  }

  return new ApplicationError({
    code: ApplicationErrorCode.Authentication,
    originalError: error,
    providerCode,
    retryable: false,
    retryGuidance: "Check your sign-in details and try again.",
    userMessage: "The email or password is incorrect, or this account cannot access the administrator console.",
  });
}

function mapEmailAuthError(
  error: unknown,
  fallbackMessage = "Karri could not complete email sign-in.",
): ApplicationError {
  let providerCode = "";
  if (error && typeof error === "object" && "code" in error) {
    const codeVal = (error as { code?: unknown }).code;
    if (typeof codeVal === "string") {
      providerCode = codeVal;
    }
  }

  if (
    providerCode === "auth/credential-already-in-use" ||
    providerCode === "auth/email-already-in-use"
  ) {
    return new ApplicationError({
      code: ApplicationErrorCode.Conflict,
      originalError: error,
      providerCode,
      retryable: false,
      retryGuidance:
        "Sign in with that email address to access your existing account, or use a different email to keep your current temporary account.",
      userMessage: "This email address is already associated with another Karri account.",
    });
  }

  if (
    providerCode === "auth/invalid-action-code" ||
    providerCode === "auth/expired-action-code"
  ) {
    return new ApplicationError({
      code: ApplicationErrorCode.Authentication,
      originalError: error,
      providerCode,
      retryable: true,
      retryGuidance: "Request a new sign-in link and try again.",
      userMessage: "This sign-in link is invalid or has expired.",
    });
  }

  if (providerCode === "auth/invalid-email") {
    return new ApplicationError({
      code: ApplicationErrorCode.Validation,
      originalError: error,
      providerCode,
      retryable: false,
      retryGuidance: "Check the email address format and try again.",
      userMessage: "Please enter a valid email address.",
    });
  }

  if (providerCode === "auth/network-request-failed") {
    return new ApplicationError({
      code: ApplicationErrorCode.Network,
      originalError: error,
      providerCode,
      retryable: true,
      retryGuidance: "Check your connection and try again.",
      userMessage: "Karri could not connect to verify your account.",
    });
  }

  if (providerCode === "auth/too-many-requests") {
    return new ApplicationError({
      code: ApplicationErrorCode.RateLimited,
      originalError: error,
      providerCode,
      retryable: true,
      retryGuidance: "Wait a moment before requesting another sign-in link.",
      userMessage: "Karri has received too many sign-in attempts.",
    });
  }

  if (providerCode === "auth/operation-not-allowed") {
    return new ApplicationError({
      code: ApplicationErrorCode.Configuration,
      originalError: error,
      providerCode,
      retryable: false,
      retryGuidance:
        "Email link sign-in must be enabled in the Firebase Console under Authentication > Sign-in method.",
      userMessage: "Email link authentication is not enabled for this Firebase project.",
    });
  }

  return new ApplicationError({
    code: ApplicationErrorCode.Authentication,
    originalError: error,
    providerCode,
    retryable: false,
    retryGuidance: "Please try requesting a new sign-in link.",
    userMessage: fallbackMessage,
  });
}

export class FirebaseAuthSessionGateway implements AuthSessionGateway {
  readonly configured = isFirebaseConfigured;

  constructor(
    private readonly pendingStorage: PendingEmailStorage = pendingEmailStorage,
  ) {}

  getCurrentUserId(): string | null {
    return getFirebaseServices().auth.currentUser?.uid ?? null;
  }

  async startMvpSession(): Promise<AuthenticatedSession> {
    const { auth } = getFirebaseServices();
    const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
    const authorization = await mapAuthorization(user);
    return {
      identity: mapIdentity(user),
      authorization,
    };
  }

  async signInWithEmail(email: string, password: string): Promise<AuthenticatedSession> {
    const { auth } = getFirebaseServices();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const authorization = await mapAuthorization(user);
      return {
        identity: mapIdentity(user),
        authorization,
      };
    } catch (error) {
      throw mapSignInError(error);
    }
  }

  async sendSignInLinkToEmail(email: string): Promise<void> {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      throw new ApplicationError({
        code: ApplicationErrorCode.Validation,
        originalError: null,
        retryable: false,
        retryGuidance: "Enter your email address before continuing.",
        userMessage: "Email address is required.",
      });
    }

    const { auth } = getFirebaseServices();
    const authDomain =
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "karri-mobile.firebaseapp.com";
    const callbackUrl = `https://${authDomain}/verify`;

    const actionCodeSettings = {
      url: callbackUrl,
      handleCodeInApp: true,
      iOS: {
        bundleId: "com.karrimobile.app",
      },
      android: {
        packageName: "com.karrimobile.app",
        installApp: true,
        minimumVersion: "1",
      },
    };

    try {
      await sendSignInLinkToEmail(auth, trimmedEmail, actionCodeSettings);
      const currentUid = auth.currentUser?.isAnonymous ? auth.currentUser.uid : null;
      await this.pendingStorage.savePendingEmail(trimmedEmail, currentUid);
    } catch (error) {
      throw mapEmailAuthError(
        error,
        "Failed to send sign-in link. Please check the email address and try again.",
      );
    }
  }

  isSignInWithEmailLink(link: string): boolean {
    if (!link || typeof link !== "string") {
      return false;
    }
    const { auth } = getFirebaseServices();
    try {
      return isSignInWithEmailLink(auth, link);
    } catch {
      return false;
    }
  }

  async completeEmailLinkSignIn(
    link: string,
    emailConfirm?: string,
  ): Promise<EmailLinkSignInResult> {
    const { auth } = getFirebaseServices();

    if (!this.isSignInWithEmailLink(link)) {
      throw new ApplicationError({
        code: ApplicationErrorCode.Authentication,
        originalError: null,
        retryable: true,
        retryGuidance: "Please use the latest link sent to your email or request a new one.",
        userMessage: "The provided link is not a valid Karri sign-in link.",
      });
    }

    let email = emailConfirm?.trim().toLowerCase();
    if (!email) {
      const pending = await this.pendingStorage.getPendingEmail();
      if (pending?.email) {
        email = pending.email;
      }
    }

    if (!email) {
      throw new ApplicationError({
        code: ApplicationErrorCode.Validation,
        originalError: null,
        retryable: false,
        retryGuidance: "Please confirm your email address to complete sign-in.",
        userMessage: "Email address is required to complete sign-in.",
      });
    }

    const currentUser = auth.currentUser;
    const isAnonymousUpgrade = Boolean(currentUser && currentUser.isAnonymous);

    if (isAnonymousUpgrade && currentUser) {
      const originalUid = currentUser.uid;
      try {
        const credential = EmailAuthProvider.credentialWithLink(email, link);
        const userCredential = await linkWithCredential(currentUser, credential);
        const upgradedUser = userCredential.user;

        if (upgradedUser.uid !== originalUid) {
          throw new Error("Account upgrade violated UID preservation invariant.");
        }

        await this.pendingStorage.clearPendingEmail();
        const authorization = await mapAuthorization(upgradedUser);
        return {
          session: {
            identity: mapIdentity(upgradedUser),
            authorization,
          },
          isUpgrade: true,
        };
      } catch (error) {
        throw mapEmailAuthError(
          error,
          "Could not upgrade your Karri account with this email link.",
        );
      }
    } else {
      try {
        const userCredential = await signInWithEmailLink(auth, email, link);
        const user = userCredential.user;
        await this.pendingStorage.clearPendingEmail();
        const authorization = await mapAuthorization(user);
        return {
          session: {
            identity: mapIdentity(user),
            authorization,
          },
          isUpgrade: false,
        };
      } catch (error) {
        throw mapEmailAuthError(error, "Could not sign in with this email link.");
      }
    }
  }

  async getPendingEmail(): Promise<string | null> {
    const record = await this.pendingStorage.getPendingEmail();
    return record?.email ?? null;
  }

  async clearPendingEmail(): Promise<void> {
    await this.pendingStorage.clearPendingEmail();
  }

  async signOut(expectedUserId: string | null): Promise<void> {
    const { auth } = getFirebaseServices();
    const currentUserId = auth.currentUser?.uid ?? null;

    if (currentUserId !== expectedUserId || !auth.currentUser) {
      return;
    }

    await signOut(auth);
  }

  async refreshAuthorization(): Promise<{ readonly uid: string; readonly role: AuthorizationRole } | null> {
    const { auth } = getFirebaseServices();
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    // Surface refresh failure without silently downgrading to normal user role if network fails.
    const tokenResult = await user.getIdTokenResult(true);
    return {
      uid: user.uid,
      role: normalizeAuthorizationRole(tokenResult.claims.role),
    };
  }

  subscribe(
    onChange: (session: AuthenticatedSession | null) => void,
    onError: (error: unknown) => void,
  ): () => void {
    const { auth } = getFirebaseServices();
    let generation = 0;
    let active = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        generation += 1;
        const currentGen = generation;

        if (!user) {
          onChange(null);
          return;
        }

        void mapAuthorization(user)
          .then((authSession) => {
            if (active && currentGen === generation) {
              onChange({
                identity: mapIdentity(user),
                authorization: authSession,
              });
            }
          })
          .catch(() => {
            if (active && currentGen === generation) {
              // Fail closed to normal user role if loading claims fails
              onChange({
                identity: mapIdentity(user),
                authorization: { role: "user" },
              });
            }
          });
      },
      onError,
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }
}
