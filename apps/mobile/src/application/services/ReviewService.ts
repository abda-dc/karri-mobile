import type { SubmitReviewDto } from "../dto/commands";
import { BookingStatus } from "../../domain/booking/Booking";
import type { BookingRepository } from "../../domain/booking/BookingRepository";
import type { EventPublisher } from "../../domain/events/DomainEvent";
import {
  createPlatformEvent,
  type ReviewSubmitted,
} from "../../domain/events/platformEvents";
import type { Review } from "../../domain/review/Review";
import type { ReviewRepository } from "../../domain/review/ReviewRepository";
import type { UserReputation } from "../../domain/review/UserReputation";
import type { ReputationRepository } from "../../domain/review/ReputationRepository";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import { DomainValidationError, optionalText } from "./validation";

export class ReviewService {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly bookings: BookingRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock = systemClock,
    private readonly reputationRepo?: ReputationRepository,
  ) {}

  async submit(input: SubmitReviewDto): Promise<Review> {
    const booking = await this.bookings.findById(input.bookingId);

    if (!booking || booking.status !== BookingStatus.Completed) {
      throw new DomainValidationError("Reviews require a completed booking.");
    }

    const participants = [booking.senderId, booking.travelerId];
    if (
      input.reviewerId === input.revieweeId ||
      !participants.includes(input.reviewerId) ||
      !participants.includes(input.revieweeId)
    ) {
      throw new DomainValidationError("Reviews must be between the two booking participants.");
    }

    const expectedDirection =
      input.reviewerId === booking.senderId
        ? "sender_reviews_traveler"
        : "traveler_reviews_sender";

    if (input.direction !== expectedDirection) {
      throw new DomainValidationError("Review direction does not match the booking participants.");
    }

    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new DomainValidationError("Review rating must be an integer from 1 to 5.");
    }

    const existingReviews = await this.reviews.listByBooking(input.bookingId);
    const existing = existingReviews.find((review) => review.reviewerId === input.reviewerId);
    if (existing) {
      // Idempotent retry: return existing review without publishing duplicate event
      return existing;
    }

    const review = await this.reviews.create({
      bookingId: input.bookingId,
      reviewerId: input.reviewerId,
      revieweeId: input.revieweeId,
      direction: input.direction,
      rating: input.rating,
      comment: optionalText(input.comment ?? "", "comment", 1000),
    });
    const occurredAt = review.createdAt ?? this.clock.now();

    this.events.publish(
      createPlatformEvent<ReviewSubmitted>({
        type: "review.submitted",
        aggregateId: review.id,
        actorId: review.reviewerId,
        occurredAt,
        payload: { revieweeId: review.revieweeId, recipientIds: [review.revieweeId] },
      }),
    );

    return review;
  }

  async getAverageRating(revieweeId: string): Promise<{
    readonly average: number | null;
    readonly count: number;
  }> {
    const reviews = await this.reviews.listByReviewee(revieweeId);

    if (reviews.length === 0) {
      return { average: null, count: 0 };
    }

    const average = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
    return { average: Math.round(average * 100) / 100, count: reviews.length };
  }

  async getReputation(userId: string): Promise<UserReputation | null> {
    if (this.reputationRepo) {
      const persisted = await this.reputationRepo.findById(userId);
      if (persisted) {
        return persisted;
      }
    }

    // Fallback: derive dynamically from reviews if server cache not yet populated
    const reviews = await this.reviews.listByReviewee(userId);
    if (reviews.length === 0) {
      return null;
    }

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of reviews) {
      if (r.rating >= 1 && r.rating <= 5) {
        dist[r.rating as keyof typeof dist] += 1;
        sum += r.rating;
      }
    }

    return {
      userId,
      averageRating: Math.round((sum / reviews.length) * 100) / 100,
      reviewCount: reviews.length,
      distribution: dist,
      completedBookingsCount: reviews.length,
      cancelledBookingsCount: 0,
      completionRate: 1,
      updatedAt: this.clock.now(),
    };
  }

  watchReputation(
    userId: string,
    onData: (reputation: UserReputation | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    if (this.reputationRepo) {
      return this.reputationRepo.watchById(userId, onData, onError);
    }
    // Fallback: fetch once
    this.getReputation(userId)
      .then(onData)
      .catch(onError);
    return () => {};
  }

  listForBooking(bookingId: string): Promise<ReadonlyArray<Review>> {
    return this.reviews.listByBooking(bookingId);
  }
}
