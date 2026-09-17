import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type { UserReputation } from "../../../domain/review/UserReputation";
import {
  numberValue,
  snapshotData,
  stringValue,
  toDomainTimestamp,
} from "./firestoreValues";

export function mapUserReputation(snapshot: DocumentSnapshot<DocumentData>): UserReputation {
  const data = snapshotData(snapshot);
  const dist = (data.distribution ?? {}) as Record<string, unknown>;

  return {
    userId: stringValue(data.userId || snapshot.id),
    averageRating:
      data.averageRating !== null && data.averageRating !== undefined
        ? numberValue(data.averageRating)
        : null,
    reviewCount: numberValue(data.reviewCount),
    distribution: {
      1: numberValue(dist["1"]),
      2: numberValue(dist["2"]),
      3: numberValue(dist["3"]),
      4: numberValue(dist["4"]),
      5: numberValue(dist["5"]),
    },
    completedBookingsCount: numberValue(data.completedBookingsCount),
    cancelledBookingsCount: numberValue(data.cancelledBookingsCount),
    completionRate:
      data.completionRate !== null && data.completionRate !== undefined
        ? numberValue(data.completionRate)
        : null,
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}
