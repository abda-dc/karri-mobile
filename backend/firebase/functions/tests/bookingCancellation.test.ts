import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import {
  cancelBooking,
  declineBooking,
  acceptBooking,
  confirmPickupCustody,
  confirmDeliveryCustody,
  issueHandoffVerificationCode,
  verifyPickupHandoff,
  verifyDeliveryHandoff,
  placeAdministrativeHold,
} from "../src/index.js";
import {
  BookingCancellationReasonCode,
  BookingDeclineReasonCode,
} from "../src/utils/reasonCodes.js";
import { deriveLifecycleNotificationId } from "../src/notifications/BookingAcceptedNotificationService.js";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "demo-karri-mobile",
  });
}

const db = admin.firestore();

interface SeedBookingFixtureOptions {
  status?: "pending" | "accepted" | "in_transit" | "delivered" | "completed";
  reservedWeightKg?: number;
  totalCapacityKg?: number;
  availableCapacityKg?: number;
  reservedCapacityKg?: number;
  withSnapshot?: boolean;
  withAcceptedEvent?: boolean;
  withPickupEvent?: boolean;
  withHold?: boolean;
  pickupVerified?: boolean;
}

async function seedTestBooking(
  bookingId: string,
  senderId = "sender-r08-1",
  travelerId = "traveler-r08-1",
  options: SeedBookingFixtureOptions = {},
) {
  const tripId = `trip-${bookingId}`;
  const shipmentId = `shipment-${bookingId}`;
  const reqId = `req-${bookingId}`;
  const status = options.status ?? "pending";
  const weightKg = options.reservedWeightKg ?? 3;
  const totalCapacityKg = options.totalCapacityKg ?? 10;
  const reservedCapacityKg =
    options.reservedCapacityKg ?? (status === "pending" ? 0 : weightKg);
  const availableCapacityKg =
    options.availableCapacityKg ?? (totalCapacityKg - reservedCapacityKg);

  await db.collection("profiles").doc(senderId).set({
    displayName: "Sender Abebe",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("profiles").doc(travelerId).set({
    displayName: "Traveler Chala",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("trips").doc(tripId).set({
    ownerId: travelerId,
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    departureDate: "2026-04-01",
    arrivalDate: "2026-04-02",
    totalCapacityKg,
    availableCapacityKg,
    reservedCapacityKg,
    status: "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  const shipmentData: Record<string, any> = {
    ownerId: senderId,
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    packageCategory: "documents",
    packageDescription: "Important legal papers",
    weightKg,
    deliveryWindow: "2026-04-01 to 2026-04-10",
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
    activeBookingId: status === "pending" ? null : bookingId,
    activeCarrierId: status === "pending" ? null : travelerId,
    activeTripId: status === "pending" ? null : tripId,
    safetyDeclaration: {
      policyVersion: "2026-07-v1",
      declarationVersion: "v1",
    },
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  };

  await db.collection("shipments").doc(shipmentId).set(shipmentData);

  if (options.withHold) {
    await db.collection("administrativeHolds").doc(`hold-${shipmentId}`).set({
      shipmentId,
      status: "active",
      placedByUid: "safety-admin-1",
      placedByRole: "safety_admin",
      placedAt: admin.firestore.Timestamp.now(),
      reasonCode: "manual_investigation",
      note: "Investigating shipment safety flag",
    });
  }

  await db.collection("bookingRequests").doc(reqId).set({
    bookingId,
    shipmentId,
    tripId,
    senderId,
    travelerId,
    message: "R08 lifecycle test",
    status,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  const history = [
    {
      status: "pending",
      changedAt: admin.firestore.Timestamp.now(),
      changedBy: senderId,
    },
  ];

  if (status !== "pending") {
    history.push({
      status: "accepted",
      changedAt: admin.firestore.Timestamp.now(),
      changedBy: travelerId,
    });
  }
  if (status === "in_transit" || status === "delivered" || status === "completed") {
    history.push({
      status: "in_transit",
      changedAt: admin.firestore.Timestamp.now(),
      changedBy: travelerId,
    });
  }
  if (status === "delivered" || status === "completed") {
    history.push({
      status: "delivered",
      changedAt: admin.firestore.Timestamp.now(),
      changedBy: travelerId,
    });
  }
  if (status === "completed") {
    history.push({
      status: "completed",
      changedAt: admin.firestore.Timestamp.now(),
      changedBy: senderId,
    });
  }

  await db.collection("bookings").doc(bookingId).set({
    bookingRequestId: reqId,
    shipmentId,
    tripId,
    senderId,
    travelerId,
    status,
    statusHistory: history,
    ...(status !== "pending" ? { reservedWeightKg: weightKg } : {}),
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  if (options.withSnapshot !== false && status !== "pending") {
    await db.collection("bookingAgreementSnapshots").doc(bookingId).set({
      bookingId,
      shipmentId,
      tripId,
      senderId,
      travelerId,
      packageCategory: "documents",
      packageDescription: "Important legal papers",
      weightKg,
      originCountry: "Ethiopia",
      originCity: "Addis Ababa",
      destinationCountry: "United States",
      destinationCity: "Washington",
      deliveryWindow: "2026-04-01 to 2026-04-10",
      rewardAmount: 50,
      rewardCurrency: "USD",
      containsBattery: false,
      batteryType: "none",
      containsLiquid: false,
      containsFoodOrAgri: false,
      containsMedicine: false,
      customsDeclarationRequired: false,
      packageContentVersion: 1,
      senderSafetyDeclaration: {
        policyVersion: "2026-07-v1",
        declarationVersion: "v1",
      },
      snapshotVersion: 1,
      createdAt: admin.firestore.Timestamp.now(),
    });
  }

  if (options.withAcceptedEvent !== false && status !== "pending") {
    await db.collection("custodyEvents").doc(`${bookingId}__traveler_accepted`).set({
      bookingId,
      shipmentId,
      tripId,
      eventType: "traveler_accepted",
      performedBy: travelerId,
      timestamp: admin.firestore.Timestamp.now(),
    });
  }

  if (options.withPickupEvent || status === "in_transit" || status === "delivered" || status === "completed") {
    await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).set({
      bookingId,
      shipmentId,
      tripId,
      eventType: "pickup_confirmed",
      performedBy: travelerId,
      timestamp: admin.firestore.Timestamp.now(),
    });
  }

  await db.collection("bookingHandoffAgreements").doc(bookingId).set({
    bookingId,
    pickupVerification: {
      verified: options.pickupVerified ?? (status !== "pending"),
      verifiedAt: admin.firestore.Timestamp.now(),
      verifiedBy: travelerId,
      failedAttempts: 0,
    },
    deliveryVerification: {
      verified: status === "delivered" || status === "completed",
      verifiedAt: status === "delivered" || status === "completed" ? admin.firestore.Timestamp.now() : null,
      verifiedBy: status === "delivered" || status === "completed" ? travelerId : null,
      failedAttempts: 0,
    },
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  if (status !== "pending") {
    await db.collection("bookingHandoffSecrets").doc(bookingId).set({
      bookingId,
      senderId,
      travelerId,
      pickupCodeHash: null,
      pickupSalt: null,
      pickupIssued: false,
      pickupAttempts: 0,
      pickupMaxAttempts: 5,
      pickupVerified: options.pickupVerified ?? true,
      pickupGeneratedAt: null,
      deliveryCodeHash: null,
      deliverySalt: null,
      deliveryIssued: false,
      deliveryAttempts: 0,
      deliveryMaxAttempts: 5,
      deliveryVerified: status === "delivered" || status === "completed",
      deliveryGeneratedAt: null,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }

  return { tripId, shipmentId, reqId, senderId, travelerId, weightKg };
}

function makeCustodyDeclaration(
  bookingId: string,
  shipmentId: string,
  travelerId: string,
) {
  return {
    bookingId,
    shipmentId,
    acceptedByUserId: travelerId,
    custodyVersion: 1,
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
  };
}

async function seedUserPreferences(userId: string) {
  const timestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-01T11:00:00.000Z"));
  await db.collection("notificationPreferences").doc(userId).set({
    userId,
    channels: { push: true, email: false, sms: false },
    categories: {
      booking_requests: true,
      booking_updates: true,
      custody_updates: true,
      delivery_updates: true,
      general_announcements: false,
      review_reminders: false,
      trust_profile_alerts: false,
    },
    quietHours: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

describe("R08 — Cancellation, No-Show, and Failed-Handoff Lifecycle", () => {
  beforeEach(async () => {
    const collections = [
      "bookings",
      "bookingRequests",
      "shipments",
      "trips",
      "custodyEvents",
      "bookingAgreementSnapshots",
      "bookingHandoffAgreements",
      "bookingHandoffSecrets",
      "administrativeHolds",
      "notifications",
    ];
    for (const name of collections) {
      const snap = await db.collection(name).get();
      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
  });

  describe("Invariant 1 & 8: Authoritative Authorization", () => {
    it("allows sender to cancel pending booking", async () => {
      const bookingId = "bk-auth-sender-pending";
      const { senderId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "pending",
      });

      const res = await cancelBooking.run({
        data: {
          bookingId,
          reasonCode: BookingCancellationReasonCode.SENDER_REQUESTED,
        },
        auth: { uid: senderId, token: {} },
      } as any);

      expect(res.success).toBe(true);
      expect(res.status).toBe("cancelled");
      expect(res.cancelled).toBe(true);
      expect(res.idempotent).toBe(false);

      const bDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bDoc.data()?.status).toBe("cancelled");
      expect(bDoc.data()?.statusHistory).toHaveLength(2);
      expect(bDoc.data()?.statusHistory[1].reasonCode).toBe(
        BookingCancellationReasonCode.SENDER_REQUESTED,
      );
    });

    it("allows traveler to decline pending booking", async () => {
      const bookingId = "bk-auth-traveler-decline";
      const { travelerId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "pending",
      });

      const res = await declineBooking.run({
        data: {
          bookingId,
          reasonCode: BookingDeclineReasonCode.CAPACITY_UNAVAILABLE,
        },
        auth: { uid: travelerId, token: {} },
      } as any);

      expect(res.success).toBe(true);
      expect(res.status).toBe("declined");
      expect(res.declined).toBe(true);
      expect(res.idempotent).toBe(false);

      const bDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bDoc.data()?.status).toBe("declined");
    });

    it("denies traveler attempting to cancel a pending booking (must decline)", async () => {
      const bookingId = "bk-deny-traveler-cancel-pending";
      const { travelerId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "pending",
      });

      await expect(
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Only the booking sender can cancel a pending booking request/);
    });

    it("denies sender attempting to decline a booking", async () => {
      const bookingId = "bk-deny-sender-decline";
      const { senderId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "pending",
      });

      await expect(
        declineBooking.run({
          data: { bookingId },
          auth: { uid: senderId, token: {} },
        } as any),
      ).rejects.toThrow(/Only the assigned traveler can decline/);
    });

    it("denies an unrelated user attempting to cancel", async () => {
      const bookingId = "bk-deny-unrelated";
      await seedTestBooking(bookingId, "sender-1", "traveler-1", { status: "pending" });

      await expect(
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: "unrelated-user-999", token: {} },
        } as any),
      ).rejects.toThrow(/Only booking participants can cancel this booking/);
    });

    it("fails with not-found for non-existent booking", async () => {
      await expect(
        cancelBooking.run({
          data: { bookingId: "non-existent-booking-id" },
          auth: { uid: "sender-1", token: {} },
        } as any),
      ).rejects.toThrow(/Booking not found/);
    });
  });

  describe("Invariant 2 & 10: Legal Cancellation Windows & Custody Fail-Closed", () => {
    it("allows sender to cancel accepted booking before physical custody", async () => {
      const bookingId = "bk-cancel-acc-sender";
      const { senderId, tripId, shipmentId } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 3,
          totalCapacityKg: 10,
          reservedCapacityKg: 3,
          availableCapacityKg: 7,
        },
      );

      const res = await cancelBooking.run({
        data: {
          bookingId,
          reasonCode: BookingCancellationReasonCode.SENDER_REQUESTED,
        },
        auth: { uid: senderId, token: {} },
      } as any);

      expect(res.success).toBe(true);
      expect(res.status).toBe("cancelled");
      expect(res.capacityRestored).toBe(true);
      expect(res.shipmentReleased).toBe(true);

      const tripDoc = await db.collection("trips").doc(tripId).get();
      expect(tripDoc.data()?.reservedCapacityKg).toBe(0);
      expect(tripDoc.data()?.availableCapacityKg).toBe(10);

      const shipDoc = await db.collection("shipments").doc(shipmentId).get();
      expect(shipDoc.data()?.activeBookingId).toBeNull();
      expect(shipDoc.data()?.activeCarrierId).toBeNull();
    });

    it("allows traveler to cancel accepted booking before physical custody (e.g. flight cancelled)", async () => {
      const bookingId = "bk-cancel-acc-traveler";
      const { travelerId, tripId, shipmentId } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          reservedCapacityKg: 4,
          availableCapacityKg: 6,
        },
      );

      const res = await cancelBooking.run({
        data: {
          bookingId,
          reasonCode: BookingCancellationReasonCode.FLIGHT_CANCELLED,
        },
        auth: { uid: travelerId, token: {} },
      } as any);

      expect(res.success).toBe(true);
      expect(res.capacityRestored).toBe(true);
      expect(res.shipmentReleased).toBe(true);

      const tripDoc = await db.collection("trips").doc(tripId).get();
      expect(tripDoc.data()?.reservedCapacityKg).toBe(0);
      expect(tripDoc.data()?.availableCapacityKg).toBe(10);

      const shipDoc = await db.collection("shipments").doc(shipmentId).get();
      expect(shipDoc.data()?.activeBookingId).toBeNull();
    });

    it("denies normal cancellation once in_transit (physical custody established)", async () => {
      const bookingId = "bk-deny-intransit";
      const { senderId, travelerId } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "in_transit",
        },
      );

      await expect(
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: senderId, token: {} },
        } as any),
      ).rejects.toThrow(/Cancellation is not permitted once physical custody has begun/);

      await expect(
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Cancellation is not permitted once physical custody has begun/);
    });

    it("denies cancellation when delivered or completed", async () => {
      const delivBookingId = "bk-deny-deliv";
      const { senderId: s1 } = await seedTestBooking(delivBookingId, undefined, undefined, {
        status: "delivered",
      });
      await expect(
        cancelBooking.run({
          data: { bookingId: delivBookingId },
          auth: { uid: s1, token: {} },
        } as any),
      ).rejects.toThrow(/Cancellation is not permitted once physical custody has begun/);

      const compBookingId = "bk-deny-comp";
      const { senderId: s2 } = await seedTestBooking(compBookingId, undefined, undefined, {
        status: "completed",
      });
      await expect(
        cancelBooking.run({
          data: { bookingId: compBookingId },
          auth: { uid: s2, token: {} },
        } as any),
      ).rejects.toThrow(/Cancellation is not permitted once physical custody has begun/);
    });

    it("denies cancellation if physical pickup custody event exists even if booking status is accepted", async () => {
      const bookingId = "bk-deny-pickup-event-exists";
      const { senderId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "accepted",
        withPickupEvent: true, // pickup event already committed
      });

      await expect(
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: senderId, token: {} },
        } as any),
      ).rejects.toThrow(/Physical custody has already commenced/);
    });
  });

  describe("Invariant 3 & 4: Exactly-Once Capacity Restoration & Idempotency", () => {
    it("restores capacity exactly once on retry and returns idempotent result", async () => {
      const bookingId = "bk-idem-cancel";
      const { senderId, tripId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "accepted",
        reservedWeightKg: 4,
        totalCapacityKg: 10,
        reservedCapacityKg: 4,
        availableCapacityKg: 6,
      });

      // Call 1: valid cancellation
      const res1 = await cancelBooking.run({
        data: { bookingId },
        auth: { uid: senderId, token: {} },
      } as any);

      expect(res1.success).toBe(true);
      expect(res1.idempotent).toBe(false);
      expect(res1.capacityRestored).toBe(true);

      const tripDoc1 = await db.collection("trips").doc(tripId).get();
      expect(tripDoc1.data()?.reservedCapacityKg).toBe(0);
      expect(tripDoc1.data()?.availableCapacityKg).toBe(10);

      // Call 2: duplicate retry
      const res2 = await cancelBooking.run({
        data: { bookingId },
        auth: { uid: senderId, token: {} },
      } as any);

      expect(res2.success).toBe(true);
      expect(res2.idempotent).toBe(true);
      expect(res2.capacityRestored).toBe(false);
      expect(res2.shipmentReleased).toBe(false);

      // Verify capacity was NOT incremented again beyond totalCapacityKg
      const tripDoc2 = await db.collection("trips").doc(tripId).get();
      expect(tripDoc2.data()?.reservedCapacityKg).toBe(0);
      expect(tripDoc2.data()?.availableCapacityKg).toBe(10);

      // Verify booking statusHistory has only 2 entries (pending -> accepted -> cancelled)
      const bDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bDoc.data()?.statusHistory).toHaveLength(3);
    });

    it("handles decline retries idempotently", async () => {
      const bookingId = "bk-idem-decline";
      const { travelerId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "pending",
      });

      const res1 = await declineBooking.run({
        data: { bookingId },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(res1.declined).toBe(true);
      expect(res1.idempotent).toBe(false);

      const res2 = await declineBooking.run({
        data: { bookingId },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(res2.declined).toBe(true);
      expect(res2.idempotent).toBe(true);

      const bDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bDoc.data()?.statusHistory).toHaveLength(2);
    });
  });

  describe("Invariant 5, 6 & 11: Shipment Release, Safety Hold, and Snapshot Immutability", () => {
    it("releases shipment exclusivity while preserving administrative safety hold", async () => {
      const bookingId = "bk-safety-hold-retention";
      const { senderId, shipmentId } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          withHold: true,
        },
      );

      const res = await cancelBooking.run({
        data: {
          bookingId,
          reasonCode: BookingCancellationReasonCode.SAFETY_CONCERN,
        },
        auth: { uid: senderId, token: {} },
      } as any);

      expect(res.success).toBe(true);
      expect(res.shipmentReleased).toBe(true);

      const sDoc = await db.collection("shipments").doc(shipmentId).get();
      expect(sDoc.data()?.activeBookingId).toBeNull();
      expect(sDoc.data()?.activeCarrierId).toBeNull();

      // Administrative hold must remain active and authoritative
      const holdDoc = await db.collection("administrativeHolds").doc(`hold-${shipmentId}`).get();
      expect(holdDoc.exists).toBe(true);
      expect(holdDoc.data()?.status).toBe("active");
    });

    it("preserves accepted agreement snapshot immutable without modification or deletion", async () => {
      const bookingId = "bk-snapshot-immutability";
      const { senderId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "accepted",
      });

      const snapDocBefore = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      expect(snapDocBefore.exists).toBe(true);
      const snapDataBefore = snapDocBefore.data();

      await cancelBooking.run({
        data: { bookingId },
        auth: { uid: senderId, token: {} },
      } as any);

      const snapDocAfter = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      expect(snapDocAfter.exists).toBe(true);
      expect(snapDocAfter.data()).toEqual(snapDataBefore);
    });
  });

  describe("Invariant 9: Reconciled Accept vs Cancel Concurrency Race Semantics", () => {
    it("Case A — cancellation commits first: acceptBooking observes cancelled and rejects, preserving clean datastore state", async () => {
      const bookingId = "bk-race-case-a";
      const { senderId, travelerId, tripId, shipmentId } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "pending",
          reservedWeightKg: 5,
          totalCapacityKg: 10,
          reservedCapacityKg: 0,
          availableCapacityKg: 10,
        },
      );

      // Force cancellation to commit first
      const cancelRes = await cancelBooking.run({
        data: { bookingId },
        auth: { uid: senderId, token: {} },
      } as any);
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.status).toBe("cancelled");

      // acceptBooking now attempts to execute on the cancelled booking
      await expect(
        acceptBooking.run({
          data: { bookingId },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Booking cannot transition from cancelled to accepted/);

      // Verify datastore invariants
      const finalBooking = (await db.collection("bookings").doc(bookingId).get()).data()!;
      const finalTrip = (await db.collection("trips").doc(tripId).get()).data()!;
      const finalShipment = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      const snapDoc = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();

      expect(finalBooking.status).toBe("cancelled");
      expect(finalTrip.reservedCapacityKg).toBe(0);
      expect(finalTrip.availableCapacityKg).toBe(10);
      expect(finalShipment.activeBookingId).toBeNull();
      expect(finalBooking.statusHistory).toHaveLength(2); // pending -> cancelled
      expect(snapDoc.exists).toBe(false);
    });

    it("Case B — acceptance commits first: cancelBooking observes accepted and executes pre-pickup cancellation with clean capacity restoration", async () => {
      const bookingId = "bk-race-case-b";
      const { senderId, travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "pending",
          reservedWeightKg: 5,
          totalCapacityKg: 10,
          reservedCapacityKg: 0,
          availableCapacityKg: 10,
        },
      );

      // Force acceptance to commit first
      const acceptRes = await acceptBooking.run({
        data: { bookingId },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(acceptRes.success).toBe(true);


      // Intermediate verification: booking was accepted, capacity was reserved, snapshot created
      const midTrip = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(midTrip.reservedCapacityKg).toBe(weightKg);
      expect(midTrip.availableCapacityKg).toBe(10 - weightKg);
      const midSnap = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();
      expect(midSnap.exists).toBe(true);

      // cancelBooking now executes, observing accepted pre-pickup state
      const cancelRes = await cancelBooking.run({
        data: { bookingId },
        auth: { uid: senderId, token: {} },
      } as any);
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.status).toBe("cancelled");
      expect(cancelRes.capacityRestored).toBe(true);
      expect(cancelRes.shipmentReleased).toBe(true);

      // Verify datastore invariants after accepted pre-pickup cancellation
      const finalBooking = (await db.collection("bookings").doc(bookingId).get()).data()!;
      const finalTrip = (await db.collection("trips").doc(tripId).get()).data()!;
      const finalShipment = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      const postSnap = await db.collection("bookingAgreementSnapshots").doc(bookingId).get();

      expect(finalBooking.status).toBe("cancelled");
      expect(finalTrip.reservedCapacityKg).toBe(0);
      expect(finalTrip.availableCapacityKg).toBe(10);
      expect(finalShipment.activeBookingId).toBeNull();
      expect(finalBooking.statusHistory).toHaveLength(3); // pending -> accepted -> cancelled
      // Agreement snapshot preserved immutably
      expect(postSnap.exists).toBe(true);
      expect(postSnap.data()?.bookingId).toBe(bookingId);
    });

    it("True Concurrent Race — runs 10 concurrent iterations and asserts zero invalid or leaked states", async () => {
      for (let i = 0; i < 10; i++) {
        const bookingId = `bk-race-multi-${i}`;
        const { senderId, travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
          bookingId,
          `sender-multi-${i}`,
          `traveler-multi-${i}`,
          {
            status: "pending",
            reservedWeightKg: 4,
            totalCapacityKg: 10,
            reservedCapacityKg: 0,
            availableCapacityKg: 10,
          },
        );

        await Promise.allSettled([
          acceptBooking.run({
            data: { bookingId },
            auth: { uid: travelerId, token: {} },
          } as any),
          cancelBooking.run({
            data: { bookingId },
            auth: { uid: senderId, token: {} },
          } as any),
        ]);

        const finalBooking = (await db.collection("bookings").doc(bookingId).get()).data()!;
        const finalTrip = (await db.collection("trips").doc(tripId).get()).data()!;
        const finalShipment = (await db.collection("shipments").doc(shipmentId).get()).data()!;

        // Invariant 1: Final booking status must be coherent
        expect(["accepted", "cancelled"]).toContain(finalBooking.status);

        // Invariant 2: Capacity conservation (reserved + available = total)
        expect(finalTrip.reservedCapacityKg + finalTrip.availableCapacityKg).toBe(10);

        if (finalBooking.status === "cancelled") {
          // If ended cancelled: zero capacity held, shipment released
          expect(finalTrip.reservedCapacityKg).toBe(0);
          expect(finalTrip.availableCapacityKg).toBe(10);
          expect(finalShipment.activeBookingId).toBeNull();
        } else {
          // If ended accepted: capacity reserved, shipment claimed
          expect(finalTrip.reservedCapacityKg).toBe(weightKg);
          expect(finalTrip.availableCapacityKg).toBe(10 - weightKg);
          expect(finalShipment.activeBookingId).toBe(bookingId);
        }

        // Invariant 3: Valid monotonic status history
        const statuses = finalBooking.statusHistory.map((h: any) => h.status);
        if (finalBooking.status === "accepted") {
          expect(statuses).toEqual(["pending", "accepted"]);
        } else {
          expect([
            ["pending", "cancelled"],
            ["pending", "accepted", "cancelled"],
          ]).toContainEqual(statuses);
        }
      }
    }, 60000);
  });

  describe("Invariant 10: Pickup vs Cancel Concurrency Race", () => {
    it("serializes concurrent confirmPickupCustody vs cancelBooking on accepted booking", async () => {
      const bookingId = "bk-race-pickup-cancel";
      const { senderId, travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 3,
          totalCapacityKg: 10,
          reservedCapacityKg: 3,
          availableCapacityKg: 7,
          pickupVerified: true,
          withAcceptedEvent: true,
        },
      );

      const custodyDeclaration = {
        bookingId,
        shipmentId,
        acceptedByUserId: travelerId,
        custodyVersion: 1,
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
      };

      const [pickupResult, cancelResult] = await Promise.allSettled([
        confirmPickupCustody.run({
          data: { bookingId, custodyAcceptance: custodyDeclaration },
          auth: { uid: travelerId, token: {} },
        } as any),
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: senderId, token: {} },
        } as any),
      ]);

      const finalBooking = (await db.collection("bookings").doc(bookingId).get()).data()!;
      const finalTrip = (await db.collection("trips").doc(tripId).get()).data()!;
      const finalShipment = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      const pickupEventDoc = await db
        .collection("custodyEvents")
        .doc(`${bookingId}__pickup_confirmed`)
        .get();

      if (pickupResult.status === "fulfilled") {
        // Pickup won the race: custody confirmed
        expect(finalBooking.status).toBe("in_transit");
        expect(pickupEventDoc.exists).toBe(true);
        expect(finalTrip.reservedCapacityKg).toBe(weightKg);
        expect(finalShipment.activeBookingId).toBe(bookingId);
        // Cancel must have failed closed
        expect(cancelResult.status).toBe("rejected");
      } else {
        // Cancel won the race: booking cancelled, capacity restored, no pickup event
        expect(cancelResult.status).toBe("fulfilled");
        expect(finalBooking.status).toBe("cancelled");
        expect(pickupEventDoc.exists).toBe(false);
        expect(finalTrip.reservedCapacityKg).toBe(0);
        expect(finalShipment.activeBookingId).toBeNull();
      }
    });
  });

  describe("Invariant 4 & Concurrency 3: Duplicate Cancellation Race", () => {
    it("handles two concurrent cancelBooking calls on accepted booking without double-restoring capacity", async () => {
      const bookingId = "bk-race-duplicate-cancel";
      const { senderId, travelerId, tripId, shipmentId } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          reservedCapacityKg: 4,
          availableCapacityKg: 6,
        },
      );

      const [res1, res2] = await Promise.all([
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: senderId, token: {} },
        } as any),
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: travelerId, token: {} },
        } as any),
      ]);

      // One call must have executed original cancellation, the other idempotent retry
      const results = [res1, res2];
      const original = results.find((r) => !r.idempotent);
      const idempotent = results.find((r) => r.idempotent);

      expect(original).toBeDefined();
      expect(idempotent).toBeDefined();
      expect(original!.capacityRestored).toBe(true);
      expect(idempotent!.capacityRestored).toBe(false);

      // Capacity must be restored exactly once (never exceed 10 or drop below 0)
      const tripDoc = await db.collection("trips").doc(tripId).get();
      expect(tripDoc.data()?.reservedCapacityKg).toBe(0);
      expect(tripDoc.data()?.availableCapacityKg).toBe(10);

      // Status history must have exactly one 'cancelled' transition appended
      const bDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bDoc.data()?.statusHistory).toHaveLength(3);
    });
  });

  describe("Invariant 17: Legacy & Malformed Data Behavior", () => {
    it("fails closed if accepted booking is missing agreement snapshot", async () => {
      const bookingId = "bk-malformed-missing-snap";
      const { senderId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "accepted",
        withSnapshot: false,
      });

      await expect(
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: senderId, token: {} },
        } as any),
      ).rejects.toThrow(/Accepted booking is missing its agreement snapshot/);
    });

    it("fails closed if statusHistory is missing or empty", async () => {
      const bookingId = "bk-malformed-history";
      const { senderId } = await seedTestBooking(bookingId, undefined, undefined, {
        status: "pending",
      });

      await db.collection("bookings").doc(bookingId).update({
        statusHistory: [],
      });

      await expect(
        cancelBooking.run({
          data: { bookingId },
          auth: { uid: senderId, token: {} },
        } as any),
      ).rejects.toThrow(/Malformed booking status history/);
    });
  });

  describe("Failed Pickup Verification Causes Zero Business Mutation", () => {
    it("wrong pickup PIN: verifyPickupHandoff rejects and causes zero business mutation", async () => {
      const bookingId = "bk-fail-pickup-wrong-pin";
      const { senderId, travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: false,
        },
      );

      // Issue valid code
      await issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "pickup" },
        auth: { uid: senderId, token: {} },
      } as any);

      // Traveler enters wrong code
      await expect(
        verifyPickupHandoff.run({
          data: { bookingId, code: "000000" },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Incorrect verification code/);

      // Assert all 7 invariants:
      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("accepted");
      expect(bDoc.status).not.toBe("in_transit");

      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(eventDoc.exists).toBe(false);

      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      expect(tripDoc.availableCapacityKg).toBe(10 - weightKg);

      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);

      const notifs = await db.collection("notifications").where("relatedId", "==", bookingId).where("type", "==", "package.picked_up").get();
      expect(notifs.empty).toBe(true);
    });

    it("rotated/obsolete pickup PIN: verifyPickupHandoff rejects old PIN and causes zero business mutation", async () => {
      const bookingId = "bk-fail-pickup-rotated-pin";
      const { senderId, travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: false,
        },
      );

      const resA = await issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "pickup" },
        auth: { uid: senderId, token: {} },
      } as any);
      const codeA = resA.code;

      // Rotate to code B
      await issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "pickup" },
        auth: { uid: senderId, token: {} },
      } as any);

      // Traveler submits old code A
      await expect(
        verifyPickupHandoff.run({
          data: { bookingId, code: codeA },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Incorrect verification code/);

      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("accepted");
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(eventDoc.exists).toBe(false);
      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);
      const notifs = await db.collection("notifications").where("relatedId", "==", bookingId).where("type", "==", "package.picked_up").get();
      expect(notifs.empty).toBe(true);
    });

    it("replayed pickup PIN: verifyPickupHandoff rejects second attempt with already verified PIN", async () => {
      const bookingId = "bk-fail-pickup-replayed-pin";
      const { senderId, travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: false,
        },
      );

      const res = await issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "pickup" },
        auth: { uid: senderId, token: {} },
      } as any);
      const code = res.code;

      // Verify once -> succeeds
      const passRes = await verifyPickupHandoff.run({
        data: { bookingId, code },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(passRes.success).toBe(true);

      // Replay attempt with same code -> rejects
      await expect(
        verifyPickupHandoff.run({
          data: { bookingId, code },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Pickup handoff has already been verified/);

      // Booking remains accepted (confirmPickupCustody has not been called)
      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("accepted");
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(eventDoc.exists).toBe(false);
      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);
    });

    it("unauthorized participant: confirmPickupCustody rejects non-traveler with zero mutation", async () => {
      const bookingId = "bk-fail-pickup-unauth";
      const { senderId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: true,
        },
      );

      await expect(
        confirmPickupCustody.run({
          data: {
            bookingId,
            custodyAcceptance: makeCustodyDeclaration(bookingId, shipmentId, senderId),
          },
          auth: { uid: senderId, token: {} }, // Sender attempts to confirm pickup!
        } as any),
      ).rejects.toThrow(/Only the assigned traveler can confirm pickup custody/);

      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("accepted");
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(eventDoc.exists).toBe(false);
      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);
      const notifs = await db.collection("notifications").where("relatedId", "==", bookingId).where("type", "==", "package.picked_up").get();
      expect(notifs.empty).toBe(true);
    });

    it("missing agreement snapshot: confirmPickupCustody fails closed with zero mutation", async () => {
      const bookingId = "bk-fail-pickup-no-snap";
      const { travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: true,
          withSnapshot: false, // Snapshot missing!
        },
      );

      await expect(
        confirmPickupCustody.run({
          data: {
            bookingId,
            custodyAcceptance: makeCustodyDeclaration(bookingId, shipmentId, travelerId),
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Accepted booking agreement snapshot is missing/);

      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("accepted");
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(eventDoc.exists).toBe(false);
      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);
      const notifs = await db.collection("notifications").where("relatedId", "==", bookingId).where("type", "==", "package.picked_up").get();
      expect(notifs.empty).toBe(true);
    });

    it("blocking administrative safety hold: confirmPickupCustody fails closed with zero mutation", async () => {
      const bookingId = "bk-fail-pickup-safety-hold";
      const { travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "accepted",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: true,
          withHold: true, // Active safety hold!
        },
      );

      await expect(
        confirmPickupCustody.run({
          data: {
            bookingId,
            custodyAcceptance: makeCustodyDeclaration(bookingId, shipmentId, travelerId),
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/administrative hold/);

      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("accepted");
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(eventDoc.exists).toBe(false);
      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);
      const notifs = await db.collection("notifications").where("relatedId", "==", bookingId).where("type", "==", "package.picked_up").get();
      expect(notifs.empty).toBe(true);
    });
  });

  describe("Failed Delivery Verification Does Not Fake Progress", () => {
    it("wrong delivery PIN: verifyDeliveryHandoff rejects and booking remains safely in_transit", async () => {
      const bookingId = "bk-fail-deliv-wrong-pin";
      const { senderId, travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "in_transit",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: true,
        },
      );

      // Sender issues delivery code
      await issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "delivery" },
        auth: { uid: senderId, token: {} },
      } as any);

      // Traveler enters incorrect delivery code
      await expect(
        verifyDeliveryHandoff.run({
          data: { bookingId, code: "000000" },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Incorrect verification code/);

      // Assert booking remains in_transit with zero progression
      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("in_transit");
      expect(bDoc.status).not.toBe("delivered");
      expect(bDoc.status).not.toBe("completed");

      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__delivery_confirmed`).get();
      expect(eventDoc.exists).toBe(false);

      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      expect(tripDoc.availableCapacityKg).toBe(10 - weightKg);

      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);

      const notifs = await db.collection("notifications").where("relatedId", "==", bookingId).where("type", "in", ["package.delivered", "shipment.completed"]).get();
      expect(notifs.empty).toBe(true);
    });

    it("rotated/obsolete delivery PIN: verifyDeliveryHandoff rejects old code and booking remains in_transit", async () => {
      const bookingId = "bk-fail-deliv-rotated-pin";
      const { senderId, travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "in_transit",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: true,
        },
      );

      const resA = await issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "delivery" },
        auth: { uid: senderId, token: {} },
      } as any);
      const codeA = resA.code;

      // Rotate to code B
      await issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "delivery" },
        auth: { uid: senderId, token: {} },
      } as any);

      // Traveler enters old code A
      await expect(
        verifyDeliveryHandoff.run({
          data: { bookingId, code: codeA },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Incorrect verification code/);

      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("in_transit");
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__delivery_confirmed`).get();
      expect(eventDoc.exists).toBe(false);
      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);
    });

    it("replayed delivery PIN: verifyDeliveryHandoff rejects second attempt with already verified PIN", async () => {
      const bookingId = "bk-fail-deliv-replayed-pin";
      const { senderId, travelerId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "in_transit",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: true,
        },
      );

      const res = await issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "delivery" },
        auth: { uid: senderId, token: {} },
      } as any);
      const code = res.code;

      // First verification succeeds
      const passRes = await verifyDeliveryHandoff.run({
        data: { bookingId, code },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(passRes.success).toBe(true);

      // Replay attempt with same code rejects
      await expect(
        verifyDeliveryHandoff.run({
          data: { bookingId, code },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Delivery handoff has already been verified/);

      // Booking remains in_transit until confirmDeliveryCustody is called
      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("in_transit");
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__delivery_confirmed`).get();
      expect(eventDoc.exists).toBe(false);
      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);
    });

    it("unauthorized verification: confirmDeliveryCustody rejects non-traveler with booking remaining in_transit", async () => {
      const bookingId = "bk-fail-deliv-unauth";
      const { senderId, tripId, shipmentId, weightKg } = await seedTestBooking(
        bookingId,
        undefined,
        undefined,
        {
          status: "in_transit",
          reservedWeightKg: 4,
          totalCapacityKg: 10,
          pickupVerified: true,
        },
      );

      // Non-traveler (e.g. sender) attempts to confirm delivery
      await expect(
        confirmDeliveryCustody.run({
          data: {
            bookingId,
            location: "Dulles Airport",
          },
          auth: { uid: senderId, token: {} },
        } as any),
      ).rejects.toThrow(/Only the assigned traveler can confirm delivery custody/);

      const bDoc = (await db.collection("bookings").doc(bookingId).get()).data()!;
      expect(bDoc.status).toBe("in_transit");
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__delivery_confirmed`).get();
      expect(eventDoc.exists).toBe(false);
      const tripDoc = (await db.collection("trips").doc(tripId).get()).data()!;
      expect(tripDoc.reservedCapacityKg).toBe(weightKg);
      const shipDoc = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipDoc.activeBookingId).toBe(bookingId);
      const notifs = await db.collection("notifications").where("relatedId", "==", bookingId).where("type", "in", ["package.delivered", "shipment.completed"]).get();
      expect(notifs.empty).toBe(true);
    });
  });

  describe("Shipment Rematchability After Accepted Pre-Pickup Cancellation", () => {
    it("safely rematches shipment to a new traveler and trip after accepted pre-pickup cancellation", async () => {
      const shipmentId = "shipment-rematch-1";
      const tripAId = "trip-rematch-a";
      const tripBId = "trip-rematch-b";
      const bookingAId = "booking-rematch-a";
      const bookingBId = "booking-rematch-b";
      const reqAId = "req-rematch-a";
      const reqBId = "req-rematch-b";
      const senderId = "sender-rematch";
      const travelerAId = "traveler-rematch-a";
      const travelerBId = "traveler-rematch-b";
      const weightKg = 4;

      // Seed profiles
      await db.collection("profiles").doc(senderId).set({
        displayName: "Rematch Sender",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      await db.collection("profiles").doc(travelerAId).set({
        displayName: "Traveler A",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      await db.collection("profiles").doc(travelerBId).set({
        displayName: "Traveler B",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Seed Shipment S (active, unassigned, 4 kg)
      await db.collection("shipments").doc(shipmentId).set({
        ownerId: senderId,
        originCountry: "Ethiopia",
        originCity: "Addis Ababa",
        destinationCountry: "United States",
        destinationCity: "Washington",
        packageCategory: "documents",
        packageDescription: "Rematch documents",
        weightKg,
        deliveryWindow: "2026-05-01 to 2026-05-10",
        rewardAmount: 60,
        rewardCurrency: "USD",
        status: "active",
        containsBattery: false,
        batteryType: "none",
        containsLiquid: false,
        containsFoodOrAgri: false,
        containsMedicine: false,
        customsDeclarationRequired: false,
        packageContentVersion: 1,
        activeBookingId: null,
        activeCarrierId: null,
        activeTripId: null,
        safetyDeclaration: {
          policyVersion: "2026-07-v1",
          declarationVersion: "v1",
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Seed Trip A (10 kg total, 10 kg available, 0 kg reserved)
      await db.collection("trips").doc(tripAId).set({
        ownerId: travelerAId,
        originCountry: "Ethiopia",
        originCity: "Addis Ababa",
        destinationCountry: "United States",
        destinationCity: "Washington",
        departureDate: "2026-05-01",
        arrivalDate: "2026-05-02",
        totalCapacityKg: 10,
        availableCapacityKg: 10,
        reservedCapacityKg: 0,
        status: "active",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Seed Booking Request A & Booking A (pending)
      await db.collection("bookingRequests").doc(reqAId).set({
        bookingId: bookingAId,
        shipmentId,
        tripId: tripAId,
        senderId,
        travelerId: travelerAId,
        status: "pending",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      await db.collection("bookings").doc(bookingAId).set({
        bookingRequestId: reqAId,
        shipmentId,
        tripId: tripAId,
        senderId,
        travelerId: travelerAId,
        status: "pending",
        statusHistory: [
          {
            status: "pending",
            changedAt: admin.firestore.Timestamp.now(),
            changedBy: senderId,
          },
        ],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // 1. Traveler A accepts Booking A
      const acceptARes = await acceptBooking.run({
        data: { bookingId: bookingAId },
        auth: { uid: travelerAId, token: {} },
      } as any);
      expect(acceptARes.success).toBe(true);


      // 2. Verify R03 reservation and shipment claim exist
      const tripAPostAccept = (await db.collection("trips").doc(tripAId).get()).data()!;
      expect(tripAPostAccept.reservedCapacityKg).toBe(weightKg);
      expect(tripAPostAccept.availableCapacityKg).toBe(6);

      const shipPostAcceptA = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipPostAcceptA.activeBookingId).toBe(bookingAId);
      expect(shipPostAcceptA.activeCarrierId).toBe(travelerAId);
      expect(shipPostAcceptA.activeTripId).toBe(tripAId);

      const snapADoc = await db.collection("bookingAgreementSnapshots").doc(bookingAId).get();
      expect(snapADoc.exists).toBe(true);

      // 3. Cancel the accepted booking before pickup through R08 backend
      const cancelARes = await cancelBooking.run({
        data: {
          bookingId: bookingAId,
          reasonCode: BookingCancellationReasonCode.TRAVELER_UNAVAILABLE,
          note: "Traveler flight rescheduled",
        },
        auth: { uid: travelerAId, token: {} },
      } as any);
      expect(cancelARes.success).toBe(true);
      expect(cancelARes.cancelled).toBe(true);
      expect(cancelARes.capacityRestored).toBe(true);
      expect(cancelARes.shipmentReleased).toBe(true);

      // 4. Verify post-cancellation assertions
      const bookingAPostCancel = (await db.collection("bookings").doc(bookingAId).get()).data()!;
      expect(bookingAPostCancel.status).toBe("cancelled");

      const tripAPostCancel = (await db.collection("trips").doc(tripAId).get()).data()!;
      expect(tripAPostCancel.reservedCapacityKg).toBe(0);
      expect(tripAPostCancel.availableCapacityKg).toBe(10);

      const shipPostCancelA = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipPostCancelA.activeBookingId).toBeNull();
      expect(shipPostCancelA.activeCarrierId).toBeNull();
      expect(shipPostCancelA.activeTripId).toBeNull();
      expect(shipPostCancelA.status).toBe("active");

      const pickupEventDoc = await db.collection("custodyEvents").doc(`${bookingAId}__pickup_confirmed`).get();
      expect(pickupEventDoc.exists).toBe(false);

      const snapAPostCancel = await db.collection("bookingAgreementSnapshots").doc(bookingAId).get();
      expect(snapAPostCancel.exists).toBe(true);
      expect(snapAPostCancel.data()).toEqual(snapADoc.data());

      // 5. Attempt legitimate acceptance of Shipment S by Traveler B / Trip B
      await db.collection("trips").doc(tripBId).set({
        ownerId: travelerBId,
        originCountry: "Ethiopia",
        originCity: "Addis Ababa",
        destinationCountry: "United States",
        destinationCity: "Washington",
        departureDate: "2026-05-03",
        arrivalDate: "2026-05-04",
        totalCapacityKg: 10,
        availableCapacityKg: 10,
        reservedCapacityKg: 0,
        status: "active",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      await db.collection("bookingRequests").doc(reqBId).set({
        bookingId: bookingBId,
        shipmentId,
        tripId: tripBId,
        senderId,
        travelerId: travelerBId,
        status: "pending",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      await db.collection("bookings").doc(bookingBId).set({
        bookingRequestId: reqBId,
        shipmentId,
        tripId: tripBId,
        senderId,
        travelerId: travelerBId,
        status: "pending",
        statusHistory: [
          {
            status: "pending",
            changedAt: admin.firestore.Timestamp.now(),
            changedBy: senderId,
          },
        ],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // 6. Traveler B accepts Booking B
      const acceptBRes = await acceptBooking.run({
        data: { bookingId: bookingBId },
        auth: { uid: travelerBId, token: {} },
      } as any);
      expect(acceptBRes.success).toBe(true);


      // 7. Verify rematch outcome
      const shipFinal = (await db.collection("shipments").doc(shipmentId).get()).data()!;
      expect(shipFinal.activeBookingId).toBe(bookingBId);
      expect(shipFinal.activeCarrierId).toBe(travelerBId);
      expect(shipFinal.activeTripId).toBe(tripBId);

      const tripBFinal = (await db.collection("trips").doc(tripBId).get()).data()!;
      expect(tripBFinal.reservedCapacityKg).toBe(weightKg);
      expect(tripBFinal.availableCapacityKg).toBe(6);

      const tripAFinal = (await db.collection("trips").doc(tripAId).get()).data()!;
      expect(tripAFinal.reservedCapacityKg).toBe(0);
      expect(tripAFinal.availableCapacityKg).toBe(10);

      const bookingAFinal = (await db.collection("bookings").doc(bookingAId).get()).data()!;
      expect(bookingAFinal.status).toBe("cancelled");

      const snapAFinal = await db.collection("bookingAgreementSnapshots").doc(bookingAId).get();
      expect(snapAFinal.exists).toBe(true);
      expect(snapAFinal.data()?.travelerId).toBe(travelerAId);

      const snapBFinal = await db.collection("bookingAgreementSnapshots").doc(bookingBId).get();
      expect(snapBFinal.exists).toBe(true);
      expect(snapBFinal.data()?.travelerId).toBe(travelerBId);
      expect(snapBFinal.data()?.bookingId).toBe(bookingBId);
    });
  });

  describe("Sequential Accept -> Cancel Lifecycle Notifications", () => {
    it("generates at most one accepted and one cancelled notification with deterministic IDs", async () => {
      const bookingId = "bk-notif-accept-cancel";
      const senderId = "sender-notif-seq";
      const travelerId = "traveler-notif-seq";
      await seedTestBooking(
        bookingId,
        senderId,
        travelerId,
        {
          status: "pending",
          reservedWeightKg: 3,
          totalCapacityKg: 10,
        },
      );

      await seedUserPreferences(senderId);
      await seedUserPreferences(travelerId);

      // Step 1: Traveler accepts booking
      const acceptRes = await acceptBooking.run({
        data: { bookingId },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(acceptRes.success).toBe(true);

      // Step 2: Sender cancels accepted booking
      const cancelRes = await cancelBooking.run({
        data: {
          bookingId,
          reasonCode: BookingCancellationReasonCode.SENDER_REQUESTED,
        },
        auth: { uid: senderId, token: {} },
      } as any);
      expect(cancelRes.success).toBe(true);

      // Poll notifications for this booking (waiting for background Cloud Function trigger)
      const expectedAcceptNotifId = deriveLifecycleNotificationId("booking.accepted", bookingId, senderId);
      const expectedCancelNotifId = deriveLifecycleNotificationId("booking.cancelled", bookingId, travelerId);

      let notifsSnap = await db
        .collection("notifications")
        .where("relatedId", "==", bookingId)
        .get();

      for (let attempt = 0; attempt < 50; attempt++) {
        const hasAccept = notifsSnap.docs.some((d) => d.id === expectedAcceptNotifId);
        const hasCancel = notifsSnap.docs.some((d) => d.id === expectedCancelNotifId);
        if (hasAccept && hasCancel) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        notifsSnap = await db
          .collection("notifications")
          .where("relatedId", "==", bookingId)
          .get();
      }

      const notifs = notifsSnap.docs.map((d) => d.data());

      // Filter accepted and cancelled notifications
      const acceptedNotifs = notifs.filter((n) => n.type === "booking.accepted");
      const cancelledNotifs = notifs.filter((n) => n.type === "booking.cancelled");

      expect(acceptedNotifs).toHaveLength(1);
      expect(acceptedNotifs[0].userId).toBe(senderId); // Recipient of accepted is sender
      expect(notifsSnap.docs.some((d) => d.id === expectedAcceptNotifId)).toBe(true);

      expect(cancelledNotifs).toHaveLength(1);
      expect(cancelledNotifs[0].userId).toBe(travelerId); // Recipient of sender-cancellation is traveler
      expect(notifsSnap.docs.some((d) => d.id === expectedCancelNotifId)).toBe(true);
    }, 15000);
  });
});
