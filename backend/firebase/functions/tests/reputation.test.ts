import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import { ReputationService } from "../src/services/ReputationService.js";
import { getUserReputation, onBookingAccepted, onReviewCreated } from "../src/index.js";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "demo-karri-mobile",
  });
}

const db = admin.firestore();

describe("ReputationService & Aggregated Reputation (R10)", () => {
  const service = new ReputationService(db);
  const targetUserId = "traveler-target-123";

  beforeEach(async () => {
    const collections = ["reviews", "userReputations", "bookings"];
    for (const name of collections) {
      const snap = await db.collection(name).get();
      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
  });

  it("calculates accurate rating average and star distribution across multiple reviews", async () => {
    // Seed 3 reviews for target user: ratings 5, 4, 5
    await db.collection("reviews").doc("rev-1").set({
      bookingId: "b-1",
      reviewerId: "sender-1",
      subjectId: targetUserId,
      direction: "sender_reviews_traveler",
      rating: 5,
      comment: "Excellent service",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
    await db.collection("reviews").doc("rev-2").set({
      bookingId: "b-2",
      reviewerId: "sender-2",
      subjectId: targetUserId,
      direction: "sender_reviews_traveler",
      rating: 4,
      comment: "Very good",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
    await db.collection("reviews").doc("rev-3").set({
      bookingId: "b-3",
      reviewerId: "sender-3",
      subjectId: targetUserId,
      direction: "sender_reviews_traveler",
      rating: 5,
      comment: "Super fast",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Seed 2 completed bookings for completion rate
    await db.collection("bookings").doc("b-1").set({
      travelerId: targetUserId,
      senderId: "sender-1",
      status: "completed",
    });
    await db.collection("bookings").doc("b-2").set({
      travelerId: targetUserId,
      senderId: "sender-2",
      status: "completed",
    });

    const result = await service.updateUserReputation(targetUserId);

    expect(result.userId).toBe(targetUserId);
    expect(result.reviewCount).toBe(3);
    // (5 + 4 + 5) / 3 = 14 / 3 = 4.67
    expect(result.averageRating).toBe(4.67);
    expect(result.distribution).toEqual({
      1: 0,
      2: 0,
      3: 0,
      4: 1,
      5: 2,
    });
    expect(result.completedBookingsCount).toBe(2);
    expect(result.cancelledBookingsCount).toBe(0);
    expect(result.completionRate).toBe(1.0);

    // Verify written to Firestore userReputations collection
    const stored = await db.collection("userReputations").doc(targetUserId).get();
    expect(stored.exists).toBe(true);
    expect(stored.data()?.averageRating).toBe(4.67);
    expect(stored.data()?.reviewCount).toBe(3);
  });

  it("handles zero reviews gracefully with averageRating: null and reviewCount: 0", async () => {
    const freshUser = "fresh-user-456";
    const result = await service.updateUserReputation(freshUser);

    expect(result.userId).toBe(freshUser);
    expect(result.averageRating).toBeNull();
    expect(result.reviewCount).toBe(0);
    expect(result.distribution).toEqual({
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    });
    expect(result.completionRate).toBeNull();
  });

  it("computes completion rate correctly when cancellations exist", async () => {
    // 3 completed, 1 cancelled = 3/4 = 75%
    await db.collection("bookings").doc("b-c1").set({
      travelerId: targetUserId,
      senderId: "sender-1",
      status: "completed",
    });
    await db.collection("bookings").doc("b-c2").set({
      travelerId: targetUserId,
      senderId: "sender-2",
      status: "completed",
    });
    await db.collection("bookings").doc("b-c3").set({
      travelerId: targetUserId,
      senderId: "sender-3",
      status: "completed",
    });
    await db.collection("bookings").doc("b-cancel").set({
      travelerId: targetUserId,
      senderId: "sender-4",
      status: "cancelled",
    });

    const result = await service.updateUserReputation(targetUserId);
    expect(result.completedBookingsCount).toBe(3);
    expect(result.cancelledBookingsCount).toBe(1);
    expect(result.completionRate).toBe(0.75);
  });

  it("getUserReputation callable returns the calculated reputation record", async () => {
    await service.updateUserReputation(targetUserId);

    const callerUid = "caller-user-789";
    const result = await (getUserReputation.run as any)({
      data: { userId: targetUserId },
      auth: { uid: callerUid, token: {} },
    });

    expect(result).toBeDefined();
    expect(result.userId).toBe(targetUserId);
  });

  it("onBookingAccepted trigger recalculates reputation when booking status transitions to completed", async () => {
    // Seed a completed booking in firestore for targetUserId
    await db.collection("bookings").doc("b-completed-trig").set({
      travelerId: targetUserId,
      senderId: "sender-x",
      status: "completed",
    });

    const event = {
      params: { bookingId: "b-completed-trig" },
      data: {
        before: {
          data: () => ({
            status: "delivered",
            travelerId: targetUserId,
            senderId: "sender-x",
          }),
        },
        after: {
          data: () => ({
            status: "completed",
            travelerId: targetUserId,
            senderId: "sender-x",
          }),
        },
      },
    };

    await (onBookingAccepted.run as any)(event);

    const stored = await db.collection("userReputations").doc(targetUserId).get();
    expect(stored.exists).toBe(true);
    expect(stored.data()?.completedBookingsCount).toBe(1);
    expect(stored.data()?.completionRate).toBe(1.0);
  });

  it("onBookingAccepted trigger recalculates reputation when booking status transitions to cancelled", async () => {
    await db.collection("bookings").doc("b-cancelled-trig").set({
      travelerId: targetUserId,
      senderId: "sender-y",
      status: "cancelled",
    });

    const event = {
      params: { bookingId: "b-cancelled-trig" },
      data: {
        before: {
          data: () => ({
            status: "confirmed",
            travelerId: targetUserId,
            senderId: "sender-y",
          }),
        },
        after: {
          data: () => ({
            status: "cancelled",
            travelerId: targetUserId,
            senderId: "sender-y",
          }),
        },
      },
    };

    await (onBookingAccepted.run as any)(event);

    const stored = await db.collection("userReputations").doc(targetUserId).get();
    expect(stored.exists).toBe(true);
    expect(stored.data()?.cancelledBookingsCount).toBe(1);
    expect(stored.data()?.completionRate).toBe(0.0);
  });

  it("onReviewCreated trigger recalculates reputation when review document is created", async () => {
    await db.collection("reviews").doc("rev-trig-1").set({
      bookingId: "b-rev-1",
      reviewerId: "sender-z",
      subjectId: targetUserId,
      direction: "sender_reviews_traveler",
      rating: 5,
      comment: "Outstanding",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    const event = {
      params: { reviewId: "rev-trig-1" },
      data: {
        data: () => ({
          bookingId: "b-rev-1",
          reviewerId: "sender-z",
          subjectId: targetUserId,
          direction: "sender_reviews_traveler",
          rating: 5,
        }),
      },
    };

    await (onReviewCreated.run as any)(event);

    const stored = await db.collection("userReputations").doc(targetUserId).get();
    expect(stored.exists).toBe(true);
    expect(stored.data()?.reviewCount).toBe(1);
    expect(stored.data()?.averageRating).toBe(5);
    expect(stored.data()?.distribution[5]).toBe(1);
  });

  it("simultaneous same-direction review creation results in at most one review document, no duplicate reputation contribution, and no duplicate side effects", async () => {
    const bookingId = "b-concurrent-review";
    const reviewerId = "sender-conc";
    const reviewId = `${bookingId}__${reviewerId}__${targetUserId}`;

    await db.collection("bookings").doc(bookingId).set({
      travelerId: targetUserId,
      senderId: reviewerId,
      status: "completed",
    });

    const reviewRef = db.collection("reviews").doc(reviewId);

    // Simulate two simultaneous creation transactions
    const [res1, res2] = await Promise.all([
      db.runTransaction(async (tx) => {
        const snap = await tx.get(reviewRef);
        if (snap.exists) {
          return { created: false };
        }
        tx.set(reviewRef, {
          bookingId,
          reviewerId,
          subjectId: targetUserId,
          direction: "sender_reviews_traveler",
          rating: 5,
          comment: "Great service",
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });
        return { created: true };
      }),
      db.runTransaction(async (tx) => {
        const snap = await tx.get(reviewRef);
        if (snap.exists) {
          return { created: false };
        }
        tx.set(reviewRef, {
          bookingId,
          reviewerId,
          subjectId: targetUserId,
          direction: "sender_reviews_traveler",
          rating: 5,
          comment: "Great service duplicate race",
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });
        return { created: true };
      }),
    ]);

    // Exactly one created, one detected collision
    const outcomes = [res1.created, res2.created];
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);

    // Assert: at most one review document exists
    const allReviewsSnap = await db
      .collection("reviews")
      .where("bookingId", "==", bookingId)
      .where("reviewerId", "==", reviewerId)
      .get();
    expect(allReviewsSnap.size).toBe(1);

    // Trigger reputation update for the created document
    await (onReviewCreated.run as any)({
      params: { reviewId },
      data: {
        data: () => ({
          bookingId,
          reviewerId,
          subjectId: targetUserId,
          direction: "sender_reviews_traveler",
          rating: 5,
        }),
      },
    });

    // Assert: no duplicate reputation contribution occurs
    const stored = await db.collection("userReputations").doc(targetUserId).get();
    expect(stored.exists).toBe(true);
    expect(stored.data()?.reviewCount).toBe(1);
    expect(stored.data()?.averageRating).toBe(5);
    expect(stored.data()?.distribution[5]).toBe(1);
  });
});
