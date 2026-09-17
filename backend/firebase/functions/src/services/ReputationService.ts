import admin from "firebase-admin";
import type { StarDistribution, UserReputationRecord } from "../types/ReputationTypes.js";

export class ReputationService {
  constructor(private readonly db: admin.firestore.Firestore) {}

  public async updateUserReputation(userId: string): Promise<UserReputationRecord> {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      throw new Error("Invalid userId for reputation update.");
    }

    // 1. Query all reviews received by this user (where subjectId == userId)
    const reviewsSnap = await this.db
      .collection("reviews")
      .where("subjectId", "==", userId)
      .get();

    const distribution: StarDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    let reviewCount = 0;

    for (const doc of reviewsSnap.docs) {
      const data = doc.data();
      const rating = Number(data.rating);
      if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
        distribution[rating as keyof StarDistribution] += 1;
        totalScore += rating;
        reviewCount += 1;
      }
    }

    const averageRating =
      reviewCount > 0 ? Math.round((totalScore / reviewCount) * 100) / 100 : null;

    // 2. Query participant bookings for completion rate
    // Check traveler commitments (primary completion metric for crowdsourced shipping)
    const travelerBookingsSnap = await this.db
      .collection("bookings")
      .where("travelerId", "==", userId)
      .get();

    let completedCount = 0;
    let cancelledCount = 0;

    for (const doc of travelerBookingsSnap.docs) {
      const bData = doc.data();
      if (bData.status === "completed") {
        completedCount += 1;
      } else if (bData.status === "cancelled") {
        cancelledCount += 1;
      }
    }

    // Also include sender bookings where completed
    const senderBookingsSnap = await this.db
      .collection("bookings")
      .where("senderId", "==", userId)
      .get();

    for (const doc of senderBookingsSnap.docs) {
      const bData = doc.data();
      if (bData.status === "completed") {
        completedCount += 1;
      } else if (bData.status === "cancelled") {
        cancelledCount += 1;
      }
    }

    const finishedBookings = completedCount + cancelledCount;
    const completionRate =
      finishedBookings > 0
        ? Math.round((completedCount / finishedBookings) * 100) / 100
        : null;

    const record: UserReputationRecord = {
      userId,
      averageRating,
      reviewCount,
      distribution,
      completedBookingsCount: completedCount,
      cancelledBookingsCount: cancelledCount,
      completionRate,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await this.db.collection("userReputations").doc(userId).set(record);

    return record;
  }

  public async getUserReputation(userId: string): Promise<UserReputationRecord | null> {
    const doc = await this.db.collection("userReputations").doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as UserReputationRecord;
  }
}
