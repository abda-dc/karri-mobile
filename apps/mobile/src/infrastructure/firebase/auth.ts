import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from "firebase/auth";
import type {
  AuthIdentity,
  AuthorizationSession,
  AuthenticatedSession,
  AuthSessionGateway,
} from "../../application/services/AuthSessionService";
import { getFirebaseServices, isFirebaseConfigured } from "./client";
import { normalizeAuthorizationRole, type AuthorizationRole } from "../../domain/authorization/roles";
import { ApplicationError, ApplicationErrorCode } from "../../application/errors/ApplicationError";

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

export class FirebaseAuthSessionGateway implements AuthSessionGateway {
  readonly configured = isFirebaseConfigured;

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

  async signOut(): Promise<void> {
    const { auth } = getFirebaseServices();
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
