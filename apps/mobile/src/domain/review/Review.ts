import type { DomainEntity } from "../shared/Entity";

export type ReviewDirection = "sender_reviews_traveler" | "traveler_reviews_sender";

export interface Review extends DomainEntity {
  readonly bookingId: string;
  readonly reviewerId: string;
  readonly revieweeId: string;
  readonly direction: ReviewDirection;
  readonly rating: number;
  readonly comment: string;
}

export type NewReview = Omit<Review, "id" | "createdAt" | "updatedAt">;
