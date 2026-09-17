import { doc, getDoc, onSnapshot } from "firebase/firestore";
import type { UserReputation } from "../../../domain/review/UserReputation";
import type { ReputationRepository } from "../../../domain/review/ReputationRepository";
import { getFirebaseServices } from "../client";
import { mapUserReputation } from "../mappers/reputationMapper";

export class FirebaseReputationRepository implements ReputationRepository {
  async findById(userId: string): Promise<UserReputation | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "userReputations", userId));
    return snapshot.exists() ? mapUserReputation(snapshot) : null;
  }

  watchById(
    userId: string,
    onData: (reputation: UserReputation | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    return onSnapshot(
      doc(db, "userReputations", userId),
      (snapshot) => {
        onData(snapshot.exists() ? mapUserReputation(snapshot) : null);
      },
      onError,
    );
  }
}
