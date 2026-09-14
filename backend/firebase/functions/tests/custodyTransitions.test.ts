import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import crypto from "crypto";
import {
  confirmPickupCustody,
  confirmDeliveryCustody,
  completeBookingCustody,
  recordTravelCustodyEvent,
} from "../src/index.js";
import { LegacyCustodyReconciler } from "../src/services/LegacyCustodyReconciler.js";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "demo-karri-mobile",
  });
}

const db = admin.firestore();

function hashVerificationCode(code: string, salt: string): string {
  return crypto.pbkdf2Sync(code, salt, 100000, 32, "sha256").toString("hex");
}

function travelerCustodyAcceptanceFixture(bookingId: string, shipmentId: string, travelerId: string) {
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

interface SeedBookingOptions {
  bookingStatus?: "pending" | "accepted" | "in_transit" | "delivered" | "completed";
  pickupVerified?: boolean;
  deliveryVerified?: boolean;
  withAcceptedEvent?: boolean;
  withPickupEvent?: boolean;
  withDeliveryEvent?: boolean;
  isSenderReceiver?: boolean;
  receiverName?: string;
  receiverPhone?: string;
  receiverEmail?: string;
  withSnapshot?: boolean;
}

async function seedBookingFixture(
  bookingId: string,
  senderId = "sender-c-1",
  travelerId = "traveler-c-1",
  options: SeedBookingOptions = {},
) {
  const tripId = `trip-${bookingId}`;
  const shipmentId = `shipment-${bookingId}`;
  const reqId = `req-${bookingId}`;
  const status = options.bookingStatus ?? "accepted";

  await seedUserAndProfile(senderId, "Abebe Sender");
  await seedUserAndProfile(travelerId, "Chala Traveler");

  await db.collection("trips").doc(tripId).set({
    ownerId: travelerId,
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    departureDate: "2026-03-01",
    arrivalDate: "2026-03-02",
    availableCapacityKg: 8,
    totalCapacityKg: 10,
    reservedCapacityKg: 2,
    status: "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  const shipmentStatus =
    status === "accepted"
      ? "matched"
      : status === "in_transit"
        ? "in_transit"
        : status === "delivered"
          ? "delivered"
          : status === "completed"
            ? "completed"
            : "active";

  await db.collection("shipments").doc(shipmentId).set({
    ownerId: senderId,
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    packageCategory: "documents",
    packageDescription: "Sensitive contract",
    weightKg: 2,
    deliveryWindow: "2026-03-01 to 2026-03-10",
    rewardAmount: 50,
    rewardCurrency: "USD",
    status: shipmentStatus,
    containsBattery: false,
    batteryType: "none",
    containsLiquid: false,
    containsFoodOrAgri: false,
    containsMedicine: false,
    customsDeclarationRequired: false,
    packageContentVersion: 1,
    activeBookingId: bookingId,
    activeCarrierId: travelerId,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("bookingRequests").doc(reqId).set({
    bookingId,
    shipmentId,
    tripId,
    senderId,
    travelerId,
    message: "Custody test booking",
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
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  // Handoff agreement
  const isSenderReceiver = options.isSenderReceiver ?? false;
  const receiverName = options.receiverName ?? "Dawit Receiver";
  const receiverPhone = options.receiverPhone ?? "+12025550199";
  const receiverEmail = options.receiverEmail ?? "dawit@example.com";

  await db.collection("bookingHandoffAgreements").doc(bookingId).set({
    bookingId,
    senderContact: {
      name: "Abebe Sender",
      phone: "+251911000001",
      email: "abebe@example.com",
      notes: null,
    },
    travelerContact: {
      name: "Chala Traveler",
      phone: "+251911000002",
      email: "chala@example.com",
      notes: null,
    },
    receiver: {
      name: receiverName,
      phone: receiverPhone,
      email: receiverEmail,
      label: isSenderReceiver ? "Self" : "Family",
      isSenderReceiver,
    },
    pickup: {
      meetingPoint: "Bole Airport Gate 3",
      scheduledAt: "2026-03-01T08:00:00.000Z",
      notes: "Wait near cafe",
    },
    dropoff: {
      meetingPoint: "Dulles Arrival Hall",
      scheduledAt: "2026-03-02T16:00:00.000Z",
      notes: "Call upon landing",
    },
    confirmation: {
      status: "confirmed",
      proposedBy: travelerId,
      confirmedBy: senderId,
      confirmedAt: admin.firestore.Timestamp.now(),
    },
    pickupVerification: {
      verified: options.pickupVerified ?? false,
      verifiedAt: options.pickupVerified ? admin.firestore.Timestamp.now() : null,
      verifiedBy: options.pickupVerified ? travelerId : null,
      failedAttempts: 0,
    },
    deliveryVerification: {
      verified: options.deliveryVerified ?? false,
      verifiedAt: options.deliveryVerified ? admin.firestore.Timestamp.now() : null,
      verifiedBy: options.deliveryVerified ? travelerId : null,
      failedAttempts: 0,
    },
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  // Secrets
  const salt1 = "salt1";
  const salt2 = "salt2";
  await db.collection("bookingHandoffSecrets").doc(bookingId).set({
    bookingId,
    pickupCodeHash: hashVerificationCode("123456", salt1),
    pickupCodeSalt: salt1,
    pickupIssuedAt: admin.firestore.Timestamp.now(),
    deliveryCodeHash: hashVerificationCode("654321", salt2),
    deliveryCodeSalt: salt2,
    deliveryIssuedAt: admin.firestore.Timestamp.now(),
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
      packageDescription: "Sensitive contract",
      weightKg: 2,
      originCountry: "Ethiopia",
      originCity: "Addis Ababa",
      destinationCountry: "United States",
      destinationCity: "Washington",
      deliveryWindow: "2026-03-01 to 2026-03-10",
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

  if (options.withAcceptedEvent !== false) {
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
      note: "Accepted booking",
      sequence: 2,
      previousEventId: `${bookingId}__shipment_created`,
      metadata: { bookingStatus: "accepted" },
      timestamp: admin.firestore.Timestamp.now(),
    });
  }

  if (options.withPickupEvent) {
    await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).set({
      bookingId,
      shipmentId,
      tripId,
      eventType: "pickup_confirmed",
      performedBy: travelerId,
      fromPartyId: senderId,
      fromPartyRole: "sender",
      toPartyId: travelerId,
      toPartyRole: "traveler",
      location: "Bole Airport",
      note: "Shipment custody transferred to traveler.",
      sequence: 3,
      previousEventId: `${bookingId}__traveler_accepted`,
      metadata: { bookingStatus: "in_transit", verified: true, verificationType: "handoff_pin" },
      timestamp: admin.firestore.Timestamp.now(),
    });
  }

  if (options.withDeliveryEvent) {
    const toPartyId = isSenderReceiver ? senderId : null;
    const toPartyRole = isSenderReceiver ? "sender_receiver" : "intended_receiver";
    await db.collection("custodyEvents").doc(`${bookingId}__delivery_confirmed`).set({
      bookingId,
      shipmentId,
      tripId,
      eventType: "delivery_confirmed",
      performedBy: travelerId,
      fromPartyId: travelerId,
      fromPartyRole: "traveler",
      toPartyId,
      toPartyRole,
      location: "Dulles Airport",
      note: "Shipment delivered to intended receiver.",
      sequence: 4,
      previousEventId: `${bookingId}__pickup_confirmed`,
      metadata: { bookingStatus: "delivered", verified: true, verificationType: "handoff_pin" },
      timestamp: admin.firestore.Timestamp.now(),
    });
  }

  return { tripId, shipmentId, reqId, senderId, travelerId };
}

describe("R05 — Atomic Custody Transitions and Immutable History Enforcement", () => {
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

  describe("Predecessor Chain Validation & Fail-Closed Behavior", () => {
    it("rejects pickup if traveler_accepted predecessor event is completely missing", async () => {
      const bookingId = "bk-missing-acceptance";
      const { travelerId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: true,
        withAcceptedEvent: false, // Predecessor missing!
      });

      await expect(
        confirmPickupCustody.run({
          data: {
            bookingId,
            location: "Bole Airport Gate 3",
            custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Authoritative predecessor custody event \(traveler_accepted\) is missing/);

      // Verify fail-closed: booking remains accepted, no pickup event created
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("accepted");
      const pickupDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(pickupDoc.exists).toBe(false);
    });

    it("rejects pickup if traveler_accepted predecessor event has mismatched shipmentId or eventType", async () => {
      const bookingId = "bk-mismatched-acceptance";
      const { travelerId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: true,
        withAcceptedEvent: false,
      });

      // Seed a corrupted predecessor event with mismatched shipmentId
      await db.collection("custodyEvents").doc(`${bookingId}__traveler_accepted`).set({
        bookingId,
        shipmentId: "wrong-shipment-id",
        eventType: "traveler_accepted",
        performedBy: travelerId,
        timestamp: admin.firestore.Timestamp.now(),
      });

      await expect(
        confirmPickupCustody.run({
          data: {
            bookingId,
            location: "Bole Airport Gate 3",
            custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Predecessor custody event shipmentId mismatch/);

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("accepted");
    });

    it("rejects airport_departure if pickup_confirmed predecessor is missing", async () => {
      const bookingId = "bk-travel-missing-pickup";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: false, // Missing pickup predecessor!
      });

      await expect(
        recordTravelCustodyEvent.run({
          data: {
            bookingId,
            eventType: "airport_departure",
            location: "ADD",
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Authoritative predecessor custody event \(pickup_confirmed\) is missing/);
    });

    it("rejects delivery if pickup_confirmed predecessor is missing or mismatched", async () => {
      const bookingId = "bk-deliv-missing-pickup";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        deliveryVerified: true,
        withPickupEvent: false, // Missing!
      });

      await expect(
        confirmDeliveryCustody.run({
          data: { bookingId, location: "Dulles" },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Authoritative predecessor custody event \(pickup_confirmed\) is missing/);

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("in_transit");
      const delivDoc = await db.collection("custodyEvents").doc(`${bookingId}__delivery_confirmed`).get();
      expect(delivDoc.exists).toBe(false);
    });

    it("rejects completion if delivery_confirmed predecessor is missing or mismatched", async () => {
      const bookingId = "bk-comp-missing-deliv";
      const { senderId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "delivered",
        pickupVerified: true,
        deliveryVerified: true,
        withPickupEvent: true,
        withDeliveryEvent: false, // Missing!
      });

      await expect(
        completeBookingCustody.run({
          data: { bookingId },
          auth: { uid: senderId, token: {} },
        } as any),
      ).rejects.toThrow(/Authoritative predecessor custody event \(delivery_confirmed\) is missing/);

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("delivered");
    });
  });

  describe("Receiver PII Minimization in Immutable Custody Ledger", () => {
    it("stores zero receiver phone, email, or name in custody identity fields when delivered to external recipient", async () => {
      const bookingId = "bk-pii-external";
      const receiverName = "Sara Intended Receiver";
      const receiverPhone = "+12025550188";
      const receiverEmail = "sara.receiver@example.org";

      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
        isSenderReceiver: false,
        receiverName,
        receiverPhone,
        receiverEmail,
      });

      const result = await confirmDeliveryCustody.run({
        data: {
          bookingId,
          location: "Dulles International Airport",
        },
        auth: { uid: travelerId, token: {} },
      } as any);

      expect(result.success).toBe(true);

      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__delivery_confirmed`).get();
      expect(eventDoc.exists).toBe(true);
      const data = eventDoc.data()!;

      // Invariant: toPartyId must be null for non-user external recipient
      expect(data.toPartyId).toBeNull();
      // Invariant: toPartyRole identifies the relationship without PII
      expect(data.toPartyRole).toBe("intended_receiver");
      expect(data.fromPartyId).toBe(travelerId);
      expect(data.fromPartyRole).toBe("traveler");

      // Verify NO receiver PII exists anywhere in the immutable delivery event payload
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain(receiverPhone);
      expect(serialized).not.toContain(receiverEmail);
      expect(serialized).not.toContain(receiverName);
      expect(data.note).not.toContain(receiverName);
      expect(data.metadata.receiverPhone).toBeUndefined();
      expect(data.metadata.receiverName).toBeUndefined();
    });

    it("stores sender UID as toPartyId with sender_receiver role when sender is proven to be receiver", async () => {
      const bookingId = "bk-pii-sender-is-receiver";
      const { travelerId, senderId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
        isSenderReceiver: true, // Sender is receiver
      });

      const result = await confirmDeliveryCustody.run({
        data: { bookingId, location: "Dulles Arrival" },
        auth: { uid: travelerId, token: {} },
      } as any);

      expect(result.success).toBe(true);

      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__delivery_confirmed`).get();
      const data = eventDoc.data()!;

      expect(data.toPartyId).toBe(senderId);
      expect(data.toPartyRole).toBe("sender_receiver");
      expect(data.fromPartyId).toBe(travelerId);
      expect(data.fromPartyRole).toBe("traveler");
    });
  });

  describe("Pickup Custody Transition (accepted -> in_transit)", () => {
    it("rejects pickup if pickup verification code was not verified", async () => {
      const bookingId = "bk-pickup-unverified";
      const { travelerId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: false,
        withAcceptedEvent: true,
      });

      await expect(
        confirmPickupCustody.run({
          data: {
            bookingId,
            location: "Bole Airport Gate 3",
            note: "Attempting pickup without code",
            custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Pickup verification code has not been verified/);

      // Verify no state change
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("accepted");
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(eventDoc.exists).toBe(false);
    });

    it("rejects pickup if called by actor other than assigned traveler", async () => {
      const bookingId = "bk-pickup-wrong-actor";
      const { senderId, travelerId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: true,
        withAcceptedEvent: true,
      });

      await expect(
        confirmPickupCustody.run({
          data: {
            bookingId,
            location: "Bole Airport Gate 3",
            custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
          },
          auth: { uid: senderId, token: {} }, // sender cannot confirm pickup
        } as any),
      ).rejects.toThrow(/Only the assigned traveler can confirm pickup custody/);
    });

    it("rejects pickup if booking is not in accepted status (e.g. pending)", async () => {
      const bookingId = "bk-pickup-pending";
      const { travelerId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "pending",
        pickupVerified: true,
        withAcceptedEvent: false,
      });

      await expect(
        confirmPickupCustody.run({
          data: {
            bookingId,
            location: "Bole Airport",
            custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Booking cannot transition from pending to in_transit/);
    });

    it("atomically confirms pickup, updates booking, and creates immutable custody event pointing to traveler_accepted", async () => {
      const bookingId = "bk-pickup-success";
      const { travelerId, shipmentId, senderId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: true,
        withAcceptedEvent: true,
      });

      const result = await confirmPickupCustody.run({
        data: {
          bookingId,
          location: "Bole Airport Gate 3",
          note: "Package received in good condition",
          custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
        },
        auth: { uid: travelerId, token: {} },
      } as any);

      expect(result.success).toBe(true);
      expect(result.status).toBe("in_transit");
      expect(result.alreadyTransitioned).toBe(false);
      expect(result.eventId).toBe(`${bookingId}__pickup_confirmed`);

      // Verify booking document
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      const bookingData = bookingDoc.data()!;
      expect(bookingData.status).toBe("in_transit");
      expect(bookingData.statusHistory).toHaveLength(3); // pending -> accepted -> in_transit
      const lastHistory = bookingData.statusHistory[2];
      expect(lastHistory.status).toBe("in_transit");
      expect(lastHistory.changedBy).toBe(travelerId);

      // Verify shipment document is still bound
      const shipmentDoc = await db.collection("shipments").doc(shipmentId).get();
      expect(shipmentDoc.data()?.activeBookingId).toBe(bookingId);

      // Verify custody event document and predecessor linkage
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(eventDoc.exists).toBe(true);
      const eventData = eventDoc.data()!;
      expect(eventData.bookingId).toBe(bookingId);
      expect(eventData.shipmentId).toBe(shipmentId);
      expect(eventData.eventType).toBe("pickup_confirmed");
      expect(eventData.performedBy).toBe(travelerId);
      expect(eventData.fromPartyId).toBe(senderId);
      expect(eventData.fromPartyRole).toBe("sender");
      expect(eventData.toPartyId).toBe(travelerId);
      expect(eventData.toPartyRole).toBe("traveler");
      expect(eventData.previousEventId).toBe(`${bookingId}__traveler_accepted`);
      expect(eventData.location).toBe("Bole Airport Gate 3");
      expect(eventData.note).toBe("Package received in good condition");
      expect(eventData.metadata.bookingStatus).toBe("in_transit");
    });

    it("handles retries idempotently without duplicate events or history entries", async () => {
      const bookingId = "bk-pickup-idempotent";
      const { travelerId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: true,
        withAcceptedEvent: true,
      });

      // First call
      const firstResult = await confirmPickupCustody.run({
        data: {
          bookingId,
          location: "Bole Airport",
          custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
        },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(firstResult.alreadyTransitioned).toBe(false);

      // Second call (idempotent retry)
      const secondResult = await confirmPickupCustody.run({
        data: {
          bookingId,
          location: "Bole Airport",
          custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
        },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(secondResult.success).toBe(true);
      expect(secondResult.alreadyTransitioned).toBe(true);

      // History should not be duplicated
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.statusHistory).toHaveLength(3);

      // Only one custody event doc exists
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__pickup_confirmed`).get();
      expect(eventDoc.exists).toBe(true);
    });

    it("safely handles pickup retry when booking has already progressed to delivered or completed", async () => {
      const bookingId = "bk-pickup-later-state";
      const { travelerId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "delivered", // Already progressed!
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
        withDeliveryEvent: true,
      });

      const result = await confirmPickupCustody.run({
        data: {
          bookingId,
          location: "Bole Airport",
          custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
        },
        auth: { uid: travelerId, token: {} },
      } as any);

      expect(result.success).toBe(true);
      expect(result.alreadyTransitioned).toBe(true);

      // Booking status and history remain intact
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("delivered");
      expect(bookingDoc.data()?.statusHistory).toHaveLength(4);
    });

    it("handles concurrent pickup requests without race condition duplicates", async () => {
      const bookingId = "bk-pickup-concurrent";
      const { travelerId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: true,
        withAcceptedEvent: true,
      });

      const [res1, res2] = await Promise.all([
        confirmPickupCustody.run({
          data: {
            bookingId,
            location: "Bole Airport",
            custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
          },
          auth: { uid: travelerId, token: {} },
        } as any),
        confirmPickupCustody.run({
          data: {
            bookingId,
            location: "Bole Airport",
            custodyAcceptance: travelerCustodyAcceptanceFixture(bookingId, shipmentId, travelerId),
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      // Exactly one was new, one was alreadyTransitioned
      const transitionedFlags = [res1.alreadyTransitioned, res2.alreadyTransitioned];
      expect(transitionedFlags).toContain(false);
      expect(transitionedFlags).toContain(true);

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("in_transit");
      expect(bookingDoc.data()?.statusHistory).toHaveLength(3);
    });
  });

  describe("Travel Custody Events (within in_transit)", () => {
    it("records airport_departure and airport_arrival strictly in order", async () => {
      const bookingId = "bk-travel-seq";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
      });

      // Attempt airport_arrival before airport_departure should fail
      await expect(
        recordTravelCustodyEvent.run({
          data: {
            bookingId,
            eventType: "airport_arrival",
            location: "Washington Dulles",
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Airport arrival requires previous airport departure event/);

      // Record airport_departure
      const depResult = await recordTravelCustodyEvent.run({
        data: {
          bookingId,
          eventType: "airport_departure",
          location: "Addis Ababa Bole (ADD)",
          note: "Flight ET500 departed",
        },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(depResult.success).toBe(true);
      expect(depResult.eventId).toBe(`${bookingId}__airport_departure`);

      // Now airport_arrival succeeds
      const arrResult = await recordTravelCustodyEvent.run({
        data: {
          bookingId,
          eventType: "airport_arrival",
          location: "Washington Dulles (IAD)",
          note: "Landed safely",
        },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(arrResult.success).toBe(true);
      expect(arrResult.eventId).toBe(`${bookingId}__airport_arrival`);

      // Travel event retry is idempotent
      const retryDep = await recordTravelCustodyEvent.run({
        data: {
          bookingId,
          eventType: "airport_departure",
          location: "Addis Ababa Bole (ADD)",
        },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(retryDep.alreadyTransitioned).toBe(true);
    });

    it("rejects travel event if booking is not in_transit", async () => {
      const bookingId = "bk-travel-not-intransit";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: false,
      });

      await expect(
        recordTravelCustodyEvent.run({
          data: {
            bookingId,
            eventType: "airport_departure",
            location: "ADD",
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Travel events require an in-transit booking/);
    });
  });

  describe("Delivery Custody Transition (in_transit -> delivered)", () => {
    it("rejects delivery if delivery verification code was not verified", async () => {
      const bookingId = "bk-deliv-unverified";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        deliveryVerified: false,
        withAcceptedEvent: true,
        withPickupEvent: true,
      });

      await expect(
        confirmDeliveryCustody.run({
          data: {
            bookingId,
            location: "Dulles Arrival Hall",
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Delivery verification code has not been verified/);

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("in_transit");
    });

    it("rejects delivery if booking is not in_transit (cannot skip pickup)", async () => {
      const bookingId = "bk-deliv-skip-pickup";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: false,
        deliveryVerified: true,
      });

      await expect(
        confirmDeliveryCustody.run({
          data: {
            bookingId,
            location: "Dulles",
          },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Booking cannot transition from accepted to delivered/);
    });

    it("atomically confirms delivery, updates booking, and creates immutable delivery event", async () => {
      const bookingId = "bk-deliv-success";
      const { travelerId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
      });

      const result = await confirmDeliveryCustody.run({
        data: {
          bookingId,
          location: "Dulles Arrival Hall",
          note: "Delivered directly to Dawit",
        },
        auth: { uid: travelerId, token: {} },
      } as any);

      expect(result.success).toBe(true);
      expect(result.status).toBe("delivered");
      expect(result.alreadyTransitioned).toBe(false);

      // Verify booking
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      const bookingData = bookingDoc.data()!;
      expect(bookingData.status).toBe("delivered");
      expect(bookingData.statusHistory).toHaveLength(4); // pending -> accepted -> in_transit -> delivered
      expect(bookingData.statusHistory[3].status).toBe("delivered");

      // Verify shipment is still bound
      const shipmentDoc = await db.collection("shipments").doc(shipmentId).get();
      expect(shipmentDoc.data()?.activeBookingId).toBe(bookingId);

      // Verify custody event
      const eventDoc = await db.collection("custodyEvents").doc(`${bookingId}__delivery_confirmed`).get();
      expect(eventDoc.exists).toBe(true);
      expect(eventDoc.data()?.eventType).toBe("delivery_confirmed");
      expect(eventDoc.data()?.metadata.bookingStatus).toBe("delivered");
    });

    it("handles delivery retries idempotently", async () => {
      const bookingId = "bk-deliv-idempotent";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
      });

      const res1 = await confirmDeliveryCustody.run({
        data: { bookingId, location: "Dulles" },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(res1.alreadyTransitioned).toBe(false);

      const res2 = await confirmDeliveryCustody.run({
        data: { bookingId, location: "Dulles" },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(res2.success).toBe(true);
      expect(res2.alreadyTransitioned).toBe(true);

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.statusHistory).toHaveLength(4);
    });

    it("handles delivery retry when booking has already progressed to completed", async () => {
      const bookingId = "bk-deliv-completed-state";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "completed", // already completed!
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
        withDeliveryEvent: true,
      });

      const res = await confirmDeliveryCustody.run({
        data: { bookingId, location: "Dulles" },
        auth: { uid: travelerId, token: {} },
      } as any);
      expect(res.success).toBe(true);
      expect(res.alreadyTransitioned).toBe(true);

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("completed");
      expect(bookingDoc.data()?.statusHistory).toHaveLength(5);
    });

    it("handles concurrent delivery requests without race condition duplicates", async () => {
      const bookingId = "bk-deliv-concurrent";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
      });

      const [res1, res2] = await Promise.all([
        confirmDeliveryCustody.run({
          data: { bookingId, location: "Dulles" },
          auth: { uid: travelerId, token: {} },
        } as any),
        confirmDeliveryCustody.run({
          data: { bookingId, location: "Dulles" },
          auth: { uid: travelerId, token: {} },
        } as any),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      const transitionedFlags = [res1.alreadyTransitioned, res2.alreadyTransitioned];
      expect(transitionedFlags).toContain(false);
      expect(transitionedFlags).toContain(true);

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.status).toBe("delivered");
      expect(bookingDoc.data()?.statusHistory).toHaveLength(4);
    });
  });

  describe("Administrative Completion Transition (delivered -> completed)", () => {
    it("rejects completion if booking is not delivered", async () => {
      const bookingId = "bk-comp-not-delivered";
      const { senderId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "in_transit",
      });

      await expect(
        completeBookingCustody.run({
          data: { bookingId },
          auth: { uid: senderId, token: {} },
        } as any),
      ).rejects.toThrow(/Booking cannot transition from in_transit to completed/);
    });

    it("rejects completion if called by non-sender (e.g. traveler)", async () => {
      const bookingId = "bk-comp-wrong-actor";
      const { travelerId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "delivered",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
        withDeliveryEvent: true,
      });

      await expect(
        completeBookingCustody.run({
          data: { bookingId },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/Only the booking sender can acknowledge completion/);
    });

    it("completes booking administratively WITHOUT creating a fake physical custody event", async () => {
      const bookingId = "bk-comp-success";
      const { senderId, shipmentId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "delivered",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
        withDeliveryEvent: true,
      });

      const result = await completeBookingCustody.run({
        data: { bookingId },
        auth: { uid: senderId, token: {} },
      } as any);

      expect(result.success).toBe(true);
      expect(result.status).toBe("completed");
      expect(result.alreadyTransitioned).toBe(false);
      expect(result.eventId).toBeUndefined(); // NO physical event created!

      // Verify booking
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      const bookingData = bookingDoc.data()!;
      expect(bookingData.status).toBe("completed");
      expect(bookingData.statusHistory).toHaveLength(5); // pending -> accepted -> in_transit -> delivered -> completed
      expect(bookingData.statusHistory[4].status).toBe("completed");
      expect(bookingData.statusHistory[4].changedBy).toBe(senderId);

      // Verify shipment is still bound
      const shipmentDoc = await db.collection("shipments").doc(shipmentId).get();
      expect(shipmentDoc.data()?.activeBookingId).toBe(bookingId);

      // Verify NO fake custody event created
      const fakeDoc = await db.collection("custodyEvents").doc(`${bookingId}__completed`).get();
      expect(fakeDoc.exists).toBe(false);
    });

    it("handles completion retries idempotently", async () => {
      const bookingId = "bk-comp-idempotent";
      const { senderId } = await seedBookingFixture(bookingId, undefined, undefined, {
        bookingStatus: "delivered",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
        withDeliveryEvent: true,
      });

      const res1 = await completeBookingCustody.run({
        data: { bookingId },
        auth: { uid: senderId, token: {} },
      } as any);
      expect(res1.alreadyTransitioned).toBe(false);

      const res2 = await completeBookingCustody.run({
        data: { bookingId },
        auth: { uid: senderId, token: {} },
      } as any);
      expect(res2.success).toBe(true);
      expect(res2.alreadyTransitioned).toBe(true);

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      expect(bookingDoc.data()?.statusHistory).toHaveLength(5);
    });
  });

  describe("LegacyCustodyReconciler (Read-Only Audit Tool)", () => {
    it("correctly identifies all anomaly categories in read-only mode", async () => {
      const reconciler = new LegacyCustodyReconciler(db);

      // 1. Consistent booking
      await seedBookingFixture("bk-recon-consistent", undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
      });

      // 2. Missing traveler_accepted: accepted booking without traveler_accepted
      await seedBookingFixture("bk-recon-missing-acc", undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: false,
        withAcceptedEvent: false, // missing!
      });

      // 3. Missing pickup: booking in_transit, but no pickup_confirmed event
      await seedBookingFixture("bk-recon-missing-pick", undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: false, // missing!
      });

      // 4. Missing delivery: booking delivered, but no delivery_confirmed event
      await seedBookingFixture("bk-recon-missing-del", undefined, undefined, {
        bookingStatus: "delivered",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
        withDeliveryEvent: false, // missing!
      });

      // 5. Orphan event: event refers to non-existent booking
      await db.collection("custodyEvents").doc("orphan-booking-id__pickup_confirmed").set({
        bookingId: "orphan-booking-id",
        shipmentId: "shipment-orphan",
        eventType: "pickup_confirmed",
        performedBy: "traveler-1",
        timestamp: admin.firestore.Timestamp.now(),
      });

      // 6. Duplicate event: two events for same event type
      const dupBookingId = "bk-recon-dup";
      await seedBookingFixture(dupBookingId, undefined, undefined, {
        bookingStatus: "in_transit",
        pickupVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: true,
      });
      await db.collection("custodyEvents").doc(`${dupBookingId}__pickup_confirmed_dup`).set({
        bookingId: dupBookingId,
        shipmentId: `shipment-${dupBookingId}`,
        eventType: "pickup_confirmed",
        performedBy: "traveler-c-1",
        timestamp: admin.firestore.Timestamp.now(),
      });

      // 7. Invalid sequence: delivered status with delivery event, but missing pickup event
      await seedBookingFixture("bk-recon-invalid-seq", undefined, undefined, {
        bookingStatus: "delivered",
        pickupVerified: true,
        deliveryVerified: true,
        withAcceptedEvent: true,
        withPickupEvent: false, // invalid sequence!
        withDeliveryEvent: true,
      });

      // 8. Event type mismatch: doc ID suffix says traveler_accepted, but payload says pickup_confirmed
      const mismatchBookingId = "bk-recon-type-mismatch";
      await seedBookingFixture(mismatchBookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: false,
        withAcceptedEvent: false,
      });
      await db.collection("custodyEvents").doc(`${mismatchBookingId}__traveler_accepted`).set({
        bookingId: mismatchBookingId,
        shipmentId: `shipment-${mismatchBookingId}`,
        eventType: "pickup_confirmed", // Mismatched with suffix!
        performedBy: "traveler-c-1",
        timestamp: admin.firestore.Timestamp.now(),
      });

      // 9. Booking ID mismatch: doc ID prefix does not match payload bookingId
      await db.collection("custodyEvents").doc("different-prefix__pickup_confirmed").set({
        bookingId: "actual-booking-id", // Mismatched with prefix!
        shipmentId: "shipment-1",
        eventType: "pickup_confirmed",
        performedBy: "traveler-c-1",
        timestamp: admin.firestore.Timestamp.now(),
      });

      // 10. Shipment ID mismatch: event shipmentId does not match booking shipmentId
      const shipMismatchBookingId = "bk-recon-ship-mismatch";
      await seedBookingFixture(shipMismatchBookingId, undefined, undefined, {
        bookingStatus: "accepted",
        pickupVerified: false,
        withAcceptedEvent: false,
      });
      await db.collection("custodyEvents").doc(`${shipMismatchBookingId}__traveler_accepted`).set({
        bookingId: shipMismatchBookingId,
        shipmentId: "wrong-shipment-id", // Mismatched!
        eventType: "traveler_accepted",
        performedBy: "traveler-c-1",
        timestamp: admin.firestore.Timestamp.now(),
      });

      const report = await reconciler.reconcile();

      expect(report.dryRun).toBe(true);
      expect(report.bookingsScanned).toBe(8);
      expect(report.anomalies.length).toBeGreaterThanOrEqual(8);

      const anomalyTypes = report.anomalies.map((a) => a.type);
      expect(anomalyTypes).toContain("missing_event");
      expect(anomalyTypes).toContain("orphan_event");
      expect(anomalyTypes).toContain("duplicate_event");
      expect(anomalyTypes).toContain("invalid_sequence");
      expect(anomalyTypes).toContain("event_type_mismatch");
      expect(anomalyTypes).toContain("booking_mismatch");
      expect(anomalyTypes).toContain("shipment_mismatch");

      // Verify no records were deleted or modified (dry run)
      const orphanDoc = await db.collection("custodyEvents").doc("orphan-booking-id__pickup_confirmed").get();
      expect(orphanDoc.exists).toBe(true);
    });
  });
});
