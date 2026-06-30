import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { NewReview, Review } from "../../../domain/review/Review";
import type { ReviewRepository } from "../../../domain/review/ReviewRepository";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import { mapReview, toFirestoreReview } from "../mappers/reviewMapper";

export class FirebaseReviewRepository implements ReviewRepository {
  async create(review: NewReview): Promise<Review> {
    const { db } = getFirebaseServices();
    const reference = doc(
      db,
      "reviews",
      `${review.bookingId}__${review.reviewerId}__${review.revieweeId}`,
    );
    await firebaseOfflineStatusGateway.trackWrite(() =>
      setDoc(reference, {
        ...toFirestoreReview(review),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    return mapReview(await getDoc(reference));
  }

  async listByBooking(bookingId: string): Promise<ReadonlyArray<Review>> {
    const { db } = getFirebaseServices();
    const snapshot = await getDocs(
      query(collection(db, "reviews"), where("bookingId", "==", bookingId)),
    );
    return snapshot.docs.map(mapReview);
  }

  async listByReviewee(revieweeId: string): Promise<ReadonlyArray<Review>> {
    const { db } = getFirebaseServices();
    const snapshot = await getDocs(
      query(collection(db, "reviews"), where("subjectId", "==", revieweeId)),
    );
    return snapshot.docs.map(mapReview);
  }
}
