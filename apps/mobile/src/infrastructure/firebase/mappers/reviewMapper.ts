import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type { NewReview, Review } from "../../../domain/review/Review";
import {
  numberValue,
  snapshotData,
  stringValue,
  toDomainTimestamp,
  toFirestoreTimestamp,
} from "./firestoreValues";

export function mapReview(snapshot: DocumentSnapshot<DocumentData>): Review {
  const data = snapshotData(snapshot);

  return {
    id: snapshot.id,
    bookingId: stringValue(data.bookingId),
    reviewerId: stringValue(data.reviewerId),
    revieweeId: stringValue(data.subjectId),
    direction: data.direction as Review["direction"],
    rating: numberValue(data.rating),
    comment: stringValue(data.comment),
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreReview(review: NewReview | Review): DocumentData {
  const timestamps = "createdAt" in review
    ? {
        createdAt: toFirestoreTimestamp(review.createdAt),
        updatedAt: toFirestoreTimestamp(review.updatedAt),
      }
    : {};

  return {
    bookingId: review.bookingId,
    reviewerId: review.reviewerId,
    subjectId: review.revieweeId,
    direction: review.direction,
    rating: review.rating,
    comment: review.comment,
    ...timestamps,
  };
}
