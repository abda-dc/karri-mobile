import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import { acceptBooking } from "../src/index.js";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "demo-karri-mobile",
  });
}

const db = admin.firestore();

interface SeedTripOptions {
  ownerId?: string;
  totalCapacityKg?: number;
  availableCapacityKg?: number;
  reservedCapacityKg?: number;
  status?: string;
}

async function seedTrip(tripId: string, options: SeedTripOptions = {}) {
  const total = options.totalCapacityKg ?? 10;
  const reserved = options.reservedCapacityKg ?? 0;
  const available = options.availableCapacityKg ?? (total - reserved);

  const data: Record<string, any> = {
    ownerId: options.ownerId ?? "traveler-1",
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    departureDate: "2026-03-01",
    arrivalDate: "2026-03-02",
    availableCapacityKg: available,
    notes: "Trip for testing",
    status: options.status ?? "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  };

  if (options.totalCapacityKg !== undefined) {
    data.totalCapacityKg = total;
  }
  if (options.reservedCapacityKg !== undefined) {
    data.reservedCapacityKg = reserved;
  }

  await db.collection("trips").doc(tripId).set(data);
}

interface SeedShipmentOptions {
  ownerId?: string;
  weightKg?: number;
  status?: string;
  activeBookingId?: string | null;
  activeCarrierId?: string | null;
}

async function seedShipment(shipmentId: string, options: SeedShipmentOptions = {}) {
  await db.collection("shipments").doc(shipmentId).set({
    ownerId: options.ownerId ?? "sender-1",
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    packageCategory: "electronics",
    packageDescription: "laptop package",
    weightKg: options.weightKg ?? 5,
    deliveryWindow: "2026-03-01 to 2026-03-10",
    rewardAmount: 60,
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
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

interface SeedBookingOptions {
  bookingRequestId?: string;
  shipmentId: string;
  tripId: string;
  senderId?: string;
  travelerId?: string;
  status?: string;
  reservedWeightKg?: number;
}

async function seedBooking(bookingId: string, options: SeedBookingOptions) {
  const reqId = options.bookingRequestId ?? `req-${bookingId}`;
  const senderId = options.senderId ?? "sender-1";
  const travelerId = options.travelerId ?? "traveler-1";
  const status = options.status ?? "pending";

  await db.collection("bookingRequests").doc(reqId).set({
    bookingId,
    shipmentId: options.shipmentId,
    tripId: options.tripId,
    senderId,
    travelerId,
    message: "Booking request test",
    status,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("bookings").doc(bookingId).set({
    bookingRequestId: reqId,
    shipmentId: options.shipmentId,
    tripId: options.tripId,
    senderId,
    travelerId,
    status,
    statusHistory: [
      {
        status,
        changedAt: admin.firestore.Timestamp.now(),
        changedBy: senderId,
      },
    ],
    ...(options.reservedWeightKg !== undefined ? { reservedWeightKg: options.reservedWeightKg } : {}),
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

describe("Booking Acceptance Transaction & Exclusivity (R03)", () => {
  beforeEach(async () => {
    const collections = ["bookings", "bookingRequests", "shipments", "trips", "custodyEvents"];
    for (const name of collections) {
      const snap = await db.collection(name).get();
      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
  });

  it("Test A — Oversubscription race: exactly one concurrent acceptance succeeds", async () => {
    const tripId = "trip-race-oversub";
    const travelerId = "traveler-race-1";
    // Trip capacity: 8 kg
    await seedTrip(tripId, { ownerId: travelerId, totalCapacityKg: 8, availableCapacityKg: 8, reservedCapacityKg: 0 });

    // Shipment A (6 kg) and Shipment B (6 kg)
    const shipmentA = "shipment-a";
    const shipmentB = "shipment-b";
    await seedShipment(shipmentA, { weightKg: 6 });
    await seedShipment(shipmentB, { weightKg: 6 });

    const bookingA = "booking-a";
    const bookingB = "booking-b";
    await seedBooking(bookingA, { shipmentId: shipmentA, tripId, travelerId });
    await seedBooking(bookingB, { shipmentId: shipmentB, tripId, travelerId });

    // Concurrently attempt to accept both
    const results = await Promise.allSettled([
      acceptBooking.run({
        data: { bookingId: bookingA },
        auth: { uid: travelerId, token: {} },
      } as any),
      acceptBooking.run({
        data: { bookingId: bookingB },
        auth: { uid: travelerId, token: {} },
      } as any),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const failureReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failureReason.message).toMatch(/no longer has enough available capacity/i);

    // Verify trip committed state
    const tripDoc = await db.collection("trips").doc(tripId).get();
    const tripData = tripDoc.data()!;
    expect(tripData.reservedCapacityKg).toBe(6);
    expect(tripData.availableCapacityKg).toBe(2);
    expect(tripData.totalCapacityKg).toBe(8);

    // Verify bookings state
    const docA = await db.collection("bookings").doc(bookingA).get();
    const docB = await db.collection("bookings").doc(bookingB).get();
    const statuses = [docA.data()!.status, docB.data()!.status].sort();
    expect(statuses).toEqual(["accepted", "pending"]);
  });

  it("Test B — Same shipment race: exactly one carrier succeeds in claiming the shipment", async () => {
    const shipmentId = "shipment-shared";
    await seedShipment(shipmentId, { weightKg: 4 });

    const trip1 = "trip-carrier-1";
    const trip2 = "trip-carrier-2";
    const traveler1 = "traveler-carrier-1";
    const traveler2 = "traveler-carrier-2";

    await seedTrip(trip1, { ownerId: traveler1, totalCapacityKg: 10, availableCapacityKg: 10, reservedCapacityKg: 0 });
    await seedTrip(trip2, { ownerId: traveler2, totalCapacityKg: 10, availableCapacityKg: 10, reservedCapacityKg: 0 });

    const booking1 = "booking-carrier-1";
    const booking2 = "booking-carrier-2";
    await seedBooking(booking1, { shipmentId, tripId: trip1, travelerId: traveler1 });
    await seedBooking(booking2, { shipmentId, tripId: trip2, travelerId: traveler2 });

    const results = await Promise.allSettled([
      acceptBooking.run({
        data: { bookingId: booking1 },
        auth: { uid: traveler1, token: {} },
      } as any),
      acceptBooking.run({
        data: { bookingId: booking2 },
        auth: { uid: traveler2, token: {} },
      } as any),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const failureReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failureReason.message).toMatch(/already been accepted by another traveler/i);

    // Verify shipment has exactly 1 active booking claim
    const shipmentDoc = await db.collection("shipments").doc(shipmentId).get();
    const shipmentData = shipmentDoc.data()!;
    expect([booking1, booking2]).toContain(shipmentData.activeBookingId);
    expect([traveler1, traveler2]).toContain(shipmentData.activeCarrierId);
  });

  it("Test C — Exact capacity: succeeds and leaves 0 remaining capacity", async () => {
    const tripId = "trip-exact";
    const travelerId = "traveler-exact";
    await seedTrip(tripId, { ownerId: travelerId, totalCapacityKg: 8, availableCapacityKg: 8, reservedCapacityKg: 0 });

    const shipmentId = "shipment-exact";
    await seedShipment(shipmentId, { weightKg: 8 });

    const bookingId = "booking-exact";
    await seedBooking(bookingId, { shipmentId, tripId, travelerId });

    const result = await acceptBooking.run({
      data: { bookingId, location: "Addis Ababa Terminal 2", note: "Exact weight acceptance" },
      auth: { uid: travelerId, token: {} },
    } as any);

    expect(result.success).toBe(true);
    expect(result.alreadyAccepted).toBe(false);
    expect(result.reservedWeightKg).toBe(8);

    const tripDoc = await db.collection("trips").doc(tripId).get();
    const tripData = tripDoc.data()!;
    expect(tripData.reservedCapacityKg).toBe(8);
    expect(tripData.availableCapacityKg).toBe(0);

    // Next positive-weight acceptance must fail
    const shipment2 = "shipment-overflow";
    await seedShipment(shipment2, { weightKg: 0.5 });
    const booking2 = "booking-overflow";
    await seedBooking(booking2, { shipmentId: shipment2, tripId, travelerId });

    await expect(
      acceptBooking.run({
        data: { bookingId: booking2 },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrowError(/no longer has enough available capacity/i);
  });

  it("Test D — Repeated same acceptance (idempotency): does not double-reserve", async () => {
    const tripId = "trip-idempotent";
    const travelerId = "traveler-idem";
    await seedTrip(tripId, { ownerId: travelerId, totalCapacityKg: 10, availableCapacityKg: 10, reservedCapacityKg: 0 });

    const shipmentId = "shipment-idem";
    await seedShipment(shipmentId, { weightKg: 3 });

    const bookingId = "booking-idem";
    await seedBooking(bookingId, { shipmentId, tripId, travelerId });

    // First acceptance
    const res1 = await acceptBooking.run({
      data: { bookingId },
      auth: { uid: travelerId, token: {} },
    } as any);
    expect(res1.success).toBe(true);
    expect(res1.alreadyAccepted).toBe(false);

    // Second acceptance (same request retried)
    const res2 = await acceptBooking.run({
      data: { bookingId },
      auth: { uid: travelerId, token: {} },
    } as any);
    expect(res2.success).toBe(true);
    expect(res2.alreadyAccepted).toBe(true);

    // Verify trip reservation was not incremented twice
    const tripDoc = await db.collection("trips").doc(tripId).get();
    expect(tripDoc.data()!.reservedCapacityKg).toBe(3);
    expect(tripDoc.data()!.availableCapacityKg).toBe(7);
  });

  it("Test E — Stale client: transaction re-reads current data and rejects", async () => {
    const tripId = "trip-stale";
    const travelerId = "traveler-stale";
    // Originally 10 kg
    await seedTrip(tripId, { ownerId: travelerId, totalCapacityKg: 10, availableCapacityKg: 10, reservedCapacityKg: 0 });

    // Middle acceptance happens and reserves 7 kg
    const priorShipment = "shipment-prior";
    await seedShipment(priorShipment, { weightKg: 7 });
    const priorBooking = "booking-prior";
    await seedBooking(priorBooking, { shipmentId: priorShipment, tripId, travelerId });
    await acceptBooking.run({
      data: { bookingId: priorBooking },
      auth: { uid: travelerId, token: {} },
    } as any);

    // Stale client loaded 10 kg earlier, now tries to accept 6 kg package (which exceeds remaining 3 kg)
    const staleShipment = "shipment-stale";
    await seedShipment(staleShipment, { weightKg: 6 });
    const staleBooking = "booking-stale";
    await seedBooking(staleBooking, { shipmentId: staleShipment, tripId, travelerId });

    await expect(
      acceptBooking.run({
        data: { bookingId: staleBooking },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrowError(/no longer has enough available capacity/i);
  });

  it("Test F — Unauthorized caller is rejected", async () => {
    const tripId = "trip-unauth";
    const travelerId = "traveler-legit";
    await seedTrip(tripId, { ownerId: travelerId, totalCapacityKg: 10, availableCapacityKg: 10 });

    const shipmentId = "shipment-unauth";
    await seedShipment(shipmentId, { weightKg: 2 });

    const bookingId = "booking-unauth";
    await seedBooking(bookingId, { shipmentId, tripId, travelerId });

    await expect(
      acceptBooking.run({
        data: { bookingId },
        auth: { uid: "imposter-user", token: {} },
      } as any),
    ).rejects.toThrowError(/Only the assigned traveler can accept this booking/i);
  });

  it("Test G — Legacy trip, no historical bookings: effective reserved capacity = 0", async () => {
    const tripId = "trip-legacy-empty";
    const travelerId = "traveler-legacy-empty";
    // Legacy trip only has availableCapacityKg: 10, no reservedCapacityKg or totalCapacityKg
    await seedTrip(tripId, { ownerId: travelerId, availableCapacityKg: 10 });

    const shipmentId = "shipment-legacy-empty";
    await seedShipment(shipmentId, { weightKg: 4 });

    const bookingId = "booking-legacy-empty";
    await seedBooking(bookingId, { shipmentId, tripId, travelerId });

    const res = await acceptBooking.run({
      data: { bookingId },
      auth: { uid: travelerId, token: {} },
    } as any);

    expect(res.success).toBe(true);
    expect(res.reservedWeightKg).toBe(4);

    const tripDoc = await db.collection("trips").doc(tripId).get();
    const data = tripDoc.data()!;
    expect(data.reservedCapacityKg).toBe(4);
    expect(data.totalCapacityKg).toBe(10);
    expect(data.availableCapacityKg).toBe(6);
    expect(data.availableCapacityKg + data.reservedCapacityKg).toBe(data.totalCapacityKg);
  });

  it("Test H — Legacy trip, one accepted booking: derives 4 kg reservation, rejects 7 kg acceptance", async () => {
    const tripId = "trip-legacy-one";
    const travelerId = "traveler-legacy-one";
    // Legacy trip: advertised 10 kg, no reservedCapacityKg metadata
    await seedTrip(tripId, { ownerId: travelerId, availableCapacityKg: 10 });

    // Existing pre-R03 accepted booking for 4 kg
    const histShipment = "shipment-hist-one";
    await seedShipment(histShipment, { weightKg: 4 });
    const histBooking = "booking-hist-one";
    await seedBooking(histBooking, { shipmentId: histShipment, tripId, travelerId, status: "accepted" });

    // New booking requesting 7 kg (4 kg + 7 kg = 11 kg > 10 kg)
    const newShipment = "shipment-new-oversub";
    await seedShipment(newShipment, { weightKg: 7 });
    const newBooking = "booking-new-oversub";
    await seedBooking(newBooking, { shipmentId: newShipment, tripId, travelerId });

    await expect(
      acceptBooking.run({
        data: { bookingId: newBooking },
        auth: { uid: travelerId, token: {} },
      } as any)
    ).rejects.toThrowError(/no longer has enough available capacity/i);

    // New booking requesting 5 kg (4 kg + 5 kg = 9 kg <= 10 kg) must succeed
    const validShipment = "shipment-new-valid";
    await seedShipment(validShipment, { weightKg: 5 });
    const validBooking = "booking-new-valid";
    await seedBooking(validBooking, { shipmentId: validShipment, tripId, travelerId });

    const res = await acceptBooking.run({
      data: { bookingId: validBooking },
      auth: { uid: travelerId, token: {} },
    } as any);

    expect(res.success).toBe(true);
    const tripDoc = await db.collection("trips").doc(tripId).get();
    const data = tripDoc.data()!;
    expect(data.reservedCapacityKg).toBe(9);
    expect(data.totalCapacityKg).toBe(10);
    expect(data.availableCapacityKg).toBe(1);
    expect(data.availableCapacityKg + data.reservedCapacityKg).toBe(data.totalCapacityKg);
  });

  it("Test I — Legacy trip, multiple accepted bookings: derives 7 kg reservation, allows 3 kg, rejects 4 kg", async () => {
    const tripId = "trip-legacy-multi";
    const travelerId = "traveler-legacy-multi";
    await seedTrip(tripId, { ownerId: travelerId, availableCapacityKg: 10 });

    // Historical commitment 1: 4 kg (status: in_transit)
    const histShip1 = "shipment-hist-multi-1";
    await seedShipment(histShip1, { weightKg: 4 });
    await seedBooking("booking-hist-multi-1", { shipmentId: histShip1, tripId, travelerId, status: "in_transit" });

    // Historical commitment 2: 3 kg (status: delivered)
    const histShip2 = "shipment-hist-multi-2";
    await seedShipment(histShip2, { weightKg: 3 });
    await seedBooking("booking-hist-multi-2", { shipmentId: histShip2, tripId, travelerId, status: "delivered" });

    // New 4 kg booking should fail (7 + 4 = 11 > 10)
    const failShipment = "shipment-fail-multi";
    await seedShipment(failShipment, { weightKg: 4 });
    await seedBooking("booking-fail-multi", { shipmentId: failShipment, tripId, travelerId });

    await expect(
      acceptBooking.run({
        data: { bookingId: "booking-fail-multi" },
        auth: { uid: travelerId, token: {} },
      } as any)
    ).rejects.toThrowError(/no longer has enough available capacity/i);

    // New 3 kg booking should succeed (7 + 3 = 10 == 10)
    const exactShipment = "shipment-exact-multi";
    await seedShipment(exactShipment, { weightKg: 3 });
    await seedBooking("booking-exact-multi", { shipmentId: exactShipment, tripId, travelerId });

    const res = await acceptBooking.run({
      data: { bookingId: "booking-exact-multi" },
      auth: { uid: travelerId, token: {} },
    } as any);

    expect(res.success).toBe(true);
    const tripDoc = await db.collection("trips").doc(tripId).get();
    const data = tripDoc.data()!;
    expect(data.reservedCapacityKg).toBe(10);
    expect(data.availableCapacityKg).toBe(0);
    expect(data.totalCapacityKg).toBe(10);
  });

  it("Test J — Over-capacity historical state: fails closed on future acceptance", async () => {
    const tripId = "trip-legacy-over";
    const travelerId = "traveler-legacy-over";
    await seedTrip(tripId, { ownerId: travelerId, availableCapacityKg: 8 });

    // Pre-R03 bad historical state: 10 kg committed on 8 kg trip
    const histShip = "shipment-overcap";
    await seedShipment(histShip, { weightKg: 10 });
    await seedBooking("booking-overcap", { shipmentId: histShip, tripId, travelerId, status: "accepted" });

    // Any new acceptance must fail closed
    const newShip = "shipment-overcap-new";
    await seedShipment(newShip, { weightKg: 1 });
    await seedBooking("booking-overcap-new", { shipmentId: newShip, tripId, travelerId });

    await expect(
      acceptBooking.run({
        data: { bookingId: "booking-overcap-new" },
        auth: { uid: travelerId, token: {} },
      } as any)
    ).rejects.toThrowError(/over-capacity conflict/i);
  });

  it("Test K — Reconciliation utility: historical shipment claim, conflicts, dry-run and rerun idempotency", async () => {
    const { LegacyReservationReconciler } = await import("../src/services/LegacyReservationReconciler.js");
    const reconciler = new LegacyReservationReconciler(db);

    const tripId = "trip-reconcile-test";
    const travelerId = "traveler-reconcile";
    await seedTrip(tripId, { ownerId: travelerId, availableCapacityKg: 15 });

    // Shipment 1: 5 kg, 1 accepted booking, missing activeBookingId
    const s1 = "shipment-reconcile-1";
    await seedShipment(s1, { weightKg: 5, activeBookingId: null, activeCarrierId: null });
    await seedBooking("booking-rec-1", { shipmentId: s1, tripId, travelerId, status: "accepted" });

    // Shipment 2: Contradiction — 2 accepted bookings for the same shipment!
    const s2 = "shipment-reconcile-conflict";
    await seedShipment(s2, { weightKg: 4, activeBookingId: null });
    await seedBooking("booking-rec-2a", { shipmentId: s2, tripId, travelerId, status: "accepted" });
    await seedBooking("booking-rec-2b", { shipmentId: s2, tripId: "trip-other", travelerId: "traveler-other", status: "in_transit" });

    // 1. Dry run
    const dryRunReport = await reconciler.reconcile({ dryRun: true });
    expect(dryRunReport.dryRun).toBe(true);
    expect(dryRunReport.plannedTripUpdates).toBeGreaterThanOrEqual(1);
    expect(dryRunReport.conflicts.some((c) => c.type === "duplicate_accepted_shipment" && c.entityId === s2)).toBe(true);

    // Verify dry run did NOT write to Firestore
    const tripBefore = await db.collection("trips").doc(tripId).get();
    expect(tripBefore.data()!.reservedCapacityKg).toBeUndefined();

    // 2. Write mode
    const writeReport = await reconciler.reconcile({ dryRun: false });
    expect(writeReport.dryRun).toBe(false);

    // Verify writes were committed
    const tripAfter = await db.collection("trips").doc(tripId).get();
    expect(tripAfter.data()!.reservedCapacityKg).toBeDefined();
    expect(tripAfter.data()!.totalCapacityKg).toBe(15);
    expect(tripAfter.data()!.availableCapacityKg + tripAfter.data()!.reservedCapacityKg).toBe(15);

    const s1Doc = await db.collection("shipments").doc(s1).get();
    expect(s1Doc.data()!.activeBookingId).toBe("booking-rec-1");
    expect(s1Doc.data()!.activeCarrierId).toBe(travelerId);

    // Conflict shipment s2 must NOT have been claimed automatically
    const s2Doc = await db.collection("shipments").doc(s2).get();
    expect(s2Doc.data()!.activeBookingId).toBeNull();

    // 3. Rerun idempotency: second run produces zero planned updates
    const rerunReport = await reconciler.reconcile({ dryRun: false });
    // All scanned trips that were updated now have reservedCapacityKg, so planned updates for them is 0
    expect(rerunReport.plannedShipmentUpdates).toBe(0);
  });
});
