import type { Transaction } from "firebase-admin/firestore";
import type admin from "firebase-admin";
import { FailedPreconditionError } from "../errors/DomainErrors.js";

/**
 * Asserts that a shipment is clear of any blocking safety or administrative holds.
 *
 * Must be executed inside a Firestore transaction so that any concurrent hold
 * or review update causes the transaction to abort and retry or fail cleanly.
 *
 * Blocking conditions:
 * 1. An active administrative hold in `administrativeHolds` for this `shipmentId`.
 * 2. A safety review in `shipmentSafetyReviews` with `decision === "rejected"`.
 * 3. A safety review with `decision === "needs_more_information"` (pending) without a subsequent `decision === "approved"`.
 */
export async function assertShipmentSafetyClear(
  transaction: Transaction,
  db: admin.firestore.Firestore,
  shipmentId: string
): Promise<void> {
  // 1. Check for active administrative holds
  const activeHoldsQuery = await transaction.get(
    db.collection("administrativeHolds")
      .where("shipmentId", "==", shipmentId)
      .where("status", "==", "active")
      .limit(1)
  );

  if (!activeHoldsQuery.empty) {
    const holdData = activeHoldsQuery.docs[0].data();
    throw new FailedPreconditionError(
      `Shipment is subject to an active administrative hold (reason: ${holdData.reasonCode || "policy_violation"}). Action blocked.`
    );
  }

  // 2. Check for shipment safety reviews
  const safetyReviewsQuery = await transaction.get(
    db.collection("shipmentSafetyReviews")
      .where("shipmentId", "==", shipmentId)
  );

  if (!safetyReviewsQuery.empty) {
    const docs = safetyReviewsQuery.docs;
    const rejectedReview = docs.find((d) => d.data().decision === "rejected");
    if (rejectedReview) {
      const rData = rejectedReview.data();
      throw new FailedPreconditionError(
        `Shipment safety review was rejected (reason: ${rData.reasonCode || "rejected"}). Action blocked.`
      );
    }

    const approvedReview = docs.find((d) => d.data().decision === "approved");
    const needsInfoReview = docs.find((d) => d.data().decision === "needs_more_information");
    if (needsInfoReview && !approvedReview) {
      throw new FailedPreconditionError(
        "Shipment safety review requires additional information and has not been approved. Action blocked."
      );
    }
  }
}
