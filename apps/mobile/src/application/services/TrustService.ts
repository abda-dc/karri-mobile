import type { CalculateTrustDto } from "../dto/commands";
import { TrustCalculator } from "../../domain/trust/TrustCalculator";
import type { TrustRepository } from "../../domain/trust/TrustRepository";
import type { TrustScore } from "../../domain/trust/TrustScore";
import type { TrustSummary, VerificationLevel } from "../../domain/trust/TrustScore";
import type { Booking } from "../../domain/booking/Booking";
import { BookingStatus } from "../../domain/booking/Booking";
import type { ReviewRepository } from "../../domain/review/ReviewRepository";
import type { ReputationRepository } from "../../domain/review/ReputationRepository";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import { DomainValidationError, requireText } from "./validation";

export class TrustService {
  constructor(
    private readonly trustScores: TrustRepository,
    private readonly reviews: ReviewRepository,
    private readonly calculator: TrustCalculator = new TrustCalculator(),
    private readonly clock: Clock = systemClock,
    private readonly reputationRepo?: ReputationRepository,
  ) {}

  async getVisibleSummary(
    userId: string,
    context: {
      readonly bookings?: ReadonlyArray<Booking>;
      readonly accountCreatedAt?: string | null;
      readonly verificationLevel?: VerificationLevel;
    } = {},
  ): Promise<TrustSummary> {
    const calculatedAt = this.clock.now();

    let averageReview: number | null = null;
    let reviewCount = 0;
    let completedDeliveriesCount: number | null = null;
    let cancellationsCount: number | null = null;

    if (this.reputationRepo) {
      const rep = await this.reputationRepo.findById(userId);
      if (rep) {
        averageReview = rep.averageRating;
        reviewCount = rep.reviewCount;
        completedDeliveriesCount = rep.completedBookingsCount;
        cancellationsCount = rep.cancelledBookingsCount;
      }
    }

    let visibleCompletedBookingIds = new Set<string>();
    if (averageReview === null && reviewCount === 0) {
      const reviews = await this.reviews.listByReviewee(userId);
      averageReview =
        reviews.length === 0
          ? null
          : Math.round((reviews.reduce((total, review) => total + review.rating, 0) / reviews.length) * 100) / 100;
      reviewCount = reviews.length;
      visibleCompletedBookingIds = new Set(reviews.map((review) => review.bookingId));
    }

    const hasParticipantContext =
      context.bookings !== undefined ||
      context.accountCreatedAt !== undefined ||
      context.verificationLevel !== undefined;
    const bookings = context.bookings?.filter(
      (booking) => booking.senderId === userId || booking.travelerId === userId,
    );
    const accountCreatedAt = context.accountCreatedAt
      ? new Date(context.accountCreatedAt).getTime()
      : Number.NaN;
    const calculationTime = new Date(calculatedAt).getTime();
    const accountAgeDays =
      Number.isFinite(accountCreatedAt) && Number.isFinite(calculationTime)
      ? Math.max(
          0,
          Math.floor((calculationTime - accountCreatedAt) / 86_400_000),
        )
      : 0;
    const inputs = {
      completedDeliveries: bookings
        ? bookings.filter((booking) => booking.status === BookingStatus.Completed).length
        : (completedDeliveriesCount ?? visibleCompletedBookingIds.size),
      cancellations: bookings
        ? bookings.filter((booking) => booking.status === BookingStatus.Cancelled).length
        : (cancellationsCount ?? 0),
      averageReview,
      reviewCount,
      accountAgeDays,
      verificationLevel: context.verificationLevel ?? "none",
    } as const;

    return {
      score: this.calculator.calculate(userId, inputs, calculatedAt),
      inputs,
      evidenceScope: hasParticipantContext
        ? "participant_history"
        : "reviews_only",
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
