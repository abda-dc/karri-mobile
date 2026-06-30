import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { TrustRepository } from "../../../domain/trust/TrustRepository";
import type { TrustScore } from "../../../domain/trust/TrustScore";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import { mapTrustScore, toFirestoreTrustScore } from "../mappers/trustMapper";

export class FirebaseTrustRepository implements TrustRepository {
  async findByUserId(userId: string): Promise<TrustScore | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "trustScores", userId));
    return snapshot.exists() ? mapTrustScore(snapshot) : null;
  }

  async save(score: TrustScore): Promise<TrustScore> {
    const { db } = getFirebaseServices();
    const reference = doc(db, "trustScores", score.userId);
    await firebaseOfflineStatusGateway.trackWrite(() =>
      setDoc(reference, {
        ...toFirestoreTrustScore(score),
        serverCalculatedAt: serverTimestamp(),
      }),
    );
    return mapTrustScore(await getDoc(reference));
  }
}
