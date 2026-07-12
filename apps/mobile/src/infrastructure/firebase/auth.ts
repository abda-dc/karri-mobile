import { onAuthStateChanged, signInAnonymously, signOut, type User as FirebaseUser } from "firebase/auth";
import type {
  AuthIdentity,
  AuthorizationSession,
  AuthenticatedSession,
  AuthSessionGateway,
} from "../../application/services/AuthSessionService";
import { getFirebaseServices, isFirebaseConfigured } from "./client";
import { normalizeAuthorizationRole } from "../../domain/authorization/roles";

function mapIdentity(user: FirebaseUser): AuthIdentity {
  return {
    uid: user.uid,
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

  async signOut(): Promise<void> {
    const { auth } = getFirebaseServices();
    await signOut(auth);
  }

  async refreshAuthorization(): Promise<AuthorizationSession | null> {
    const { auth } = getFirebaseServices();
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    // Surface refresh failure without silently downgrading to normal user role if network fails.
    const tokenResult = await user.getIdTokenResult(true);
    return {
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
