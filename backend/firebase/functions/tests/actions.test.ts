import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import { submitSafetyReview, placeAdministrativeHold, releaseAdministrativeHold, registerPushToken, unregisterPushToken } from "../src/index.js";
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

  describe("Push Token Persistence Actions Integration", () => {
    beforeEach(async () => {
      // Clear only the test pushTokenRegistrations records created by this test suite
      const testUids = ["user-123", "user-abc", "user-xyz"];
      for (const testUid of testUids) {
        const devicesSnap = await db
          .collection("pushTokenRegistrations")
          .doc(testUid)
          .collection("devices")
          .get();
        for (const deviceDoc of devicesSnap.docs) {
          await deviceDoc.ref.delete();
        }
        await db.collection("pushTokenRegistrations").doc(testUid).delete();
      }
    });

    describe("Authentication checks", () => {
      it("fails when unauthenticated for registerPushToken", async () => {
        const req = {
          data: {
            deviceId: "karri-device-123456789012",
            platform: "ios",
            provider: "expo",
            token: "ExponentPushToken[some-valid-token-value-here]",
            registeredAt: "2026-07-20T10:00:00.000Z",
          },
        };
        await expect(registerPushToken.run(req as any)).rejects.toThrowError(
          /Unauthenticated request/
        );
      });

      it("fails when unauthenticated for unregisterPushToken", async () => {
        const req = {
          data: {
            deviceId: "karri-device-123456789012",
          },
        };
        await expect(unregisterPushToken.run(req as any)).rejects.toThrowError(
          /Unauthenticated request/
        );
      });
    });

    describe("Payload validation checks", () => {
      const auth = { uid: "user-123", token: { role: "user" } };

      it("rejects non-object payload", async () => {
        const req = { data: "not-an-object", auth };
        await expect(registerPushToken.run(req as any)).rejects.toThrowError(
          /must be an object/
        );
      });

      it("rejects payload with extra/unknown fields", async () => {
        const req = {
          data: {
            deviceId: "karri-device-123456789012",
            platform: "ios",
            provider: "expo",
            token: "ExponentPushToken[token123]",
            registeredAt: "2026-07-20T10:00:00.000Z",
            extraField: "hack",
          },
          auth,
        };
        await expect(registerPushToken.run(req as any)).rejects.toThrowError(
          /contains unsupported fields/
        );
      });

      it("rejects invalid deviceId formats", async () => {
        const invalidDeviceIds = [
          "short-id", // too short (fails pattern)
          "karri-short", // fails pattern (less than 16 chars in suffix)
          "karri-invalid_chars_here_1234", // underscore not allowed in pattern
          "  karri-padded-device-id-12345  ", // not trimmed
          "", // empty
        ];

        for (const deviceId of invalidDeviceIds) {
          const req = {
            data: {
              deviceId,
              platform: "ios",
              provider: "expo",
              token: "ExponentPushToken[token123]",
              registeredAt: "2026-07-20T10:00:00.000Z",
            },
            auth,
          };
          await expect(registerPushToken.run(req as any)).rejects.toThrowError(
            /Invalid deviceId/
          );
        }
      });

      it("rejects invalid platforms", async () => {
        const req = {
          data: {
            deviceId: "karri-device-123456789012",
            platform: "web",
            provider: "expo",
            token: "ExponentPushToken[token123]",
            registeredAt: "2026-07-20T10:00:00.000Z",
          },
          auth,
        };
        await expect(registerPushToken.run(req as any)).rejects.toThrowError(
          /Invalid platform/
        );
      });

      it("rejects invalid providers", async () => {
        const req = {
          data: {
            deviceId: "karri-device-123456789012",
            platform: "ios",
            provider: "fcm",
            token: "ExponentPushToken[token123]",
            registeredAt: "2026-07-20T10:00:00.000Z",
          },
          auth,
        };
        await expect(registerPushToken.run(req as any)).rejects.toThrowError(
          /Invalid provider/
        );
      });

      it("rejects invalid push token formats", async () => {
        const invalidTokens = [
          "ExpoPushToken", // missing brackets
          "ExponentPushToken[tok\u0000en]", // control character
          "ExponentPushToken[tok en]", // space inside brackets
          "ExponentPushToken[  ]", // whitespace inside brackets
          "OtherPushToken[token123]", // wrong prefix
          "ExpoPushToken[" + "a".repeat(600) + "]", // too long (>512)
        ];

        for (const token of invalidTokens) {
          const req = {
            data: {
              deviceId: "karri-device-123456789012",
              platform: "ios",
              provider: "expo",
              token,
              registeredAt: "2026-07-20T10:00:00.000Z",
            },
            auth,
          };
          await expect(registerPushToken.run(req as any)).rejects.toThrowError(
            /Invalid push token format/
          );
        }
      });

      it("rejects invalid registeredAt timestamps", async () => {
        const farFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins future
        const invalidTimestamps = [
          "2026-07-20T10:00:00Z", // missing milliseconds
          "2026-07-20T10:00:00.123456Z", // excessive fractional precision
          "2026-07-20T10:00:00.000+00:00", // timezone offset instead of Z
          "2026-02-31T10:00:00.000Z", // invalid calendar date
          farFuture,
        ];

        for (const registeredAt of invalidTimestamps) {
          const req = {
            data: {
              deviceId: "karri-device-123456789012",
              platform: "ios",
              provider: "expo",
              token: "ExpoPushToken[token123]",
              registeredAt,
            },
            auth,
          };
          await expect(registerPushToken.run(req as any)).rejects.toThrowError(
            /registeredAt/
          );
        }
      });
    });

    describe("Registration logic", () => {
      const auth = { uid: "user-abc", token: { role: "user" } };
      const validData = {
        deviceId: "karri-device-123456789012",
        platform: "ios",
        provider: "expo",
        token: "ExpoPushToken[tok123456]",
        registeredAt: "2026-07-20T10:00:00.000Z",
      };

      it("creates version 1, preserves it for the same active token, and increments it for rotation and reactivation", async () => {
        const req1 = { data: validData, auth };
        const res1 = await registerPushToken.run(req1 as any);
        expect(res1).toEqual({
          success: true,
          deviceId: validData.deviceId,
          status: "registered",
          alreadyExisted: false,
        });

        const deviceRef = db
          .collection("pushTokenRegistrations")
          .doc("user-abc")
          .collection("devices")
          .doc(validData.deviceId);

        const snap1 = await deviceRef.get();
        expect(snap1.exists).toBe(true);
        const data1 = snap1.data();
        expect(data1).toMatchObject({
          userId: "user-abc",
          deviceId: validData.deviceId,
          platform: "ios",
          provider: "expo",
          token: "ExpoPushToken[tok123456]",
          active: true,
          registrationVersion: 1,
          registeredAt: "2026-07-20T10:00:00.000Z",
          revokedAt: null,
        });
        expect(data1?.createdAt).toBeDefined();
        expect(data1?.updatedAt).toBeDefined();

        const res2 = await registerPushToken.run(req1 as any);
        expect(res2.alreadyExisted).toBe(true);

        const data2 = (await deviceRef.get()).data();
        expect(data2?.registrationVersion).toBe(1);

        const freshData = {
          ...validData,
          token: "ExpoPushToken[refreshed-token-987]",
          registeredAt: "2026-07-20T10:05:00.000Z",
        };
        const req3 = { data: freshData, auth };
        const res3 = await registerPushToken.run(req3 as any);
        expect(res3.alreadyExisted).toBe(true);

        const data3 = (await deviceRef.get()).data();
        expect(data3?.token).toBe("ExpoPushToken[refreshed-token-987]");
        expect(data3?.registrationVersion).toBe(2);
        expect(data3?.registeredAt).toBe("2026-07-20T10:05:00.000Z");
        expect(data3?.createdAt).toEqual(data1?.createdAt);

        await unregisterPushToken.run({
          data: { deviceId: validData.deviceId },
          auth,
        } as any);

        const inactiveData = (await deviceRef.get()).data();
        expect(inactiveData?.active).toBe(false);
        expect(inactiveData?.token).toBeUndefined();
        expect(inactiveData?.registrationVersion).toBe(2);

        const res4 = await registerPushToken.run(req3 as any);
        expect(res4.alreadyExisted).toBe(true);

        const data4 = (await deviceRef.get()).data();
        expect(data4?.active).toBe(true);
        expect(data4?.token).toBe("ExpoPushToken[refreshed-token-987]");
        expect(data4?.registrationVersion).toBe(3);
        expect(data4?.createdAt).toEqual(data1?.createdAt);
      });

      it("upgrades a legacy registration without a version to version 1", async () => {
        const deviceRef = db
          .collection("pushTokenRegistrations")
          .doc("user-abc")
          .collection("devices")
          .doc(validData.deviceId);

        const timestamp = admin.firestore.Timestamp.fromDate(
          new Date("2026-07-20T09:55:00.000Z"),
        );

        await deviceRef.set({
          userId: "user-abc",
          deviceId: validData.deviceId,
          platform: "ios",
          provider: "expo",
          token: validData.token,
          active: true,
          registeredAt: validData.registeredAt,
          createdAt: timestamp,
          updatedAt: timestamp,
          revokedAt: null,
        });

        const result = await registerPushToken.run({
          data: validData,
          auth,
        } as any);

        expect(result).toEqual({
          success: true,
          deviceId: validData.deviceId,
          status: "registered",
          alreadyExisted: true,
        });
        expect(JSON.stringify(result)).not.toContain(validData.token);

        const upgraded = (await deviceRef.get()).data();
        expect(upgraded?.registrationVersion).toBe(1);
        expect(upgraded?.createdAt).toEqual(timestamp);
      });

      it("fails closed when an existing registration has a malformed version", async () => {
        const deviceRef = db
          .collection("pushTokenRegistrations")
          .doc("user-abc")
          .collection("devices")
          .doc(validData.deviceId);

        const timestamp = admin.firestore.Timestamp.fromDate(
          new Date("2026-07-20T09:55:00.000Z"),
        );

        await deviceRef.set({
          userId: "user-abc",
          deviceId: validData.deviceId,
          platform: "ios",
          provider: "expo",
          token: validData.token,
          active: true,
          registrationVersion: 0,
          registeredAt: validData.registeredAt,
          createdAt: timestamp,
          updatedAt: timestamp,
          revokedAt: null,
        });

        const rotatedToken = "ExpoPushToken[malformed-version-rotation]";

        const attempt = registerPushToken.run({
          data: {
            ...validData,
            token: rotatedToken,
            registeredAt: "2026-07-20T10:05:00.000Z",
          },
          auth,
        } as any);

        await expect(attempt).rejects.toThrowError(
          /An internal error occurred/,
        );

        const unchanged = (await deviceRef.get()).data();
        expect(unchanged?.active).toBe(true);
        expect(unchanged?.token).toBe(validData.token);
        expect(unchanged?.registrationVersion).toBe(0);
        expect(unchanged?.registeredAt).toBe(validData.registeredAt);
        expect(unchanged?.createdAt).toEqual(timestamp);
        expect(JSON.stringify(unchanged)).not.toContain(rotatedToken);
      });

      it("fails closed when registration version is exhausted", async () => {
        const deviceRef = db
          .collection("pushTokenRegistrations")
          .doc("user-abc")
          .collection("devices")
          .doc(validData.deviceId);

        const timestamp = admin.firestore.Timestamp.fromDate(
          new Date("2026-07-20T09:55:00.000Z"),
        );

        await deviceRef.set({
          userId: "user-abc",
          deviceId: validData.deviceId,
          platform: "ios",
          provider: "expo",
          token: validData.token,
          active: true,
          registrationVersion: Number.MAX_SAFE_INTEGER,
          registeredAt: validData.registeredAt,
          createdAt: timestamp,
          updatedAt: timestamp,
          revokedAt: null,
        });

        const rotatedToken = "ExpoPushToken[exhausted-version-rotation]";

        const attempt = registerPushToken.run({
          data: {
            ...validData,
            token: rotatedToken,
            registeredAt: "2026-07-20T10:05:00.000Z",
          },
          auth,
        } as any);

        await expect(attempt).rejects.toThrowError(
          /An internal error occurred/,
        );

        const unchanged = (await deviceRef.get()).data();
        expect(unchanged?.active).toBe(true);
        expect(unchanged?.token).toBe(validData.token);
        expect(unchanged?.registrationVersion).toBe(
          Number.MAX_SAFE_INTEGER,
        );
        expect(unchanged?.registeredAt).toBe(validData.registeredAt);
        expect(unchanged?.createdAt).toEqual(timestamp);
        expect(JSON.stringify(unchanged)).not.toContain(rotatedToken);
      });

      it("enforces authentication mapping and guarantees one user cannot address another user's record", async () => {
        // Register under user-abc
        const req = { data: validData, auth };
        await registerPushToken.run(req as any);

        // Try to query or address under user-xyz. Since UID is derived exclusively from auth.uid,
        // if user-xyz calls register, it will create a separate document under user-xyz/devices
        // and cannot access user-abc's document.
        const authXyz = { uid: "user-xyz", token: { role: "user" } };
        const reqXyz = { data: validData, auth: authXyz };
        const resXyz = await registerPushToken.run(reqXyz as any);
        expect(resXyz.alreadyExisted).toBe(false);

        // Verify user-xyz device document is distinct
        const devRefXyz = db
          .collection("pushTokenRegistrations")
          .doc("user-xyz")
          .collection("devices")
          .doc(validData.deviceId);

        const snapXyz = await devRefXyz.get();
        expect(snapXyz.exists).toBe(true);
        expect(snapXyz.data()?.userId).toBe("user-xyz");
      });
    });

    describe("Unregistration logic", () => {
      const auth = { uid: "user-abc", token: { role: "user" } };
      const deviceId = "karri-device-123456789012";
      const validData = {
        deviceId,
        platform: "ios",
        provider: "expo",
        token: "ExpoPushToken[tok123456]",
        registeredAt: "2026-07-20T10:00:00.000Z",
      };

      it("marks the record inactive, deletes the token, and is idempotent on repeat unregistration", async () => {
        // 1. Unregistering nonexistent device does not create any placeholder
        const unregNonexistent = { data: { deviceId }, auth };
        const resNonexistent = await unregisterPushToken.run(unregNonexistent as any);
        expect(resNonexistent).toEqual({
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: true,
        });

        const deviceRef = db
          .collection("pushTokenRegistrations")
          .doc("user-abc")
          .collection("devices")
          .doc(deviceId);
        const snapNonexistent = await deviceRef.get();
        expect(snapNonexistent.exists).toBe(false);

        // 2. Register first
        const regReq = { data: validData, auth };
        await registerPushToken.run(regReq as any);

        // 3. Unregister active device
        const res1 = await unregisterPushToken.run({ data: { deviceId }, auth } as any);
        expect(res1).toEqual({
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: false,
        });

        const snap1 = await deviceRef.get();
        const data1 = snap1.data();
        expect(data1?.active).toBe(false);
        expect(data1?.token).toBeUndefined(); // token deleted
        expect(data1?.revokedAt).toBeDefined();
        expect(data1?.updatedAt).toBeDefined();
        expect(data1?.userId).toBe("user-abc"); // metadata preserved

        // 4. Repeat unregister is idempotent (alreadyInactive: true)
        const res2 = await unregisterPushToken.run({ data: { deviceId }, auth } as any);
        expect(res2).toEqual({
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: true,
        });
      });

      it("prevents one user from unregistering another user's device", async () => {
        // 1. User ABC registers a device
        const regReq = { data: validData, auth };
        await registerPushToken.run(regReq as any);

        // 2. User XYZ tries to unregister User ABC's device ID
        const authXyz = { uid: "user-xyz", token: { role: "user" } };
        const unregReq = { data: { deviceId }, auth: authXyz };
        const res = await unregisterPushToken.run(unregReq as any);

        // XYZ gets "alreadyInactive: true" because it doesn't exist on XYZ's path
        expect(res).toEqual({
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: true,
        });

        // 3. User ABC's device remains active and still has the token
        const deviceRefAbc = db
          .collection("pushTokenRegistrations")
          .doc("user-abc")
          .collection("devices")
          .doc(deviceId);
        const snapAbc = await deviceRefAbc.get();
        expect(snapAbc.exists).toBe(true);
        expect(snapAbc.data()?.active).toBe(true);
        expect(snapAbc.data()?.token).toBe("ExpoPushToken[tok123456]");
      });

      it("reconciles already-inactive records that have leftover tokens and null revokedAt securely", async () => {
        const deviceRef = db
          .collection("pushTokenRegistrations")
          .doc("user-abc")
          .collection("devices")
          .doc(deviceId);

        // 1. Directly seed the document in the database matching the criteria
        const initialTimestamp = admin.firestore.FieldValue.serverTimestamp();
        await deviceRef.set({
          userId: "user-abc",
          deviceId,
          platform: "ios",
          provider: "expo",
          token: "ExpoPushToken[seeded-leftover-token]",
          active: false,
          registeredAt: "2026-07-20T10:00:00.000Z",
          createdAt: initialTimestamp,
          updatedAt: initialTimestamp,
          revokedAt: null,
        });

        // 2. Call unregisterPushToken
        const res = await unregisterPushToken.run({ data: { deviceId }, auth } as any);
        expect(res).toEqual({
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: true,
        });

        // 3. Verify target fields after reconciliation
        const snap = await deviceRef.get();
        expect(snap.exists).toBe(true);
        const data = snap.data();
        expect(data?.active).toBe(false);
        expect(data?.token).toBeUndefined(); // raw token deleted
        expect(data?.revokedAt).toBeDefined();
        expect(data?.revokedAt).not.toBeNull();
        expect(data?.updatedAt).toBeDefined();
        expect(data?.userId).toBe("user-abc"); // metadata preserved
        expect(data?.platform).toBe("ios");
        expect(data?.provider).toBe("expo");

        // 4. Repeat unregistration is idempotent and does not perform additional write
        const snapBeforeRepeat = await deviceRef.get();
        const dataBeforeRepeat = snapBeforeRepeat.data();

        const res2 = await unregisterPushToken.run({ data: { deviceId }, auth } as any);
        expect(res2).toEqual({
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: true,
        });

        const snapAfterRepeat = await deviceRef.get();
        const dataAfterRepeat = snapAfterRepeat.data();

        // Verify that the document wasn't written to again (updatedAt/revokedAt remains same)
        expect(dataAfterRepeat?.token).toBeUndefined();
        expect(dataAfterRepeat?.revokedAt).toEqual(dataBeforeRepeat?.revokedAt);
        expect(dataAfterRepeat?.updatedAt).toEqual(dataBeforeRepeat?.updatedAt);
      });

      it("reconciles already-inactive records that have malformed revokedAt securely", async () => {
        const deviceRef = db
          .collection("pushTokenRegistrations")
          .doc("user-abc")
          .collection("devices")
          .doc(deviceId);

        // 1. Seed document with no token and a malformed revokedAt (ISO string)
        const initialTimestamp = admin.firestore.FieldValue.serverTimestamp();
        await deviceRef.set({
          userId: "user-abc",
          deviceId,
          platform: "ios",
          provider: "expo",
          active: false,
          registeredAt: "2026-07-20T10:00:00.000Z",
          createdAt: initialTimestamp,
          updatedAt: initialTimestamp,
          revokedAt: "2026-07-20T10:00:00.000Z", // malformed revokedAt (string)
        });

        // 2. Call unregisterPushToken
        const res = await unregisterPushToken.run({ data: { deviceId }, auth } as any);
        expect(res).toEqual({
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: true,
        });

        // 3. Verify target fields after reconciliation
        const snap = await deviceRef.get();
        expect(snap.exists).toBe(true);
        const data = snap.data();
        expect(data?.active).toBe(false);
        expect(data?.token).toBeUndefined();
        // check that revokedAt is now a Firestore Timestamp
        expect(data?.revokedAt).toBeInstanceOf(admin.firestore.Timestamp);
        expect(data?.updatedAt).toBeDefined();
        expect(data?.userId).toBe("user-abc");
        expect(data?.platform).toBe("ios");
        expect(data?.provider).toBe("expo");

        // 4. Repeat unregistration is idempotent and does not perform additional write
        const snapBeforeRepeat = await deviceRef.get();
        const dataBeforeRepeat = snapBeforeRepeat.data();

        const res2 = await unregisterPushToken.run({ data: { deviceId }, auth } as any);
        expect(res2).toEqual({
          success: true,
          deviceId,
          status: "unregistered",
          alreadyInactive: true,
        });

        const snapAfterRepeat = await deviceRef.get();
        const dataAfterRepeat = snapAfterRepeat.data();

        // Verify that the document was not written to again
        expect(dataAfterRepeat?.revokedAt).toEqual(dataBeforeRepeat?.revokedAt);
        expect(dataAfterRepeat?.updatedAt).toEqual(dataBeforeRepeat?.updatedAt);
      });
    });

    describe("Privacy verification", () => {
      const auth = { uid: "user-abc", token: { role: "user" } };
      const token = "ExpoPushToken[secret-tok-privacy]";
      const data = {
        deviceId: "karri-device-123456789012",
        platform: "ios",
        provider: "expo",
        token,
        registeredAt: "2026-07-20T10:00:00.000Z",
      };

      it("never includes the raw token in the callable response", async () => {
        const res = await registerPushToken.run({ data, auth } as any);
        expect(JSON.stringify(res)).not.toContain(token);
      });

      it("never includes the raw token in error message or logs", async () => {
        // Run invalid platform request but with raw token
        const badReq = {
          data: {
            ...data,
            platform: "invalid-platform",
          },
          auth,
        };
        try {
          await registerPushToken.run(badReq as any);
          throw new Error("Should have failed");
        } catch (error: any) {
          expect(error.message).not.toContain(token);
          expect(JSON.stringify(error)).not.toContain(token);
        }
      });

      it("never leaks raw token when submitted as an additional unknown property name", async () => {
        const payloadWithTokenAsUnknownField = {
          ...data,
          [token]: "some-value",
        };
        const badReq = {
          data: payloadWithTokenAsUnknownField,
          auth,
        };
        try {
          await registerPushToken.run(badReq as any);
          throw new Error("Should have failed");
        } catch (error: any) {
          expect(error.message).not.toContain(token);
          expect(JSON.stringify(error)).not.toContain(token);
        }
      });
    });
  });
});
