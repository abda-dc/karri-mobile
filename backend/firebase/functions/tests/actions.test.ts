import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import { submitSafetyReview, placeAdministrativeHold, releaseAdministrativeHold } from "../src/index.js";
import { deriveOperationId } from "../src/utils/crypto.js";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "demo-karri-mobile",
  });
}

const db = admin.firestore();

// Seed helper for shipments
async function seedShipment(shipmentId: string, overrides = {}) {
  await db.collection("shipments").doc(shipmentId).set({
    ownerId: "sender-1",
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    packageCategory: "documents",
    packageDescription: "sealed package",
    weightKg: 0.5,
    deliveryWindow: "2026-02-01 to 2026-02-10",
    rewardAmount: 50,
    rewardCurrency: "USD",
    status: "active",
    containsBattery: false,
    batteryType: "none",
    containsLiquid: false,
    containsFoodOrAgri: false,
    containsMedicine: false,
    customsDeclarationRequired: false,
    packageContentVersion: 1,
    safetyDeclaration: {
      policyVersion: "2026-07-v1",
      declarationVersion: "v1",
      acceptedAt: admin.firestore.Timestamp.now(),
      acceptedByUserId: "sender-1",
      packageContentVersion: 1,
      acknowledgements: {
        contentsAccurate: true,
        noProhibitedItems: true,
        inspectionPermitted: true,
        customsResponsibilityAccepted: true,
      },
    },
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    ...overrides,
  });
}

describe("Administrative Actions Functions Integration", () => {
  beforeEach(async () => {
    // Clear the specific collections under test
    const collections = ["shipments", "shipmentSafetyReviews", "administrativeHolds", "auditLogs"];
    for (const collName of collections) {
      const snap = await db.collection(collName).get();
      for (const doc of snap.docs) {
        await doc.ref.delete();
      }
    }
  });

  describe("Authentication and Permission Guard checks", () => {
    it("fails when unauthenticated", async () => {
      const req = {
        data: {
          shipmentId: "ship-123",
          decision: "approved",
          reasonCode: "verified_safe",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: "idem-1",
        },
      };
      await expect(submitSafetyReview.run(req as any)).rejects.toThrowError(
        /Unauthenticated request/
      );
    });

    it("fails when missing role custom claim", async () => {
      const req = {
        data: {
          shipmentId: "ship-123",
          decision: "approved",
          reasonCode: "verified_safe",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: "idem-1",
        },
        auth: {
          uid: "admin-1",
          token: {},
        },
      };
      await expect(submitSafetyReview.run(req as any)).rejects.toThrowError(
        /Permission denied/
      );
    });

    it("fails when role does not have required permission", async () => {
      const req = {
        data: {
          shipmentId: "ship-123",
          decision: "approved",
          reasonCode: "verified_safe",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: "idem-1",
        },
        auth: {
          uid: "admin-1",
          token: {
            role: "operations_admin",
          },
        },
      };
      await expect(submitSafetyReview.run(req as any)).rejects.toThrowError(
        /Permission denied/
      );
    });
  });

  describe("submitSafetyReview", () => {
    it("successfully reviews a valid shipment and creates an audit log without mutating the original declaration", async () => {
      await seedShipment("ship-1");

      const req = {
        data: {
          shipmentId: "ship-1",
          decision: "approved",
          reasonCode: "verified_safe",
          note: "No suspicious items found.",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: "idem-review-1",
        },
        auth: {
          uid: "safety-admin-1",
          token: {
            role: "safety_admin",
          },
        },
      };

      const res = await submitSafetyReview.run(req as any);
      const expectedReviewId = deriveOperationId(
        "safety-admin-1",
        "safety_review.submit",
        "shipment",
        "ship-1",
        "idem-review-1"
      );

      expect(res).toEqual({
        success: true,
        reviewId: expectedReviewId,
        alreadyExisted: false,
      });

      // Verify the review record is created and matches expectations
      const reviewSnap = await db.collection("shipmentSafetyReviews").doc(expectedReviewId).get();
      expect(reviewSnap.exists).toBe(true);
      const reviewData = reviewSnap.data();
      expect(reviewData).toMatchObject({
        shipmentId: "ship-1",
        actorUid: "safety-admin-1",
        reviewerRole: "safety_admin",
        decision: "approved",
        reasonCode: "verified_safe",
        note: "No suspicious items found.",
        declarationVersionReviewed: "v1",
        packageContentVersionReviewed: 1,
        idempotencyKey: "idem-review-1",
      });

      // Verify the original shipment remains unchanged
      const shipmentSnap = await db.collection("shipments").doc("ship-1").get();
      const shipmentData = shipmentSnap.data();
      expect(shipmentData?.safetyDeclaration).toBeDefined();
      expect(shipmentData?.safetyDeclaration.acceptedByUserId).toBe("sender-1");

      // Verify deterministic audit log is created
      const expectedAuditId = deriveOperationId(
        "safety-admin-1",
        "safety_review.submit",
        "shipment",
        "ship-1",
        "idem-review-1"
      );
      const auditSnap = await db.collection("auditLogs").doc(expectedAuditId).get();
      expect(auditSnap.exists).toBe(true);
      const auditData = auditSnap.data();
      expect(auditData).toMatchObject({
        action: "safety_review.submit",
        actorUid: "safety-admin-1",
        actorRole: "safety_admin",
        targetType: "shipment",
        targetId: "ship-1",
        reasonCode: "verified_safe",
        idempotencyKey: "idem-review-1",
        metadata: {
          decision: "approved",
          packageContentVersionReviewed: 1,
          declarationVersionReviewed: "v1",
        },
      });
    });

    it("enforces idempotency on duplicate requests with same idempotency key and rejects different inputs", async () => {
      await seedShipment("ship-1");

      const req = {
        data: {
          shipmentId: "ship-1",
          decision: "approved",
          reasonCode: "verified_safe",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: "idem-dup",
        },
        auth: {
          uid: "safety-admin-1",
          token: {
            role: "safety_admin",
          },
        },
      };

      const res1 = await submitSafetyReview.run(req as any);
      expect(res1.alreadyExisted).toBe(false);

      // Exact retry should return alreadyExisted: true
      const res2 = await submitSafetyReview.run(req as any);
      expect(res2.alreadyExisted).toBe(true);

      // Retrying with same key but different decision should reject (Conflict/AlreadyExists)
      const reqDiff = {
        ...req,
        data: {
          ...req.data,
          decision: "rejected",
        },
      };
      await expect(submitSafetyReview.run(reqDiff as any)).rejects.toThrowError(
        /Conflict/
      );
    });

    it("rejects safety review if shipment versions mismatch", async () => {
      await seedShipment("ship-1", { packageContentVersion: 2 }); // current shipment is v2

      const req = {
        data: {
          shipmentId: "ship-1",
          decision: "approved",
          reasonCode: "verified_safe",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1, // reviewed v1
          idempotencyKey: "idem-mismatch",
        },
        auth: {
          uid: "safety-admin-1",
          token: {
            role: "safety_admin",
          },
        },
      };

      await expect(submitSafetyReview.run(req as any)).rejects.toThrowError(
        /Reviewed package content version.*does not match current shipment version/
      );
    });

    it("allows non-final review (needs_more_information) followed by a final review, but prevents review after a final decision", async () => {
      await seedShipment("ship-final-flow");

      const auth = {
        uid: "safety-admin-1",
        token: { role: "safety_admin" },
      };

      // 1. Submit non-final review
      const res1 = await submitSafetyReview.run({
        data: {
          shipmentId: "ship-final-flow",
          decision: "needs_more_information",
          reasonCode: "documentation_missing",
          note: "Missing invoice.",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: "idem-nonfinal",
        },
        auth,
      } as any);
      expect(res1.success).toBe(true);
      expect(res1.alreadyExisted).toBe(false);

      // 2. Submit final review (approved)
      const res2 = await submitSafetyReview.run({
        data: {
          shipmentId: "ship-final-flow",
          decision: "approved",
          reasonCode: "verified_safe",
          note: "Invoice provided.",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: "idem-final",
        },
        auth,
      } as any);
      expect(res2.success).toBe(true);
      expect(res2.alreadyExisted).toBe(false);

      // 3. Attempt another review after final decision (should fail)
      const attemptAfterFinal = submitSafetyReview.run({
        data: {
          shipmentId: "ship-final-flow",
          decision: "rejected",
          reasonCode: "prohibited_item",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: "idem-after-final",
        },
        auth,
      } as any);
      await expect(attemptAfterFinal).rejects.toThrowError(
        /A final safety review already exists/
      );
    });

    it("rejects invalid safety review reason codes", async () => {
      await seedShipment("ship-invalid-reason");
      const req = {
        data: {
          shipmentId: "ship-invalid-reason",
          decision: "approved",
          reasonCode: "INVALID_REASON",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: "idem-reason-fail",
        },
        auth: {
          uid: "safety-admin-1",
          token: { role: "safety_admin" },
        },
      };
      await expect(submitSafetyReview.run(req as any)).rejects.toThrowError(
        /Invalid reasonCode/
      );
    });
  });

  describe("placeAdministrativeHold", () => {
    it("successfully places a hold on an existing shipment and keeps lifecycle status unchanged", async () => {
      await seedShipment("ship-hold");

      const req = {
        data: {
          shipmentId: "ship-hold",
          reasonCode: "suspected_policy_violation",
          note: "Review required due to heavy weight flag.",
          idempotencyKey: "idem-hold-1",
        },
        auth: {
          uid: "operations-admin-1",
          token: {
            role: "operations_admin",
          },
        },
      };

      const expectedHoldId = deriveOperationId(
        "operations-admin-1",
        "hold.place",
        "shipment",
        "ship-hold",
        "idem-hold-1"
      );

      const res = await placeAdministrativeHold.run(req as any);
      expect(res).toEqual({
        success: true,
        holdId: expectedHoldId,
        alreadyExisted: false,
      });

      // Verify hold record is active
      const holdSnap = await db.collection("administrativeHolds").doc(expectedHoldId).get();
      expect(holdSnap.exists).toBe(true);
      const holdData = holdSnap.data();
      expect(holdData).toMatchObject({
        shipmentId: "ship-hold",
        status: "active",
        reasonCode: "suspected_policy_violation",
        note: "Review required due to heavy weight flag.",
        placedByUid: "operations-admin-1",
        placedByRole: "operations_admin",
        releasedByUid: null,
      });

      // Verify shipment status was NOT changed (remains active)
      const shipmentSnap = await db.collection("shipments").doc("ship-hold").get();
      expect(shipmentSnap.data()?.status).toBe("active");

      // Verify audit log exists
      const expectedAuditId = deriveOperationId(
        "operations-admin-1",
        "hold.place",
        "shipment",
        "ship-hold",
        "idem-hold-1"
      );
      const auditSnap = await db.collection("auditLogs").doc(expectedAuditId).get();
      expect(auditSnap.exists).toBe(true);
    });

    it("fails to place hold on non-existent shipment", async () => {
      const req = {
        data: {
          shipmentId: "non-existent",
          reasonCode: "suspected_policy_violation",
          idempotencyKey: "idem-hold-fail",
        },
        auth: {
          uid: "operations-admin-1",
          token: {
            role: "operations_admin",
          },
        },
      };
      await expect(placeAdministrativeHold.run(req as any)).rejects.toThrowError(
        /Shipment not found/
      );
    });

    it("prevents multiple active shipment holds and rejects different operations with same details", async () => {
      await seedShipment("ship-multi-hold");
      const auth = {
        uid: "operations-admin-1",
        token: { role: "operations_admin" },
      };

      // 1. Place first hold
      const res1 = await placeAdministrativeHold.run({
        data: {
          shipmentId: "ship-multi-hold",
          reasonCode: "suspected_policy_violation",
          note: "Same reason",
          idempotencyKey: "idem-h1",
        },
        auth,
      } as any);
      expect(res1.success).toBe(true);

      // 2. Placing another hold with different key but same details should fail (not treated as retry)
      const attempt2 = placeAdministrativeHold.run({
        data: {
          shipmentId: "ship-multi-hold",
          reasonCode: "suspected_policy_violation",
          note: "Same reason",
          idempotencyKey: "idem-h2",
        },
        auth,
      } as any);
      await expect(attempt2).rejects.toThrowError(
        /Another active administrative hold already exists/
      );
    });

    it("rejects invalid placement reason codes", async () => {
      await seedShipment("ship-invalid-hold-reason");
      const req = {
        data: {
          shipmentId: "ship-invalid-hold-reason",
          reasonCode: "INVALID_HOLD_REASON",
          idempotencyKey: "idem-hold-reason-fail",
        },
        auth: {
          uid: "operations-admin-1",
          token: { role: "operations_admin" },
        },
      };
      await expect(placeAdministrativeHold.run(req as any)).rejects.toThrowError(
        /Invalid reasonCode/
      );
    });
  });

  describe("releaseAdministrativeHold", () => {
    it("successfully releases an active hold and leaves shipment status unchanged", async () => {
      await seedShipment("ship-release");

      const auth = {
        uid: "operations-admin-1",
        token: { role: "operations_admin" },
      };

      // First place a hold
      const holdRes = await placeAdministrativeHold.run({
        data: {
          shipmentId: "ship-release",
          reasonCode: "suspected_policy_violation",
          idempotencyKey: "idem-hold-to-release",
        },
        auth,
      } as any);

      const holdId = holdRes.holdId;

      // Now release the hold
      const releaseReq = {
        data: {
          holdId,
          reasonCode: "review_completed",
          note: "Reviewed documentation and content checks passed.",
          idempotencyKey: "idem-release-1",
        },
        auth,
      };

      const res = await releaseAdministrativeHold.run(releaseReq as any);
      expect(res).toEqual({
        success: true,
        holdId,
        alreadyExisted: false,
      });

      // Verify hold record status is released
      const holdSnap = await db.collection("administrativeHolds").doc(holdId).get();
      const hData = holdSnap.data();
      expect(hData?.status).toBe("released");
      expect(hData?.releasedByUid).toBe("operations-admin-1");
      expect(hData?.releasedByRole).toBe("operations_admin");

      // Verify shipment status was NOT changed (remains active)
      const shipmentSnap = await db.collection("shipments").doc("ship-release").get();
      expect(shipmentSnap.data()?.status).toBe("active");

      // Verify release audit log was created
      const expectedReleaseAuditId = deriveOperationId(
        "operations-admin-1",
        "hold.release",
        "hold",
        holdId,
        "idem-release-1"
      );
      const auditSnap = await db.collection("auditLogs").doc(expectedReleaseAuditId).get();
      expect(auditSnap.exists).toBe(true);
      expect(auditSnap.data()?.action).toBe("hold.release");
    });

    it("fails when trying to release a nonexistent hold", async () => {
      const releaseReq = {
        data: {
          holdId: "non-existent-hold",
          reasonCode: "review_completed",
          idempotencyKey: "idem-release-fail",
        },
        auth: {
          uid: "operations-admin-1",
          token: {
            role: "operations_admin",
          },
        },
      };
      await expect(releaseAdministrativeHold.run(releaseReq as any)).rejects.toThrowError(
        /Target hold does not exist/
      );
    });

    it("behaves idempotently when releasing an already released hold", async () => {
      await seedShipment("ship-release-dup");

      const auth = {
        uid: "operations-admin-1",
        token: { role: "operations_admin" },
      };

      const holdRes = await placeAdministrativeHold.run({
        data: {
          shipmentId: "ship-release-dup",
          reasonCode: "suspected_policy_violation",
          idempotencyKey: "idem-hold-dup",
        },
        auth,
      } as any);

      const holdId = holdRes.holdId;

      const releaseReq = {
        data: {
          holdId,
          reasonCode: "review_completed",
          idempotencyKey: "idem-release-dup-1",
        },
        auth,
      };

      // First release
      const res1 = await releaseAdministrativeHold.run(releaseReq as any);
      expect(res1.alreadyExisted).toBe(false);

      // Second release with same idempotency key is no-op success
      const res2 = await releaseAdministrativeHold.run(releaseReq as any);
      expect(res2.alreadyExisted).toBe(true);

      // Release with a NEW idempotency key but hold is already released should also be no-op (alreadyExisted: true)
      const releaseReqNewIdem = {
        ...releaseReq,
        data: {
          ...releaseReq.data,
          idempotencyKey: "idem-release-dup-2",
        },
      };
      const res3 = await releaseAdministrativeHold.run(releaseReqNewIdem as any);
      expect(res3.alreadyExisted).toBe(true);
    });

    it("rejects invalid release reason codes", async () => {
      await seedShipment("ship-release-invalid");
      const auth = {
        uid: "operations-admin-1",
        token: { role: "operations_admin" },
      };

      const holdRes = await placeAdministrativeHold.run({
        data: {
          shipmentId: "ship-release-invalid",
          reasonCode: "suspected_policy_violation",
          idempotencyKey: "idem-hold-for-invalid-release",
        },
        auth,
      } as any);

      const req = {
        data: {
          holdId: holdRes.holdId,
          reasonCode: "INVALID_RELEASE_REASON",
          idempotencyKey: "idem-release-reason-fail",
        },
        auth,
      };
      await expect(releaseAdministrativeHold.run(req as any)).rejects.toThrowError(
        /Invalid reasonCode/
      );
    });
  });

  describe("Idempotency scope regression tests", () => {
    it("allows reuse of raw idempotency key across different actors or actions", async () => {
      await seedShipment("ship-idem-scope-1");
      await seedShipment("ship-idem-scope-2");

      const sameRawKey = "shared-idem-key";

      // Actor 1 submits safety review on ship-idem-scope-1
      const res1 = await submitSafetyReview.run({
        data: {
          shipmentId: "ship-idem-scope-1",
          decision: "approved",
          reasonCode: "verified_safe",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: sameRawKey,
        },
        auth: {
          uid: "safety-admin-1",
          token: { role: "safety_admin" },
        },
      } as any);
      expect(res1.success).toBe(true);

      // Actor 2 submits safety review on ship-idem-scope-2 using the same raw key
      const res2 = await submitSafetyReview.run({
        data: {
          shipmentId: "ship-idem-scope-2",
          decision: "approved",
          reasonCode: "verified_safe",
          declarationVersionReviewed: "v1",
          packageContentVersionReviewed: 1,
          idempotencyKey: sameRawKey,
        },
        auth: {
          uid: "safety-admin-2",
          token: { role: "safety_admin" },
        },
      } as any);
      expect(res2.success).toBe(true);

      // Same Actor 1 places hold on ship-idem-scope-1 using the same raw key (different action/collection)
      const res3 = await placeAdministrativeHold.run({
        data: {
          shipmentId: "ship-idem-scope-1",
          reasonCode: "suspected_policy_violation",
          idempotencyKey: sameRawKey,
        },
        auth: {
          uid: "safety-admin-1",
          token: { role: "safety_admin" },
        },
      } as any);
      expect(res3.success).toBe(true);
    });
  });
});
