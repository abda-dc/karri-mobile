import type { CalculateTrustDto } from "../dto/commands";
import { TrustCalculator } from "../../domain/trust/TrustCalculator";
import type { TrustRepository } from "../../domain/trust/TrustRepository";
import type { TrustScore } from "../../domain/trust/TrustScore";
import type { TrustSummary, VerificationLevel } from "../../domain/trust/TrustScore";
import type { Booking } from "../../domain/booking/Booking";
import { BookingStatus } from "../../domain/booking/Booking";
import type { ReviewRepository } from "../../domain/review/ReviewRepository";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import { DomainValidationError, requireText } from "./validation";

export class TrustService {
  constructor(
    private readonly trustScores: TrustRepository,
    private readonly reviews: ReviewRepository,
    private readonly calculator: TrustCalculator = new TrustCalculator(),
    private readonly clock: Clock = systemClock,
  ) {}

  async getVisibleSummary(
    userId: string,
    context: {
      readonly bookings?: ReadonlyArray<Booking>;
      readonly accountCreatedAt?: string | null;
      readonly verificationLevel?: VerificationLevel;
    } = {},
  ): Promise<TrustSummary> {
    const reviews = await this.reviews.listByReviewee(userId);
    const averageReview =
      reviews.length === 0
        ? null
        : reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
    const visibleCompletedBookingIds = new Set(reviews.map((review) => review.bookingId));
    const bookings = context.bookings?.filter(
      (booking) => booking.senderId === userId || booking.travelerId === userId,
    );
    const accountCreatedAt = context.accountCreatedAt
      ? new Date(context.accountCreatedAt).getTime()
      : Number.NaN;
    const accountAgeDays = Number.isFinite(accountCreatedAt)
      ? Math.max(0, Math.floor((Date.now() - accountCreatedAt) / 86_400_000))
      : 0;
    const inputs = {
      completedDeliveries: bookings
        ? bookings.filter((booking) => booking.status === BookingStatus.Completed).length
        : visibleCompletedBookingIds.size,
      cancellations: bookings
        ? bookings.filter((booking) => booking.status === BookingStatus.Cancelled).length
        : 0,
      averageReview: averageReview === null ? null : Math.round(averageReview * 100) / 100,
      reviewCount: reviews.length,
      accountAgeDays,
      verificationLevel: context.verificationLevel ?? "none",
    } as const;

    return {
      score: this.calculator.calculate(userId, inputs, this.clock.now()),
      inputs,
      evidenceScope: bookings ? "participant_history" : "reviews_only",
    };
  }

  async calculate(input: CalculateTrustDto): Promise<TrustScore> {
    const userId = requireText(input.userId, "userId", 128);
    const values = [
      input.inputs.completedDeliveries,
      input.inputs.cancellations,
      input.inputs.reviewCount,
      input.inputs.accountAgeDays,
    ];

    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new DomainValidationError("Trust inputs must be finite, non-negative values.");
    }

    if (
      input.inputs.averageReview !== null &&
      (!Number.isFinite(input.inputs.averageReview) ||
        input.inputs.averageReview < 1 ||
        input.inputs.averageReview > 5)
    ) {
      throw new DomainValidationError("averageReview must be null or a value from 1 to 5.");
    }

    return this.trustScores.save(
      this.calculator.calculate(userId, input.inputs, this.clock.now()),
    );
  }
}
