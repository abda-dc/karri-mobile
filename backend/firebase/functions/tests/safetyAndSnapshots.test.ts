import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import crypto from "crypto";
import {
  acceptBooking,
  confirmPickupCustody,
  placeAdministrativeHold,
  releaseAdministrativeHold,
  submitSafetyReview,
} from "../src/index.js";
import { deriveOperationId } from "../src/utils/crypto.js";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "demo-karri-mobile",
  });
}

const db = admin.firestore();

function hashVerificationCode(code: string, salt: string): string {
  return crypto.pbkdf2Sync(code, salt, 100000, 32, "sha256").toString("hex");
}

function travelerCustodyAcceptanceFixture(
  bookingId: string,
  shipmentId: string,
  travelerId: string,
  overrides: Record<string, any> = {}
) {
  return {
    bookingId,
    shipmentId,
    acceptedByUserId: travelerId,
    custodyVersion: 1,
    custodyPolicyVersion: "v1",
    declarationVersion: "v1",
    packageContentVersion: 1,
    senderDeclarationVersion: "v1",
    inspection: {
      packageAvailableForInspection: true,
      packagingSecure: true,
      weightAppearsReasonable: true,
      noVisibleLeak: true,
      noVisibleBatteryDamage: true,
      noSuspiciousWiring: true,
      noUnusualOdorOrContamination: true,
      noVisibleConcealment: true,
      visibleContentsAppearConsistent: true,
    },
    acknowledgements: {
      personallyInspected: true,
      contentsAppearConsistent: true,
      noSuspiciousItemsObserved: true,
      safeTransportationAccepted: true,
      reasonableCustodyResponsibilityAccepted: true,
    },
    ...overrides,
  };
}

async function seedUserAndProfile(userId: string, displayName: string) {
  await db.collection("users").doc(userId).set({
    userId,
    email: `${userId}@example.com`,
    status: "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
  await db.collection("profiles").doc(userId).set({
    userId,
    displayName,
    homeRegion: "Addis Ababa",
    primaryDestinationCountry: "United States",
    roles: ["sender", "traveler"],
    trustScore: null,
    status: "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

interface SeedOptions {
  shipmentStatus?: string;
  weightKg?: number;
  packageCategory?: string;
  packageDescription?: string;
  originCountry?: string;
  originCity?: string;
  destinationCountry?: string;
  destinationCity?: string;
  deliveryWindow?: string;
  rewardAmount?: number;
  rewardCurrency?: string;
  containsBattery?: boolean;
  batteryType?: string;
  containsLiquid?: boolean;
  containsFoodOrAgri?: boolean;
  containsMedicine?: boolean;
  customsDeclarationRequired?: boolean;
  packageContentVersion?: number;
  bookingStatus?: string;
  tripAvailableKg?: number;
  tripTotalKg?: number;
  pickupVerified?: boolean;
}

async function seedBookingEnvironment(
  bookingId: string,
  senderId = "sender-r06-1",
  travelerId = "traveler-r06-1",
  options: SeedOptions = {}
) {
  const tripId = `trip-${bookingId}`;
  const shipmentId = `shipment-${bookingId}`;
  const reqId = `req-${bookingId}`;
  const bookingStatus = options.bookingStatus ?? "pending";
  const weightKg = options.weightKg ?? 4;
  const pkgVersion = options.packageContentVersion ?? 1;

  await seedUserAndProfile(senderId, "Sender One");
  await seedUserAndProfile(travelerId, "Traveler One");

  await db.collection("trips").doc(tripId).set({
    ownerId: travelerId,
    originCountry: options.originCountry ?? "Ethiopia",
    originCity: options.originCity ?? "Addis Ababa",
    destinationCountry: options.destinationCountry ?? "United States",
    destinationCity: options.destinationCity ?? "Washington",
    departureDate: "2026-03-01",
    arrivalDate: "2026-03-02",
    availableCapacityKg: options.tripAvailableKg ?? 10,
    totalCapacityKg: options.tripTotalKg ?? 10,
    reservedCapacityKg: 0,
    status: "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("shipments").doc(shipmentId).set({
    ownerId: senderId,
    originCountry: options.originCountry ?? "Ethiopia",
    originCity: options.originCity ?? "Addis Ababa",
    destinationCountry: options.destinationCountry ?? "United States",
    destinationCity: options.destinationCity ?? "Washington",
    packageCategory: options.packageCategory ?? "electronics",
    packageDescription: options.packageDescription ?? "High-value camera lens",
    weightKg,
    deliveryWindow: options.deliveryWindow ?? "2026-03-01 to 2026-03-10",
    rewardAmount: options.rewardAmount ?? 85,
    rewardCurrency: options.rewardCurrency ?? "USD",
    status: options.shipmentStatus ?? "active",
    containsBattery: options.containsBattery ?? false,
    batteryType: options.batteryType ?? "none",
    containsLiquid: options.containsLiquid ?? false,
    containsFoodOrAgri: options.containsFoodOrAgri ?? false,
    containsMedicine: options.containsMedicine ?? false,
    customsDeclarationRequired: options.customsDeclarationRequired ?? false,
    packageContentVersion: pkgVersion,
    safetyDeclaration: {
      policyVersion: "2026-07-v1",
      declarationVersion: "v1",
      acceptedAt: admin.firestore.Timestamp.now(),
      acceptedByUserId: senderId,
      packageContentVersion: pkgVersion,
      acknowledgements: {
        contentsAccurate: true,
        noProhibitedItems: true,
        inspectionPermitted: true,
        customsResponsibilityAccepted: true,
      },
    },
    activeBookingId: bookingStatus === "accepted" ? bookingId : null,
    activeCarrierId: bookingStatus === "accepted" ? travelerId : null,
    activeTripId: bookingStatus === "accepted" ? tripId : null,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("bookingRequests").doc(reqId).set({
    bookingId,
    shipmentId,
    tripId,
    senderId,
    travelerId,
    message: "R06 test request",
    status: bookingStatus,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("bookings").doc(bookingId).set({
    bookingRequestId: reqId,
    shipmentId,
    tripId,
    senderId,
    travelerId,
    status: bookingStatus,
    statusHistory: [
      {
        status: bookingStatus,
        changedAt: admin.firestore.Timestamp.now(),
        changedBy: senderId,
      },
    ],
    ...(bookingStatus === "accepted" ? { reservedWeightKg: weightKg } : {}),
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  if (bookingStatus === "accepted") {
    // Seed verified handoff agreement
    const salt = "test-salt-123";
    await db.collection("bookingHandoffSecrets").doc(bookingId).set({
      bookingId,
      pickupCodeHash: hashVerificationCode("123456", salt),
      pickupCodeSalt: salt,
      pickupIssuedAt: admin.firestore.Timestamp.now(),
      deliveryCodeHash: hashVerificationCode("654321", salt),
      deliveryCodeSalt: salt,
      deliveryIssuedAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    await db.collection("bookingHandoffAgreements").doc(bookingId).set({
      bookingId,
      senderContact: { name: "Sender One", phone: "+251911000001", email: "s@test.com" },
      travelerContact: { name: "Traveler One", phone: "+251911000002", email: "t@test.com" },
      receiver: { name: "Dawit", phone: "+12025550199", email: "d@test.com", isSenderReceiver: false, label: "Family" },
      pickup: { meetingPoint: "Airport", scheduledAt: "2026-03-01T08:00:00Z" },
      dropoff: { meetingPoint: "Airport", scheduledAt: "2026-03-02T16:00:00Z" },
      pickupVerification: options.pickupVerified !== false ? {
        verified: true,
        verifiedAt: admin.firestore.Timestamp.now(),
        verifiedByRole: "traveler",
        attemptsRemaining: 4,
      } : {
        verified: false,
        verifiedAt: null,
        verifiedByRole: null,
        attemptsRemaining: 5,
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Write traveler_accepted custody event
    await db.collection("custodyEvents").doc(`${bookingId}__traveler_accepted`).set({
      bookingId,
      shipmentId,
      tripId,
      eventType: "traveler_accepted",
      performedBy: travelerId,
      fromPartyId: senderId,
      fromPartyRole: "sender",
      toPartyId: travelerId,
      toPartyRole: "traveler",
      location: "Addis Ababa",
      note: "Booking accepted",
      sequence: 2,
      previousEventId: `${bookingId}__shipment_created`,
      metadata: { bookingStatus: "accepted" },
      timestamp: admin.firestore.Timestamp.now(),
    });
  }

  return { tripId, shipmentId, reqId, senderId, travelerId };
}

describe("R06 — Transactional Safety Enforcement & Immutable Agreement Snapshots", () => {
  beforeEach(async () => {
    const collections = [
      "bookings",
      "bookingRequests",
      "shipments",
      "trips",
      "custodyEvents",
      "bookingHandoffAgreements",
      "bookingHandoffSecrets",
      "bookingAgreementSnapshots",
      "administrativeHolds",
      "shipmentSafetyReviews",
      "profiles",
      "users",
      "auditLogs",
    ];
    for (const c of collections) {
      const snap = await db.collection(c).get();
      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
  });

  describe("Section 3: Deterministic Hold-Before-Acceptance Proof", () => {
    it("proves hold committed first causes acceptBooking to fail and leaves all related entities untouched", async () => {
      const bookingId = "bk-det-hold-first";
      const { shipmentId, travelerId, tripId } = await seedBookingEnvironment(bookingId);

      // 1. Create blocking administrative hold and await committed write
      await db.collection("administrativeHolds").doc("hold-det-1").set({
        shipmentId,
        status: "active",
        reasonCode: "suspected_policy_violation",
        note: "Automated scanner flagged suspicious item",
        placedByUid: "safety-admin-1",
        placedByRole: "safety_admin",
        placedAt: admin.firestore.Timestamp.now(),
      });

      // 2. Invoke acceptBooking
      const acceptReq = {
        data: { bookingId },
        auth: { uid: travelerId },
      };

      await expect(acceptBooking.run(acceptReq as any)).rejects.toThrowError(
        /Shipment is subject to an active administrative hold/
      );

      // 3. Inspect and verify actual persisted values
      const bSnap = await db.collection("bookings").doc(bookingId).get();
      expect(bSnap.exists).toBe(true);
      expect(bSnap.data()?.status).toBe("pending");
      expect(bSnap.data()?.statusHistory.length).toBe(1);

      const tripSnap = await db.collection("trips").doc(tripId).get();
      expect(tripSnap.data()?.reservedCapacityKg).toBe(0);
      expect(tripSnap.data()?.availableCapacityKg).toBe(10);

      const shipSnap = await db.collection("shipments").doc(shipmentId).get();
      expect(shipSnap.data()?.activeBookingId).toBeNull();
      expect(shipSnap.data()?.activeCarrierId).toBeNull();

      const snapDoc = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      expect(snapDoc.exists).toBe(false);

      const custSnap = await db.collection("custodyEvents").doc(`${bookingId}__traveler_accepted`).get();
      expect(custSnap.exists).toBe(false);

      const handoffSnap = await db.collection("bookingHandoffAgreements").doc(bookingId).get();
      expect(handoffSnap.exists).toBe(false);
    });
  });

  describe("Section 4: Deterministic Acceptance-Before-Hold Proof", () => {
    it("proves post-acceptance hold stops pickup custody without falsifying acceptance record", async () => {
      const bookingId = "bk-det-accept-first";
      const { shipmentId, travelerId, tripId } = await seedBookingEnvironment(bookingId, undefined, undefined, {
        weightKg: 4,
      });

      // 1. Complete acceptBooking successfully
      const acceptReq = {
        data: { bookingId },
        auth: { uid: travelerId },
      };
      const res = await acceptBooking.run(acceptReq as any);
      expect(res.success).toBe(true);

      // Verify acceptance persisted
      const bSnapPre = await db.collection("bookings").doc(bookingId).get();
      expect(bSnapPre.data()?.status).toBe("accepted");
      const snapDocPre = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      expect(snapDocPre.exists).toBe(true);
      const tripSnapPre = await db.collection("trips").doc(tripId).get();
      expect(tripSnapPre.data()?.reservedCapacityKg).toBe(4);

      // Satisfy pickup verification prerequisite
      await db.collection("bookingHandoffAgreements").doc(bookingId).update({
        "pickupVerification.verified": true,
        "pickupVerification.verifiedAt": admin.firestore.Timestamp.now(),
        "pickupVerification.verifiedByRole": "traveler",
      });

      // 2. Commit blocking administrative hold
      await db.collection("administrativeHolds").doc("hold-det-2").set({
        shipmentId,
        status: "active",
        reasonCode: "prohibited_contents",
        note: "Post-acceptance safety hold placed by operations",
        placedByUid: "operations-admin-1",
        placedByRole: "operations_admin",
        placedAt: admin.firestore.Timestamp.now(),
      });

      // 3. Attempt confirmPickupCustody
      const pickupReq = {
        data: {
          bookingId,
          custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
        },
        auth: { uid: travelerId },
      };

      await expect(confirmPickupCustody.run(pickupReq as any)).rejects.toThrowError(
        /Shipment is subject to an active administrative hold/
      );

      // Verify post-attempt persisted values
      const bSnapPost = await db.collection("bookings").doc(bookingId).get();
      expect(bSnapPost.data()?.status).toBe("accepted"); // Does NOT become in_transit
      expect(bSnapPost.data()?.status).not.toBe("in_transit");

      const snapDocPost = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      expect(snapDocPost.exists).toBe(true); // Snapshot remains intact

      const tripSnapPost = await db.collection("trips").doc(tripId).get();
      expect(tripSnapPost.data()?.reservedCapacityKg).toBe(4); // Capacity reservation remains intact

      const pickupEventSnap = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(pickupEventSnap.exists).toBe(false); // pickup_confirmed absent

      const travelerAcceptanceSnap = await db.collection("travelerCustodyAcceptances").doc(bookingId).get();
      expect(travelerAcceptanceSnap.exists).toBe(false); // travelerCustodyAcceptance absent
    });
  });

  describe("Section 5: Genuine Concurrent Race Evidence", () => {
    it("proves concurrent hold and acceptance serialize with zero invalid states over 20 iterations", async () => {
      const raceRuns = 20;
      let outcomeACount = 0; // acceptBooking commits first, hold commits second -> pickup denied
      let outcomeBCount = 0; // hold commits first, acceptBooking denied
      let invalidCount = 0;

      for (let i = 0; i < raceRuns; i++) {
        const bookingId = `bk-race-${i}`;
        const { shipmentId, travelerId } = await seedBookingEnvironment(bookingId);

        const holdPromise = placeAdministrativeHold.run({
          data: {
            shipmentId,
            reasonCode: "suspected_policy_violation",
            note: `Race test ${i}`,
            idempotencyKey: `idem-race-${i}`,
          },
          auth: {
            uid: "safety-admin-1",
            token: { role: "safety_admin" },
          },
        } as any);

        const acceptPromise = acceptBooking.run({
          data: { bookingId },
          auth: { uid: travelerId },
        } as any);

        const results = await Promise.allSettled([holdPromise, acceptPromise]);
        const holdResult = results[0];
        const acceptResult = results[1];

        // Inspect final database state
        const bSnap = await db.collection("bookings").doc(bookingId).get();
        const bStatus = bSnap.data()?.status;
        const holdSnap = await db.collection("administrativeHolds")
          .where("shipmentId", "==", shipmentId)
          .where("status", "==", "active")
          .get();
        const hasActiveHold = !holdSnap.empty;

        if (acceptResult.status === "fulfilled" && bStatus === "accepted") {
          // Outcome A: Acceptance committed first, hold committed second
          outcomeACount++;
          expect(hasActiveHold).toBe(true);

          // In Outcome A, verify that subsequent pickup custody is strictly DENIED
          // Satisfy R04 verification
          await db.collection("bookingHandoffAgreements").doc(bookingId).update({
            "pickupVerification.verified": true,
            "pickupVerification.verifiedAt": admin.firestore.Timestamp.now(),
            "pickupVerification.verifiedByRole": "traveler",
          });
          const pickupReq = {
            data: {
              bookingId,
              custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
            },
            auth: { uid: travelerId },
          };
          await expect(confirmPickupCustody.run(pickupReq as any)).rejects.toThrowError(
            /Shipment is subject to an active administrative hold/
          );
        } else if (acceptResult.status === "rejected" && bStatus === "pending") {
          // Outcome B: Hold committed first, acceptance denied
          outcomeBCount++;
          expect(hasActiveHold).toBe(true);
        } else {
          // Any other outcome is an invalid condition
          invalidCount++;
        }
      }

      console.log(`[Concurrent Race Verification] Runs: ${raceRuns} | Outcome A (accept first): ${outcomeACount} | Outcome B (hold first): ${outcomeBCount} | Invalid: ${invalidCount}`);
      expect(invalidCount).toBe(0);
      expect(outcomeACount + outcomeBCount).toBe(raceRuns);
    });
  });

  describe("Section 6: Independent Safety Review States", () => {
    it("proves blocking rejected review causes acceptance to be DENIED", async () => {
      const bookingId = "bk-rev-rej-accept";
      const { shipmentId, travelerId } = await seedBookingEnvironment(bookingId);

      await db.collection("shipmentSafetyReviews").doc("rev-rej-1").set({
        shipmentId,
        decision: "rejected",
        reasonCode: "prohibited_item",
        note: "Prohibited hazardous material detected.",
        actorUid: "safety-admin-1",
        createdAt: admin.firestore.Timestamp.now(),
      });

      await expect(
        acceptBooking.run({ data: { bookingId }, auth: { uid: travelerId } } as any)
      ).rejects.toThrowError(/Shipment safety review was rejected/);

      const bSnap = await db.collection("bookings").doc(bookingId).get();
      expect(bSnap.data()?.status).toBe("pending");
    });

    it("proves blocking unresolved (needs_more_information) review causes acceptance to be DENIED", async () => {
      const bookingId = "bk-rev-pending-accept";
      const { shipmentId, travelerId } = await seedBookingEnvironment(bookingId);

      await db.collection("shipmentSafetyReviews").doc("rev-pending-1").set({
        shipmentId,
        decision: "needs_more_information",
        reasonCode: "documentation_missing",
        note: "Requires purchase invoice",
        actorUid: "safety-admin-1",
        createdAt: admin.firestore.Timestamp.now(),
      });

      await expect(
        acceptBooking.run({ data: { bookingId }, auth: { uid: travelerId } } as any)
      ).rejects.toThrowError(/Shipment safety review requires additional information/);

      const bSnap = await db.collection("bookings").doc(bookingId).get();
      expect(bSnap.data()?.status).toBe("pending");
    });

    it("proves blocking rejected review causes pickup to be DENIED", async () => {
      const bookingId = "bk-rev-rej-pickup";
      const { shipmentId, travelerId } = await seedBookingEnvironment(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
      });

      await db.collection("bookingAgreementSnapshots").doc(bookingId).set({
        bookingId,
        shipmentId,
        tripId: `trip-${bookingId}`,
        senderId: "sender-r06-1",
        travelerId,
        packageCategory: "electronics",
        packageDescription: "Camera",
        weightKg: 4,
        packageContentVersion: 1,
        senderSafetyDeclaration: { declarationVersion: "v1" },
        createdAt: admin.firestore.Timestamp.now(),
      });

      await db.collection("shipmentSafetyReviews").doc("rev-rej-2").set({
        shipmentId,
        decision: "rejected",
        reasonCode: "hazardous_material",
        actorUid: "safety-admin-1",
        createdAt: admin.firestore.Timestamp.now(),
      });

      await expect(
        confirmPickupCustody.run({
          data: { bookingId, custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId) },
          auth: { uid: travelerId },
        } as any)
      ).rejects.toThrowError(/Shipment safety review was rejected/);

      const bSnap = await db.collection("bookings").doc(bookingId).get();
      expect(bSnap.data()?.status).toBe("accepted");
    });

    it("proves blocking unresolved (needs_more_information) review causes pickup to be DENIED", async () => {
      const bookingId = "bk-rev-pending-pickup";
      const { shipmentId, travelerId } = await seedBookingEnvironment(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
      });

      await db.collection("bookingAgreementSnapshots").doc(bookingId).set({
        bookingId,
        shipmentId,
        tripId: `trip-${bookingId}`,
        senderId: "sender-r06-1",
        travelerId,
        packageCategory: "electronics",
        packageDescription: "Camera",
        weightKg: 4,
        packageContentVersion: 1,
        senderSafetyDeclaration: { declarationVersion: "v1" },
        createdAt: admin.firestore.Timestamp.now(),
      });

      await db.collection("shipmentSafetyReviews").doc("rev-pending-2").set({
        shipmentId,
        decision: "needs_more_information",
        reasonCode: "insufficient_information",
        actorUid: "safety-admin-1",
        createdAt: admin.firestore.Timestamp.now(),
      });

      await expect(
        confirmPickupCustody.run({
          data: { bookingId, custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId) },
          auth: { uid: travelerId },
        } as any)
      ).rejects.toThrowError(/Shipment safety review requires additional information/);

      const bSnap = await db.collection("bookings").doc(bookingId).get();
      expect(bSnap.data()?.status).toBe("accepted");
    });

    it("proves approved review allows both acceptance and pickup progression", async () => {
      const bookingId = "bk-rev-app-full";
      const { shipmentId, travelerId } = await seedBookingEnvironment(bookingId);

      await db.collection("shipmentSafetyReviews").doc("rev-app-1").set({
        shipmentId,
        decision: "approved",
        reasonCode: "verified_safe",
        actorUid: "safety-admin-1",
        createdAt: admin.firestore.Timestamp.now(),
      });

      // 1. Acceptance ALLOWED
      const acceptRes = await acceptBooking.run({
        data: { bookingId },
        auth: { uid: travelerId },
      } as any);
      expect(acceptRes.success).toBe(true);

      // Satisfy pickup verification prerequisite
      await db.collection("bookingHandoffAgreements").doc(bookingId).update({
        "pickupVerification.verified": true,
        "pickupVerification.verifiedAt": admin.firestore.Timestamp.now(),
        "pickupVerification.verifiedByRole": "traveler",
      });

      // 2. Pickup ALLOWED
      const pickupRes = await confirmPickupCustody.run({
        data: { bookingId, custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId) },
        auth: { uid: travelerId },
      } as any);
      expect(pickupRes.success).toBe(true);
      expect(pickupRes.status).toBe("in_transit");
    });
  });

  describe("Section 9: Atomic Rollback Test", () => {
    it("proves snapshot is rolled back atomically when transaction fails before commit", async () => {
      const bookingId = "bk-atomic-rollback";
      const { shipmentId, travelerId, tripId, senderId } = await seedBookingEnvironment(bookingId);

      const snapshotRef = db.collection("bookingAgreementSnapshots").doc(bookingId);
      const bookingRef = db.collection("bookings").doc(bookingId);
      const tripRef = db.collection("trips").doc(tripId);
      const shipmentRef = db.collection("shipments").doc(shipmentId);

      // Execute a transaction that stages snapshot creation and other booking updates,
      // but fails before commit due to a controlled validation failure
      await expect(
        db.runTransaction(async (transaction) => {
          // Stage snapshot write
          transaction.set(snapshotRef, {
            bookingId,
            shipmentId,
            tripId,
            senderId,
            travelerId,
            weightKg: 5,
            packageCategory: "general",
            packageDescription: "Test parcel",
            packageContentVersion: 1,
            snapshotVersion: 1,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Stage booking update
          transaction.update(bookingRef, {
            status: "accepted",
          });

          // Stage trip update
          transaction.update(tripRef, {
            reservedCapacityKg: 5,
          });

          // Stage shipment update
          transaction.update(shipmentRef, {
            activeBookingId: bookingId,
          });

          // Controlled rejection before transaction commits
          throw new Error("CONTROLLED_TRANSACTION_ROLLBACK");
        })
      ).rejects.toThrow("CONTROLLED_TRANSACTION_ROLLBACK");

      // Verify that NONE of the staged writes were committed to Firestore
      const snapDoc = await snapshotRef.get();
      expect(snapDoc.exists).toBe(false); // snapshot exists: NO

      const bSnap = await bookingRef.get();
      expect(bSnap.data()?.status).toBe("pending"); // booking accepted: NO

      const tripSnap = await tripRef.get();
      expect(tripSnap.data()?.reservedCapacityKg).toBe(0); // trip reserved: NO

      const shipSnap = await shipmentRef.get();
      expect(shipSnap.data()?.activeBookingId).toBeNull(); // shipment claimed: NO
    });
  });

  describe("Section 10: Exact-Value Snapshot Test", () => {
    it("captures every source field with exact values into immutable agreement snapshot", async () => {
      const bookingId = "bk-exact-value";
      const { shipmentId, travelerId, senderId, tripId } = await seedBookingEnvironment(
        bookingId,
        "sender-synth-1",
        "traveler-synth-1",
        {
          weightKg: 7.25,
          packageCategory: "specialized_equipment",
          packageDescription: "R06 exact-value synthetic fixture",
          originCountry: "Ethiopia",
          originCity: "Dire Dawa",
          destinationCountry: "United States",
          destinationCity: "Alexandria",
          deliveryWindow: "2026-03-05 to 2026-03-12",
          rewardAmount: 145.5,
          rewardCurrency: "USD",
          containsBattery: true,
          batteryType: "lithium_ion",
          containsLiquid: false,
          containsFoodOrAgri: false,
          containsMedicine: false,
          customsDeclarationRequired: true,
          packageContentVersion: 3,
        }
      );

      const acceptRes = await acceptBooking.run({
        data: { bookingId },
        auth: { uid: travelerId },
      } as any);
      expect(acceptRes.success).toBe(true);

      const snapDoc = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      expect(snapDoc.exists).toBe(true);
      const snapshot = snapDoc.data()!;

      const shipSnap = await db.collection("shipments").doc(shipmentId).get();
      const sourceShipment = shipSnap.data()!;

      // Field-by-field equality verification
      expect(snapshot.bookingId).toBe(bookingId);
      expect(snapshot.shipmentId).toBe(shipmentId);
      expect(snapshot.tripId).toBe(tripId);
      expect(snapshot.senderId).toBe(senderId);
      expect(snapshot.travelerId).toBe(travelerId);
      expect(snapshot.weightKg).toBe(sourceShipment.weightKg);
      expect(snapshot.packageCategory).toBe(sourceShipment.packageCategory);
      expect(snapshot.packageDescription).toBe(sourceShipment.packageDescription);
      expect(snapshot.originCountry).toBe(sourceShipment.originCountry);
      expect(snapshot.originCity).toBe(sourceShipment.originCity);
      expect(snapshot.destinationCountry).toBe(sourceShipment.destinationCountry);
      expect(snapshot.destinationCity).toBe(sourceShipment.destinationCity);
      expect(snapshot.deliveryWindow).toBe(sourceShipment.deliveryWindow);
      expect(snapshot.rewardAmount).toBe(sourceShipment.rewardAmount);
      expect(snapshot.rewardCurrency).toBe(sourceShipment.rewardCurrency);
      expect(snapshot.containsBattery).toBe(sourceShipment.containsBattery);
      expect(snapshot.batteryType).toBe(sourceShipment.batteryType);
      expect(snapshot.containsLiquid).toBe(sourceShipment.containsLiquid);
      expect(snapshot.containsFoodOrAgri).toBe(sourceShipment.containsFoodOrAgri);
      expect(snapshot.containsMedicine).toBe(sourceShipment.containsMedicine);
      expect(snapshot.customsDeclarationRequired).toBe(sourceShipment.customsDeclarationRequired);
      expect(snapshot.packageContentVersion).toBe(sourceShipment.packageContentVersion);
      expect(snapshot.snapshotVersion).toBe(1);
      expect(snapshot.senderSafetyDeclaration).toEqual(sourceShipment.safetyDeclaration);
      expect(snapshot.createdAt).toBeDefined();
    });
  });

  describe("Section 12: Legacy Missing-Snapshot Proof", () => {
    it("proves pickup is denied when snapshot is missing and confirms NO auto-reconstruction occurs", async () => {
      const bookingId = "bk-legacy-missing-snap";
      const { shipmentId, travelerId } = await seedBookingEnvironment(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
      });

      // Explicitly ensure bookingAgreementSnapshots/{bookingId} does NOT exist
      const snapRef = db.collection("bookingAgreementSnapshots").doc(bookingId);
      await snapRef.delete();
      expect((await snapRef.get()).exists).toBe(false);

      const pickupReq = {
        data: {
          bookingId,
          custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
        },
        auth: { uid: travelerId },
      };

      // 1. Pickup DENIED
      await expect(confirmPickupCustody.run(pickupReq as any)).rejects.toThrowError(
        /Accepted booking agreement snapshot is missing/
      );

      // 2. Snapshot NOT auto-reconstructed
      const snapDocPost = await snapRef.get();
      expect(snapDocPost.exists).toBe(false); // SNAPSHOT AUTO-RECONSTRUCTED: NO

      // 3. Booking final state remains accepted
      const bSnap = await db.collection("bookings").doc(bookingId).get();
      expect(bSnap.data()?.status).toBe("accepted");

      // 4. No pickup event created
      const pickupEvent = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(pickupEvent.exists).toBe(false);

      // 5. No traveler custody acceptance created
      const travelerAcceptance = await db.collection("travelerCustodyAcceptances").doc(bookingId).get();
      expect(travelerAcceptance.exists).toBe(false);
    });
  });

  describe("Section 13: Snapshot Retry Immutability", () => {
    it("proves retry of acceptBooking preserves original snapshot document and timestamp without rewrite", async () => {
      const bookingId = "bk-retry-immutability";
      const { travelerId } = await seedBookingEnvironment(bookingId);

      const acceptReq = {
        data: { bookingId },
        auth: { uid: travelerId },
      };

      const res1 = await acceptBooking.run(acceptReq as any);
      expect(res1.alreadyAccepted).toBe(false);

      const snap1 = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      expect(snap1.exists).toBe(true);
      const snap1Data = snap1.data()!;
      const originalCreatedAt = snap1Data.createdAt;

      // Retry acceptance
      const res2 = await acceptBooking.run(acceptReq as any);
      expect(res2.alreadyAccepted).toBe(true);

      const snap2 = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      expect(snap2.exists).toBe(true);
      const snap2Data = snap2.data()!;

      expect(snap2Data).toEqual(snap1Data);
      expect(snap2Data.createdAt).toEqual(originalCreatedAt);
      expect(snap2Data.snapshotVersion).toBe(1);
    });
  });

  describe("Section 14: Mutable Listing Drift Proof", () => {
    it("proves legitimate non-critical listing update does not alter the immutable agreement snapshot", async () => {
      const bookingId = "bk-drift-test";
      const { shipmentId, travelerId } = await seedBookingEnvironment(bookingId);

      // 1. Accept booking
      await acceptBooking.run({
        data: { bookingId },
        auth: { uid: travelerId },
      } as any);

      const snapDocBefore = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      const initialSnapshot = snapDocBefore.data()!;

      // 2. Update legitimate non-critical field: status = "closed"
      await db.collection("shipments").doc(shipmentId).update({
        status: "closed",
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Verify live shipment changed
      const shipSnap = await db.collection("shipments").doc(shipmentId).get();
      expect(shipSnap.data()?.status).toBe("closed");

      // 3. Verify agreement snapshot remains 100% UNCHANGED
      const snapDocAfter = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      const postSnapshot = snapDocAfter.data()!;

      expect(postSnapshot.weightKg).toBe(initialSnapshot.weightKg);
      expect(postSnapshot.packageCategory).toBe(initialSnapshot.packageCategory);
      expect(postSnapshot.packageDescription).toBe(initialSnapshot.packageDescription);
      expect(postSnapshot.packageContentVersion).toBe(initialSnapshot.packageContentVersion);
      expect(postSnapshot.rewardAmount).toBe(initialSnapshot.rewardAmount);
      expect(postSnapshot.snapshotVersion).toBe(1);
      expect(postSnapshot.createdAt).toEqual(initialSnapshot.createdAt);
    });
  });
});
