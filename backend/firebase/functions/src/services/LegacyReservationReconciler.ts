import admin from "firebase-admin";

export interface ReconciliationConflict {
  readonly type: "over_capacity" | "missing_shipment" | "invalid_weight" | "duplicate_accepted_shipment";
  readonly entityId: string;
  readonly reason: string;
}

export interface PlannedTripUpdate {
  readonly tripId: string;
  readonly totalCapacityKg: number;
  readonly reservedCapacityKg: number;
  readonly availableCapacityKg: number;
}

export interface PlannedShipmentUpdate {
  readonly shipmentId: string;
  readonly activeBookingId: string;
  readonly activeCarrierId: string;
  readonly activeTripId: string;
}

export interface ReconciliationReport {
  readonly dryRun: boolean;
  readonly tripsScanned: number;
  readonly tripsMissingMetadata: number;
  readonly tripsWithHistoricalCommitments: number;
  readonly plannedTripUpdates: number;
  readonly shipmentsScanned: number;
  readonly shipmentsNeedingClaims: number;
  readonly plannedShipmentUpdates: number;
  readonly conflicts: ReadonlyArray<ReconciliationConflict>;
}

export class LegacyReservationReconciler {
  private static readonly COMMITTED_STATUSES = ["accepted", "in_transit", "delivered", "completed"];

  constructor(private readonly db: admin.firestore.Firestore) {}

  async reconcile(options: { dryRun?: boolean } = {}): Promise<ReconciliationReport> {
    const dryRun = options.dryRun ?? true;

    const tripsSnapshot = await this.db.collection("trips").get();
    const shipmentsSnapshot = await this.db.collection("shipments").get();
    const bookingsSnapshot = await this.db.collection("bookings").get();

    const tripsScanned = tripsSnapshot.size;
    const shipmentsScanned = shipmentsSnapshot.size;

    const conflicts: ReconciliationConflict[] = [];
    const plannedTripUpdates: PlannedTripUpdate[] = [];
    const plannedShipmentUpdates: PlannedShipmentUpdate[] = [];

    let tripsMissingMetadata = 0;
    let tripsWithHistoricalCommitments = 0;

    // Index bookings by tripId and by shipmentId
    const bookingsByTrip = new Map<string, admin.firestore.DocumentData[]>();
    const bookingsByShipment = new Map<string, admin.firestore.DocumentData[]>();

    for (const doc of bookingsSnapshot.docs) {
      const data: admin.firestore.DocumentData = { id: doc.id, ...doc.data() };
      if (data.tripId) {
        const list = bookingsByTrip.get(data.tripId) ?? [];
        list.push(data);
        bookingsByTrip.set(data.tripId, list);
      }
      if (data.shipmentId) {
        const list = bookingsByShipment.get(data.shipmentId) ?? [];
        list.push(data);
        bookingsByShipment.set(data.shipmentId, list);
      }
    }

    // Index shipments by ID for fast lookup
    const shipmentsMap = new Map<string, admin.firestore.DocumentData>();
    for (const doc of shipmentsSnapshot.docs) {
      shipmentsMap.set(doc.id, { id: doc.id, ...doc.data() });
    }

    // 1. Process Trips
    for (const tripDoc of tripsSnapshot.docs) {
      const trip = tripDoc.data();
      const isMissingMetadata = trip.reservedCapacityKg === undefined;

      if (!isMissingMetadata) {
        // Trip is already modernized with R03 metadata
        continue;
      }

      tripsMissingMetadata++;

      const tripBookings = bookingsByTrip.get(tripDoc.id) ?? [];
      const committedBookings = tripBookings.filter((b) =>
        LegacyReservationReconciler.COMMITTED_STATUSES.includes(b.status)
      );

      const totalCapacity = Number(trip.totalCapacityKg ?? trip.availableCapacityKg);
      if (!Number.isFinite(totalCapacity) || totalCapacity <= 0) {
        conflicts.push({
          type: "invalid_weight",
          entityId: tripDoc.id,
          reason: `Trip ${tripDoc.id} has invalid capacity: ${trip.totalCapacityKg ?? trip.availableCapacityKg}`,
        });
        continue;
      }

      if (committedBookings.length > 0) {
        tripsWithHistoricalCommitments++;
      }

      let derivedReservedWeight = 0;
      let hasTripError = false;

      for (const booking of committedBookings) {
        if (booking.reservedWeightKg !== undefined && Number.isFinite(Number(booking.reservedWeightKg))) {
          derivedReservedWeight += Number(booking.reservedWeightKg);
        } else {
          const shipment = shipmentsMap.get(booking.shipmentId);
          if (!shipment) {
            conflicts.push({
              type: "missing_shipment",
              entityId: booking.id,
              reason: `Booking ${booking.id} on trip ${tripDoc.id} references missing shipment ${booking.shipmentId}`,
            });
            hasTripError = true;
            break;
          }
          const sWeight = Number(shipment.weightKg);
          if (!Number.isFinite(sWeight) || sWeight <= 0) {
            conflicts.push({
              type: "invalid_weight",
              entityId: booking.shipmentId,
              reason: `Shipment ${booking.shipmentId} has invalid weight: ${shipment.weightKg}`,
            });
            hasTripError = true;
            break;
          }
          derivedReservedWeight += sWeight;
        }
      }

      if (hasTripError) {
        continue;
      }

      derivedReservedWeight = Math.round(derivedReservedWeight * 100) / 100;

      if (derivedReservedWeight > totalCapacity) {
        conflicts.push({
          type: "over_capacity",
          entityId: tripDoc.id,
          reason: `Trip ${tripDoc.id} historical commitments (${derivedReservedWeight} kg) exceed capacity (${totalCapacity} kg)`,
        });
        continue;
      }

      const availableCapacity = Math.max(0, Math.round((totalCapacity - derivedReservedWeight) * 100) / 100);

      plannedTripUpdates.push({
        tripId: tripDoc.id,
        totalCapacityKg: totalCapacity,
        reservedCapacityKg: derivedReservedWeight,
        availableCapacityKg: availableCapacity,
      });
    }

    // 2. Process Shipments
    let shipmentsNeedingClaims = 0;
    for (const [shipmentId, shipment] of shipmentsMap.entries()) {
      const sBookings = bookingsByShipment.get(shipmentId) ?? [];
      const committedBookings = sBookings.filter((b) =>
        LegacyReservationReconciler.COMMITTED_STATUSES.includes(b.status)
      );

      if (committedBookings.length === 0) {
        continue;
      }

      if (committedBookings.length > 1) {
        conflicts.push({
          type: "duplicate_accepted_shipment",
          entityId: shipmentId,
          reason: `Shipment ${shipmentId} has multiple accepted bookings: ${committedBookings.map((b) => b.id).join(", ")}`,
        });
        continue;
      }

      const winnerBooking = committedBookings[0];
      if (!shipment.activeBookingId) {
        shipmentsNeedingClaims++;
        plannedShipmentUpdates.push({
          shipmentId,
          activeBookingId: winnerBooking.id,
          activeCarrierId: winnerBooking.travelerId,
          activeTripId: winnerBooking.tripId,
        });
      }
    }

    // 3. Execute writes if NOT dry-run
    if (!dryRun) {
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      let operationsInBatch = 0;
      let batch = this.db.batch();

      const commitAndResetIfNeeded = async () => {
        if (operationsInBatch >= 400) {
          await batch.commit();
          batch = this.db.batch();
          operationsInBatch = 0;
        }
      };

      for (const update of plannedTripUpdates) {
        const tripRef = this.db.collection("trips").doc(update.tripId);
        batch.update(tripRef, {
          totalCapacityKg: update.totalCapacityKg,
          reservedCapacityKg: update.reservedCapacityKg,
          availableCapacityKg: update.availableCapacityKg,
          updatedAt: timestamp,
        });
        operationsInBatch++;
        await commitAndResetIfNeeded();
      }

      for (const update of plannedShipmentUpdates) {
        const shipmentRef = this.db.collection("shipments").doc(update.shipmentId);
        batch.update(shipmentRef, {
          activeBookingId: update.activeBookingId,
          activeCarrierId: update.activeCarrierId,
          activeTripId: update.activeTripId,
          updatedAt: timestamp,
        });
        operationsInBatch++;
        await commitAndResetIfNeeded();
      }

      if (operationsInBatch > 0) {
        await batch.commit();
      }
    }

    return {
      dryRun,
      tripsScanned,
      tripsMissingMetadata,
      tripsWithHistoricalCommitments,
      plannedTripUpdates: plannedTripUpdates.length,
      shipmentsScanned,
      shipmentsNeedingClaims,
      plannedShipmentUpdates: plannedShipmentUpdates.length,
      conflicts,
    };
  }
}
