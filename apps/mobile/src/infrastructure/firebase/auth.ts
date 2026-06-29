import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import {
  FirebaseConfigurationError,
  getFirebaseServices,
} from "./client";

export interface AuthIdentity {
  readonly uid: string;
  readonly createdAt: string | null;
  readonly isAnonymous: boolean;
}

function mapIdentity(user: { uid: string; isAnonymous: boolean; metadata: { creationTime?: string } }): AuthIdentity {
  return {
    uid: user.uid,
    createdAt: user.metadata.creationTime ?? null,
    isAnonymous: user.isAnonymous,
  };
}

export function getFriendlyAuthError(error: unknown): string {
  if (error instanceof FirebaseConfigurationError) {
    return error.message;
  }

  if (typeof error === "object" && error && "code" in error) {
    const code = String(error.code);

    if (code === "auth/operation-not-allowed") {
      return "Anonymous authentication is not enabled for this Firebase project yet.";
    }

    if (code === "auth/network-request-failed") {
      return "Karri could not reach Firebase. Check your connection and try again.";
    }
  }

  return "Karri could not start your session. Please try again.";
}

export async function startMvpAuthSession(): Promise<AuthIdentity> {
  const { auth } = getFirebaseServices();

  if (auth.currentUser) {
    return mapIdentity(auth.currentUser);
  }

  const credential = await signInAnonymously(auth);
  return mapIdentity(credential.user);
}

export async function signOutCurrentUser(): Promise<void> {
  const { auth } = getFirebaseServices();
  await signOut(auth);
}

export function subscribeToAuthSession(
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
