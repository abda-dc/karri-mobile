import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { NewReview, Review } from "../../../domain/review/Review";
import type { ReviewRepository } from "../../../domain/review/ReviewRepository";
import { getFirebaseServices } from "../client";
import { mapReview, toFirestoreReview } from "../mappers/reviewMapper";

export class FirebaseReviewRepository implements ReviewRepository {
  async create(review: NewReview): Promise<Review> {
    const { db } = getFirebaseServices();
    const reference = await addDoc(collection(db, "reviews"), {
      ...toFirestoreReview(review),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
