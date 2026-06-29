import type { NewReview, Review } from "./Review";

export interface ReviewRepository {
  create(review: NewReview): Promise<Review>;
  listByBooking(bookingId: string): Promise<ReadonlyArray<Review>>;
  listByReviewee(revieweeId: string): Promise<ReadonlyArray<Review>>;
}
