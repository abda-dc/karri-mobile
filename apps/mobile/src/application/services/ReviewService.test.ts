import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewService } from "./ReviewService";
import { BookingStatus } from "../../domain/booking/Booking";
import type { BookingRepository } from "../../domain/booking/BookingRepository";
import type { ReviewRepository } from "../../domain/review/ReviewRepository";
import type { ReputationRepository } from "../../domain/review/ReputationRepository";
import type { EventPublisher } from "../../domain/events/DomainEvent";

describe("ReviewService (R10 Post-Delivery Review & Reputation Integrity)", () => {
  const mockReviewRepository = {
    create: vi.fn(),
    listByBooking: vi.fn(),
    listByReviewee: vi.fn(),
  } as unknown as ReviewRepository;

  const mockBookingRepository = {
    findById: vi.fn(),
  } as unknown as BookingRepository;

  const mockEvents = {
    publish: vi.fn(),
  } as unknown as EventPublisher;

  const mockReputationRepository = {
    findById: vi.fn(),
    watchById: vi.fn(),
  } as unknown as ReputationRepository;

  const clock = { now: () => "2026-09-16T12:00:00Z" };

  const service = new ReviewService(
    mockReviewRepository,
    mockBookingRepository,
    mockEvents,
    clock,
    mockReputationRepository,
  );

  const completedBooking = {
    id: "booking-comp-1",
    shipmentId: "ship-1",
    senderId: "sender-1",
    travelerId: "traveler-1",
    status: BookingStatus.Completed,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Review Eligibility & Directionality", () => {
    it("allows sender to review traveler on a completed booking", async () => {
      vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(completedBooking as any);
      vi.mocked(mockReviewRepository.listByBooking).mockResolvedValueOnce([]);
      vi.mocked(mockReviewRepository.create).mockResolvedValueOnce({
        id: "rev-1",
        bookingId: completedBooking.id,
        reviewerId: "sender-1",
        revieweeId: "traveler-1",
        direction: "sender_reviews_traveler",
        rating: 5,
        comment: "Great experience",
        createdAt: "2026-09-16T12:00:00Z",
        updatedAt: "2026-09-16T12:00:00Z",
      });

      const review = await service.submit({
        bookingId: completedBooking.id,
        reviewerId: "sender-1",
        revieweeId: "traveler-1",
        direction: "sender_reviews_traveler",
        rating: 5,
        comment: "Great experience",
      });

      expect(review.id).toBe("rev-1");
      expect(mockReviewRepository.create).toHaveBeenCalledWith({
        bookingId: completedBooking.id,
        reviewerId: "sender-1",
        revieweeId: "traveler-1",
        direction: "sender_reviews_traveler",
        rating: 5,
        comment: "Great experience",
      });
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: "review.submitted" }),
      );
    });

    it("allows traveler to review sender on a completed booking", async () => {
      vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(completedBooking as any);
      vi.mocked(mockReviewRepository.listByBooking).mockResolvedValueOnce([]);
      vi.mocked(mockReviewRepository.create).mockResolvedValueOnce({
        id: "rev-2",
        bookingId: completedBooking.id,
        reviewerId: "traveler-1",
        revieweeId: "sender-1",
        direction: "traveler_reviews_sender",
        rating: 4,
        comment: "Prompt handoff",
        createdAt: "2026-09-16T12:00:00Z",
        updatedAt: "2026-09-16T12:00:00Z",
      });

      const review = await service.submit({
        bookingId: completedBooking.id,
        reviewerId: "traveler-1",
        revieweeId: "sender-1",
        direction: "traveler_reviews_sender",
        rating: 4,
        comment: "Prompt handoff",
      });

      expect(review.id).toBe("rev-2");
    });

    it("rejects reviews on bookings that are not completed (e.g. pending, in_transit, delivered)", async () => {
      const nonCompleted = [
        BookingStatus.Pending,
        BookingStatus.Accepted,
        BookingStatus.InTransit,
        BookingStatus.Delivered,
        BookingStatus.Cancelled,
        BookingStatus.Declined,
      ];

      for (const status of nonCompleted) {
        vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({
          ...completedBooking,
          status,
        } as any);

        await expect(
          service.submit({
            bookingId: completedBooking.id,
            reviewerId: "sender-1",
            revieweeId: "traveler-1",
            direction: "sender_reviews_traveler",
            rating: 5,
          }),
        ).rejects.toThrow("Reviews require a completed booking.");
      }
    });

    it("rejects self-reviews (reviewer == reviewee)", async () => {
      vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(completedBooking as any);

      await expect(
        service.submit({
          bookingId: completedBooking.id,
          reviewerId: "sender-1",
          revieweeId: "sender-1",
          direction: "sender_reviews_traveler",
          rating: 5,
        }),
      ).rejects.toThrow("Reviews must be between the two booking participants.");
    });

    it("rejects third-party reviewers not part of the booking", async () => {
      vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(completedBooking as any);

      await expect(
        service.submit({
          bookingId: completedBooking.id,
          reviewerId: "stranger-99",
          revieweeId: "traveler-1",
          direction: "sender_reviews_traveler",
          rating: 5,
        }),
      ).rejects.toThrow("Reviews must be between the two booking participants.");
    });

    it("rejects mismatched direction (e.g. sender using traveler_reviews_sender)", async () => {
      vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(completedBooking as any);

      await expect(
        service.submit({
          bookingId: completedBooking.id,
          reviewerId: "sender-1",
          revieweeId: "traveler-1",
          direction: "traveler_reviews_sender",
          rating: 5,
        }),
      ).rejects.toThrow("Review direction does not match the booking participants.");
    });
  });

  describe("Rating Constraints & Validation", () => {
    it("rejects non-integer ratings", async () => {
      vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(completedBooking as any);

      await expect(
        service.submit({
          bookingId: completedBooking.id,
          reviewerId: "sender-1",
          revieweeId: "traveler-1",
          direction: "sender_reviews_traveler",
          rating: 4.5,
        }),
      ).rejects.toThrow("Review rating must be an integer from 1 to 5.");
    });

    it("rejects ratings below 1 or above 5", async () => {
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(completedBooking as any);

      await expect(
        service.submit({
          bookingId: completedBooking.id,
          reviewerId: "sender-1",
          revieweeId: "traveler-1",
          direction: "sender_reviews_traveler",
          rating: 0,
        }),
      ).rejects.toThrow("Review rating must be an integer from 1 to 5.");

      await expect(
        service.submit({
          bookingId: completedBooking.id,
          reviewerId: "sender-1",
          revieweeId: "traveler-1",
          direction: "sender_reviews_traveler",
          rating: 6,
        }),
      ).rejects.toThrow("Review rating must be an integer from 1 to 5.");
    });
  });

  describe("Duplicate Review & Idempotency", () => {
    it("idempotently returns existing review and suppresses duplicate event when already submitted", async () => {
      const existingReview = {
        id: "rev-existing",
        bookingId: completedBooking.id,
        reviewerId: "sender-1",
        revieweeId: "traveler-1",
        direction: "sender_reviews_traveler" as const,
        rating: 5,
        comment: "First review",
        createdAt: "2026-09-16T12:00:00Z",
        updatedAt: "2026-09-16T12:00:00Z",
      };

      vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(completedBooking as any);
      vi.mocked(mockReviewRepository.listByBooking).mockResolvedValueOnce([existingReview]);

      const result = await service.submit({
        bookingId: completedBooking.id,
        reviewerId: "sender-1",
        revieweeId: "traveler-1",
        direction: "sender_reviews_traveler",
        rating: 5,
        comment: "First review",
      });

      expect(result.id).toBe("rev-existing");
      expect(mockReviewRepository.create).not.toHaveBeenCalled();
      expect(mockEvents.publish).not.toHaveBeenCalled();
    });

    it("ensures duplicate same-direction review submissions produce exactly one review", async () => {
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(completedBooking as any);
      const createdReview = {
        id: "rev-single",
        bookingId: completedBooking.id,
        reviewerId: "sender-1",
        revieweeId: "traveler-1",
        direction: "sender_reviews_traveler" as const,
        rating: 5,
        comment: "Great experience",
        createdAt: "2026-09-16T12:00:00Z",
        updatedAt: "2026-09-16T12:00:00Z",
      };

      // First call finds no existing reviews and creates one
      vi.mocked(mockReviewRepository.listByBooking).mockResolvedValueOnce([]);
      vi.mocked(mockReviewRepository.create).mockResolvedValueOnce(createdReview);

      const first = await service.submit({
        bookingId: completedBooking.id,
        reviewerId: "sender-1",
        revieweeId: "traveler-1",
        direction: "sender_reviews_traveler",
        rating: 5,
        comment: "Great experience",
      });

      // Second call finds the existing review and returns it idempotently
      vi.mocked(mockReviewRepository.listByBooking).mockResolvedValueOnce([createdReview]);

      const second = await service.submit({
        bookingId: completedBooking.id,
        reviewerId: "sender-1",
        revieweeId: "traveler-1",
        direction: "sender_reviews_traveler",
        rating: 5,
        comment: "Great experience",
      });

      expect(first.id).toBe("rev-single");
      expect(second.id).toBe("rev-single");
      expect(mockReviewRepository.create).toHaveBeenCalledTimes(1);
      expect(mockEvents.publish).toHaveBeenCalledTimes(1);
    });

    it("simultaneous same-direction review submissions result in exactly one review created and no duplicate events", async () => {
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(completedBooking as any);
      const createdReview = {
        id: "rev-concurrent",
        bookingId: completedBooking.id,
        reviewerId: "sender-1",
        revieweeId: "traveler-1",
        direction: "sender_reviews_traveler" as const,
        rating: 5,
        comment: "Simultaneous test",
        createdAt: "2026-09-16T12:00:00Z",
        updatedAt: "2026-09-16T12:00:00Z",
      };

      let created = false;
      vi.mocked(mockReviewRepository.create).mockImplementation(async () => {
        created = true;
        return createdReview;
      });
      vi.mocked(mockReviewRepository.listByBooking).mockImplementation(async () => {
        return created ? [createdReview] : [];
      });

      const [res1, res2] = await Promise.all([
        service.submit({
          bookingId: completedBooking.id,
          reviewerId: "sender-1",
          revieweeId: "traveler-1",
          direction: "sender_reviews_traveler",
          rating: 5,
          comment: "Simultaneous test 1",
        }),
        service.submit({
          bookingId: completedBooking.id,
          reviewerId: "sender-1",
          revieweeId: "traveler-1",
          direction: "sender_reviews_traveler",
          rating: 5,
          comment: "Simultaneous test 2",
        }),
      ]);

      expect(res1.id).toBe("rev-concurrent");
      expect(res2.id).toBe("rev-concurrent");
      expect(mockReviewRepository.create).toHaveBeenCalledTimes(1);
      expect(mockEvents.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe("Server-Derived Reputation Integration", () => {
    it("retrieves reputation from reputation repository when available", async () => {
      const mockReputation = {
        userId: "traveler-1",
        averageRating: 4.8,
        reviewCount: 10,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 8 },
        completedBookingsCount: 15,
        cancelledBookingsCount: 0,
        completionRate: 1.0,
        updatedAt: "2026-09-16T12:00:00Z",
      };

      vi.mocked(mockReputationRepository.findById).mockResolvedValueOnce(mockReputation);

      const rep = await service.getReputation("traveler-1");
      expect(rep).toEqual(mockReputation);
      expect(mockReputationRepository.findById).toHaveBeenCalledWith("traveler-1");
    });

    it("returns null if reputation repository has no record and does not fabricate completion stats", async () => {
      vi.mocked(mockReputationRepository.findById).mockResolvedValueOnce(null);

      const rep = await service.getReputation("traveler-1");
      expect(rep).toBeNull();
      // Verifies client does NOT fabricate completedBookingsCount or completionRate
    });

    it("returns null when no reputation repository is configured", async () => {
      const serviceWithoutRepo = new ReviewService(
        mockReviewRepository,
        mockBookingRepository,
        mockEvents,
        clock,
        undefined,
      );

      const rep = await serviceWithoutRepo.getReputation("brand-new-user");
      expect(rep).toBeNull();
    });
  });
});
