import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import type {
  AuthIdentity,
  AuthSessionGateway,
} from "../../application/services/AuthSessionService";
import { getFirebaseServices, isFirebaseConfigured } from "./client";

function mapIdentity(user: { uid: string; isAnonymous: boolean; metadata: { creationTime?: string } }): AuthIdentity {
  return {
    uid: user.uid,
    createdAt: user.metadata.creationTime ?? null,
    isAnonymous: user.isAnonymous,
  };
}

export class FirebaseAuthSessionGateway implements AuthSessionGateway {
  readonly configured = isFirebaseConfigured;

  async startMvpSession(): Promise<AuthIdentity> {
    const { auth } = getFirebaseServices();

    if (auth.currentUser) {
      return mapIdentity(auth.currentUser);
    }

    const credential = await signInAnonymously(auth);
    return mapIdentity(credential.user);
  }

  async signOut(): Promise<void> {
    const { auth } = getFirebaseServices();
    await signOut(auth);
  }

  subscribe(
    onChange: (identity: AuthIdentity | null) => void,
    onError: (error: unknown) => void,
  ): () => void {
    const { auth } = getFirebaseServices();
    return onAuthStateChanged(
      auth,
      (user) => onChange(user ? mapIdentity(user) : null),
      onError,
    );
  }
}
