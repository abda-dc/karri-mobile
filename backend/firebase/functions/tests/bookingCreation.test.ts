import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import { requestBooking } from "../src/index.js";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "demo-karri-mobile",
  });
}

const db = admin.firestore();

interface SeedTripOptions {
  ownerId?: string;
  originCountry?: string;
  originCity?: string;
  destinationCountry?: string;
  destinationCity?: string;
  totalCapacityKg?: number;
  availableCapacityKg?: number;
  reservedCapacityKg?: number;
  status?: string;
}

async function seedTrip(tripId: string, options: SeedTripOptions = {}) {
  const total = options.totalCapacityKg ?? 15;
  const reserved = options.reservedCapacityKg ?? 0;
  const available = options.availableCapacityKg ?? (total - reserved);

  await db.collection("trips").doc(tripId).set({
    ownerId: options.ownerId ?? "traveler-1",
    originCountry: options.originCountry ?? "Ethiopia",
    originCity: options.originCity ?? "Addis Ababa",
    destinationCountry: options.destinationCountry ?? "United States",
    destinationCity: options.destinationCity ?? "Washington",
    departureDate: "2026-04-01",
    arrivalDate: "2026-04-02",
    totalCapacityKg: total,
    reservedCapacityKg: reserved,
    availableCapacityKg: available,
    notes: "Trip for booking creation tests",
    status: options.status ?? "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

interface SeedShipmentOptions {
  ownerId?: string;
  originCountry?: string;
  originCity?: string;
  destinationCountry?: string;
  destinationCity?: string;
  weightKg?: number;
  status?: string;
  activeBookingId?: string | null;
  activeCarrierId?: string | null;
  activeTripId?: string | null;
}

async function seedShipment(shipmentId: string, options: SeedShipmentOptions = {}) {
  await db.collection("shipments").doc(shipmentId).set({
    ownerId: options.ownerId ?? "sender-1",
    originCountry: options.originCountry ?? "Ethiopia",
    originCity: options.originCity ?? "Addis Ababa",
    destinationCountry: options.destinationCountry ?? "United States",
    destinationCity: options.destinationCity ?? "Washington",
    packageCategory: "electronics",
    packageDescription: "test package",
    weightKg: options.weightKg ?? 5,
    deliveryWindow: "2026-04-01 to 2026-04-10",
    rewardAmount: 80,
    rewardCurrency: "USD",
    status: options.status ?? "active",
    containsBattery: false,
    batteryType: "none",
    containsLiquid: false,
    containsFoodOrAgri: false,
    containsMedicine: false,
    customsDeclarationRequired: false,
    packageContentVersion: 1,
    activeBookingId: options.activeBookingId ?? null,
    activeCarrierId: options.activeCarrierId ?? null,
    activeTripId: options.activeTripId ?? null,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

describe("Booking Creation & Duplicate Safety (R09)", () => {
  beforeEach(async () => {
    const collections = [
      "bookings",
      "bookingRequests",
      "shipments",
      "trips",
      "custodyEvents",
      "bookingHandoffSecrets",
      "bookingHandoffAgreements",
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

  it("1. Successfully creates a booking and initial custody event on first submission", async () => {
    const shipmentId = "ship-1";
    const tripId = "trip-1";
    const senderId = "sender-1";
    const travelerId = "traveler-1";

    await seedShipment(shipmentId, { ownerId: senderId, weightKg: 5 });
    await seedTrip(tripId, { ownerId: travelerId, totalCapacityKg: 20 });

    const result = await (requestBooking.run as any)({
      data: {
        shipmentId,
        tripId,
        senderId,
        travelerId,
        message: "Please deliver my package",
      },
      auth: { uid: senderId, token: {} },
    });

    expect(result.success).toBe(true);
    expect(result.alreadyExisted).toBe(false);
    expect(result.rebooked).toBe(false);
    expect(result.bookingId).toBe(`booking__${shipmentId}__${tripId}`);
    expect(result.status).toBe("pending");

    // Verify Firestore state
    const bookingDoc = await db.collection("bookings").doc(result.bookingId).get();
    expect(bookingDoc.exists).toBe(true);
    expect(bookingDoc.data()?.status).toBe("pending");
    expect(bookingDoc.data()?.senderId).toBe(senderId);
    expect(bookingDoc.data()?.travelerId).toBe(travelerId);

    const requestDoc = await db.collection("bookingRequests").doc(result.bookingRequestId).get();
    expect(requestDoc.exists).toBe(true);
    expect(requestDoc.data()?.status).toBe("pending");

    const custodySnap = await db
      .collection("custodyEvents")
      .where("bookingId", "==", result.bookingId)
      .get();
    expect(custodySnap.empty).toBe(false);
    expect(custodySnap.docs[0].data().eventType).toBe("shipment_created");
  });

  it("2. Duplicate request returns existing booking with alreadyExisted: true and no duplicate records", async () => {
    const shipmentId = "ship-dup";
    const tripId = "trip-dup";
    const senderId = "sender-dup";
    const travelerId = "traveler-dup";

    await seedShipment(shipmentId, { ownerId: senderId });
    await seedTrip(tripId, { ownerId: travelerId });

    // Call 1
    const result1 = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, message: "Hello" },
      auth: { uid: senderId, token: {} },
    });
    expect(result1.alreadyExisted).toBe(false);

    // Call 2 (identical retry)
    const result2 = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, message: "Hello" },
      auth: { uid: senderId, token: {} },
    });
    expect(result2.success).toBe(true);
    expect(result2.alreadyExisted).toBe(true);
    expect(result2.bookingId).toBe(result1.bookingId);
    expect(result2.bookingRequestId).toBe(result1.bookingRequestId);

    // Ensure only 1 booking doc exists
    const bookingsSnap = await db.collection("bookings").where("shipmentId", "==", shipmentId).get();
    expect(bookingsSnap.size).toBe(1);

    const requestsSnap = await db.collection("bookingRequests").where("shipmentId", "==", shipmentId).get();
    expect(requestsSnap.size).toBe(1);
  });

  it("3. Concurrent requests are serialized and result in exactly one booking", async () => {
    const shipmentId = "ship-race";
    const tripId = "trip-race";
    const senderId = "sender-race";
    const travelerId = "traveler-race";

    await seedShipment(shipmentId, { ownerId: senderId });
    await seedTrip(tripId, { ownerId: travelerId });

    const [res1, res2] = await Promise.all([
      (requestBooking.run as any)({
        data: { shipmentId, tripId, senderId, travelerId },
        auth: { uid: senderId, token: {} },
      }),
      (requestBooking.run as any)({
        data: { shipmentId, tripId, senderId, travelerId },
        auth: { uid: senderId, token: {} },
      }),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.bookingId).toBe(res2.bookingId);

    // One must be newly created and the other detected as already existed
    const alreadyExistedFlags = [res1.alreadyExisted, res2.alreadyExisted];
    expect(alreadyExistedFlags).toContain(false);
    expect(alreadyExistedFlags).toContain(true);

    const bookingsSnap = await db.collection("bookings").where("shipmentId", "==", shipmentId).get();
    expect(bookingsSnap.size).toBe(1);
  });

  it("4. Idempotent retry with operationId returns existing booking", async () => {
    const shipmentId = "ship-op";
    const tripId = "trip-op";
    const senderId = "sender-op";
    const travelerId = "traveler-op";
    const operationId = "client-uuid-999";

    await seedShipment(shipmentId, { ownerId: senderId });
    await seedTrip(tripId, { ownerId: travelerId });

    const res1 = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, operationId },
      auth: { uid: senderId, token: {} },
    });
    expect(res1.alreadyExisted).toBe(false);

    const res2 = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, operationId },
      auth: { uid: senderId, token: {} },
    });
    expect(res2.alreadyExisted).toBe(true);
    expect(res2.bookingId).toBe(res1.bookingId);
  });

  it("5. Rebooking after cancellation creates a new distinct booking preserving history", async () => {
    const shipmentId = "ship-rebook";
    const tripId = "trip-rebook";
    const senderId = "sender-rebook";
    const travelerId = "traveler-rebook";

    await seedShipment(shipmentId, { ownerId: senderId });
    await seedTrip(tripId, { ownerId: travelerId });

    // Initial booking
    const res1 = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId },
      auth: { uid: senderId, token: {} },
    });

    // Simulate cancellation of the first booking
    await db.collection("bookings").doc(res1.bookingId).update({
      status: "cancelled",
      updatedAt: admin.firestore.Timestamp.now(),
    });
    await db.collection("bookingRequests").doc(res1.bookingRequestId).update({
      status: "cancelled",
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Sender rebooks the same shipment on the same trip
    const res2 = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, message: "Rebooking attempt" },
      auth: { uid: senderId, token: {} },
    });

    expect(res2.success).toBe(true);
    expect(res2.alreadyExisted).toBe(false);
    expect(res2.rebooked).toBe(true);
    expect(res2.bookingId).not.toBe(res1.bookingId);
    expect(res2.status).toBe("pending");

    // Both booking records exist in Firestore
    const oldBooking = await db.collection("bookings").doc(res1.bookingId).get();
    const newBooking = await db.collection("bookings").doc(res2.bookingId).get();
    expect(oldBooking.data()?.status).toBe("cancelled");
    expect(newBooking.data()?.status).toBe("pending");
  });

  it("6. Rebooking rejected when shipment is already completed", async () => {
    const shipmentId = "ship-comp";
    const tripId = "trip-comp";
    const senderId = "sender-comp";
    const travelerId = "traveler-comp";

    await seedShipment(shipmentId, { ownerId: senderId, status: "completed" });
    await seedTrip(tripId, { ownerId: travelerId });

    await expect(
      (requestBooking.run as any)({
        data: { shipmentId, tripId, senderId, travelerId },
        auth: { uid: senderId, token: {} },
      }),
    ).rejects.toThrow(/shipment listing is not active/i);
  });

  it("7. Conflict error when shipment already has an active booking on another trip", async () => {
    const shipmentId = "ship-multi";
    const trip1 = "trip-first";
    const trip2 = "trip-second";
    const senderId = "sender-multi";
    const travelerId = "traveler-multi";

    await seedShipment(shipmentId, { ownerId: senderId });
    await seedTrip(trip1, { ownerId: travelerId });
    await seedTrip(trip2, { ownerId: travelerId });

    // Active booking on trip 1
    await (requestBooking.run as any)({
      data: { shipmentId, tripId: trip1, senderId, travelerId },
      auth: { uid: senderId, token: {} },
    });

    // Attempt booking on trip 2
    await expect(
      (requestBooking.run as any)({
        data: { shipmentId, tripId: trip2, senderId, travelerId },
        auth: { uid: senderId, token: {} },
      }),
    ).rejects.toThrow(/already has an active booking/i);
  });

  it("8. Rejects self-booking (sender == traveler)", async () => {
    const shipmentId = "ship-self";
    const tripId = "trip-self";
    const userId = "same-user";

    await seedShipment(shipmentId, { ownerId: userId });
    await seedTrip(tripId, { ownerId: userId });

    await expect(
      (requestBooking.run as any)({
        data: { shipmentId, tripId, senderId: userId, travelerId: userId },
        auth: { uid: userId, token: {} },
      }),
    ).rejects.toThrow(/cannot request a booking from the same account/i);
  });

  it("9. Rejects caller who is not the shipment owner", async () => {
    const shipmentId = "ship-impostor";
    const tripId = "trip-impostor";
    const senderId = "sender-legit";
    const impostorId = "impostor";
    const travelerId = "traveler-legit";

    await seedShipment(shipmentId, { ownerId: senderId });
    await seedTrip(tripId, { ownerId: travelerId });

    await expect(
      (requestBooking.run as any)({
        data: { shipmentId, tripId, senderId, travelerId },
        auth: { uid: impostorId, token: {} },
      }),
    ).rejects.toThrow(/only the shipment owner can request a booking/i);
  });

  it("10. Rejects when corridor does not match", async () => {
    const shipmentId = "ship-corridor";
    const tripId = "trip-corridor";
    const senderId = "sender-corr";
    const travelerId = "traveler-corr";

    await seedShipment(shipmentId, {
      ownerId: senderId,
      originCity: "Nairobi",
      destinationCity: "London",
    });
    await seedTrip(tripId, {
      ownerId: travelerId,
      originCity: "Addis Ababa",
      destinationCity: "Washington",
    });

    await expect(
      (requestBooking.run as any)({
        data: { shipmentId, tripId, senderId, travelerId },
        auth: { uid: senderId, token: {} },
      }),
    ).rejects.toThrow(/corridors must match/i);
  });

  it("11. Rejects when shipment weight exceeds available trip capacity", async () => {
    const shipmentId = "ship-heavy";
    const tripId = "trip-light";
    const senderId = "sender-hvy";
    const travelerId = "traveler-lgt";

    await seedShipment(shipmentId, { ownerId: senderId, weightKg: 25 });
    await seedTrip(tripId, { ownerId: travelerId, totalCapacityKg: 10, availableCapacityKg: 10 });

    await expect(
      (requestBooking.run as any)({
        data: { shipmentId, tripId, senderId, travelerId },
        auth: { uid: senderId, token: {} },
      }),
    ).rejects.toThrow(/not have enough available capacity/i);
  });

  it("12. Reuses same operation ID with matching payload idempotently without duplicating resource", async () => {
    const shipmentId = "ship-idemp-match";
    const tripId = "trip-idemp-match";
    const senderId = "sender-idemp";
    const travelerId = "traveler-idemp";
    const opId = "op-stable-123";

    await seedShipment(shipmentId, { ownerId: senderId });
    await seedTrip(tripId, { ownerId: travelerId });

    // First attempt: succeeds and creates booking
    const firstResult = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, message: "Handled with care", operationId: opId },
      auth: { uid: senderId, token: {} },
    });

    expect(firstResult.success).toBe(true);
    expect(firstResult.alreadyExisted).toBe(false);

    // Simulated retry with same operationId and same payload
    const retryResult = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, message: "Handled with care", operationId: opId },
      auth: { uid: senderId, token: {} },
    });

    expect(retryResult.success).toBe(true);
    expect(retryResult.alreadyExisted).toBe(true);
    expect(retryResult.bookingId).toBe(firstResult.bookingId);

    // Verify only one booking document exists
    const bookingsSnap = await db.collection("bookings").where("senderId", "==", senderId).get();
    expect(bookingsSnap.size).toBe(1);
  });

  it("13. Rejects same operation ID when supplied with materially different payload (conflict)", async () => {
    const shipmentId = "ship-idemp-diff";
    const tripId = "trip-idemp-diff";
    const senderId = "sender-idemp-diff";
    const travelerId = "traveler-idemp-diff";
    const opId = "op-collision-test";

    await seedShipment(shipmentId, { ownerId: senderId });
    await seedTrip(tripId, { ownerId: travelerId });

    // First call: message A
    const firstResult = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, message: "Original payload message", operationId: opId },
      auth: { uid: senderId, token: {} },
    });
    expect(firstResult.success).toBe(true);

    // Second call: same operationId, different message -> conflict error!
    await expect(
      (requestBooking.run as any)({
        data: { shipmentId, tripId, senderId, travelerId, message: "Materially different message", operationId: opId },
        auth: { uid: senderId, token: {} },
      }),
    ).rejects.toThrow(/Operation ID already exists with a different request payload/i);
  });

  it("14. Retry with a fresh client operation ID after simulated process death reconciles server-side to the same active booking without duplicate capacity allocation or side effects", async () => {
    const shipmentId = "ship-restart-fresh";
    const tripId = "trip-restart-fresh";
    const senderId = "sender-restart-fresh";
    const travelerId = "traveler-restart-fresh";
    const opIdInitial = "op-initial-crashed";
    const opIdAfterRestart = "op-fresh-after-restart";

    await seedShipment(shipmentId, { ownerId: senderId, weightKg: 3 });
    await seedTrip(tripId, { ownerId: travelerId, availableCapacityKg: 10 });

    // Step 1: Initial call before crash/process death
    const firstResult = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, operationId: opIdInitial },
      auth: { uid: senderId, token: {} },
    });

    expect(firstResult.success).toBe(true);
    expect(firstResult.alreadyExisted).toBe(false);
    expect(firstResult.bookingId).toBeTruthy();

    // Verify exactly one custody event and one request were created
    const initialCustodySnap = await db.collection("custodyEvents").where("bookingId", "==", firstResult.bookingId).get();
    expect(initialCustodySnap.size).toBe(1);

    const initialReqSnap = await db.collection("bookingRequests").where("bookingId", "==", firstResult.bookingId).get();
    expect(initialReqSnap.size).toBe(1);

    // Step 2: Simulated process death / app restart occurred, and caller retries with a brand new, fresh operation ID
    const retryResult = await (requestBooking.run as any)({
      data: { shipmentId, tripId, senderId, travelerId, operationId: opIdAfterRestart },
      auth: { uid: senderId, token: {} },
    });

    // Step 3: Server-side active-booking reconciliation returns the same booking
    expect(retryResult.success).toBe(true);
    expect(retryResult.alreadyExisted).toBe(true);
    expect(retryResult.bookingId).toBe(firstResult.bookingId);
    expect(retryResult.status).toBe("pending");

    // Step 4: Verify zero duplicate allocations and zero duplicate side effects
    const allBookingsSnap = await db.collection("bookings").where("shipmentId", "==", shipmentId).get();
    expect(allBookingsSnap.size).toBe(1);

    const allRequestsSnap = await db.collection("bookingRequests").where("bookingId", "==", firstResult.bookingId).get();
    expect(allRequestsSnap.size).toBe(1);

    const allCustodySnap = await db.collection("custodyEvents").where("bookingId", "==", firstResult.bookingId).get();
    expect(allCustodySnap.size).toBe(1);

    const tripDoc = await db.collection("trips").doc(tripId).get();
    expect(tripDoc.data()?.availableCapacityKg).toBe(10);
  });
});
