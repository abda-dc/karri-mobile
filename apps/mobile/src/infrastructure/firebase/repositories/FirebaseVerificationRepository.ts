import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { IdentityVerification } from "../../../domain/identity/IdentityVerification";
import type { VerificationRepository } from "../../../domain/identity/VerificationRepository";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import {
  mapIdentityVerification,
  toFirestoreIdentityVerification,
} from "../mappers/identityVerificationMapper";
import { toFirestoreTimestamp } from "../mappers/firestoreValues";

export class FirebaseVerificationRepository implements VerificationRepository {
  async findByUserId(userId: string): Promise<IdentityVerification | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "identityVerifications", userId));
    return snapshot.exists() ? mapIdentityVerification(snapshot) : null;
  }

  async save(verification: IdentityVerification): Promise<IdentityVerification> {
    if (verification.id !== verification.userId) {
      throw new Error("Identity verification ID must match its user ID.");
    }

    const { db } = getFirebaseServices();
    const reference = doc(db, "identityVerifications", verification.userId);
    const existing = await getDoc(reference);

    await firebaseOfflineStatusGateway.trackWrite(() =>
      setDoc(reference, {
        ...toFirestoreIdentityVerification(verification),
        createdAt: existing.exists()
          ? toFirestoreTimestamp(verification.createdAt)
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    return mapIdentityVerification(await getDoc(reference));
  }
}
