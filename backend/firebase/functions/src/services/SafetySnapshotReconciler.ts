import type admin from "firebase-admin";

export type SafetySnapshotAnomalyType =
  | "missing_snapshot"
  | "malformed_snapshot"
  | "snapshot_mismatch"
  | "active_hold_on_accepted_booking"
  | "blocking_review_on_accepted_booking";

export interface SafetySnapshotAnomaly {
  readonly type: SafetySnapshotAnomalyType;
  readonly bookingId: string;
  readonly shipmentId?: string;
  readonly details: string;
}

export interface SafetySnapshotReconciliationReport {
  readonly dryRun: boolean;
  readonly bookingsScanned: number;
  readonly snapshotsScanned: number;
  readonly holdsScanned: number;
  readonly reviewsScanned: number;
  readonly consistentBookings: number;
  readonly anomalousBookings: number;
  readonly anomalies: ReadonlyArray<SafetySnapshotAnomaly>;
}

export class SafetySnapshotReconciler {
  private static readonly COMMITTED_STATUSES = ["accepted", "in_transit", "delivered", "completed"];

  constructor(private readonly db: admin.firestore.Firestore) {}

  public async reconcile(options: { dryRun?: boolean } = {}): Promise<SafetySnapshotReconciliationReport> {
    // R06 Invariant: Strictly READ-ONLY audit tool. No writes committed.
    const dryRun = true;

    const [bookingsSnap, snapshotsSnap, holdsSnap, reviewsSnap] = await Promise.all([
      this.db.collection("bookings").get(),
      this.db.collection("bookingAgreementSnapshots").get(),
      this.db.collection("administrativeHolds").get(),
      this.db.collection("shipmentSafetyReviews").get(),
    ]);

    const bookingsScanned = bookingsSnap.size;
    const snapshotsScanned = snapshotsSnap.size;
    const holdsScanned = holdsSnap.size;
    const reviewsScanned = reviewsSnap.size;

    // Index snapshots by bookingId
    const snapshotsMap = new Map<string, admin.firestore.DocumentData>();
    for (const doc of snapshotsSnap.docs) {
      snapshotsMap.set(doc.id, doc.data());
    }

    // Index active holds by shipmentId
    const activeHoldsByShipment = new Map<string, admin.firestore.DocumentData[]>();
    for (const doc of holdsSnap.docs) {
      const data = doc.data();
      if (data.status === "active" && data.shipmentId) {
        const list = activeHoldsByShipment.get(data.shipmentId) ?? [];
        list.push({ id: doc.id, ...data });
        activeHoldsByShipment.set(data.shipmentId, list);
      }
    }

    // Index safety reviews by shipmentId
    const reviewsByShipment = new Map<string, admin.firestore.DocumentData[]>();
    for (const doc of reviewsSnap.docs) {
      const data = doc.data();
      if (data.shipmentId) {
        const list = reviewsByShipment.get(data.shipmentId) ?? [];
        list.push({ id: doc.id, ...data });
        reviewsByShipment.set(data.shipmentId, list);
      }
    }

    const anomalies: SafetySnapshotAnomaly[] = [];
    const anomalousBookingIds = new Set<string>();

    for (const bDoc of bookingsSnap.docs) {
      const booking = bDoc.data();
      const bookingId = bDoc.id;

      if (!SafetySnapshotReconciler.COMMITTED_STATUSES.includes(booking.status)) {
        // Pending, declined, cancelled, expired bookings do not require an accepted agreement snapshot
        continue;
      }

      const shipmentId = booking.shipmentId;
      const snapshot = snapshotsMap.get(bookingId);

      // 1. Missing snapshot check
      if (!snapshot) {
        anomalies.push({
          type: "missing_snapshot",
          bookingId,
          shipmentId,
          details: `Booking is '${booking.status}' but lacks an authoritative agreement snapshot in bookingAgreementSnapshots.`,
        });
        anomalousBookingIds.add(bookingId);
      } else {
        // 2. Malformed snapshot check
        const requiredFields = [
          "bookingId",
          "shipmentId",
          "tripId",
          "senderId",
          "travelerId",
          "weightKg",
          "packageCategory",
          "packageDescription",
          "packageContentVersion",
        ];
        const missingFields = requiredFields.filter((f) => snapshot[f] === undefined || snapshot[f] === null);
        if (missingFields.length > 0) {
          anomalies.push({
            type: "malformed_snapshot",
            bookingId,
            shipmentId,
            details: `Snapshot is missing required fields: ${missingFields.join(", ")}.`,
          });
          anomalousBookingIds.add(bookingId);
        }

        // 3. Snapshot cross-validation against booking
        if (snapshot.bookingId && snapshot.bookingId !== bookingId) {
          anomalies.push({
            type: "snapshot_mismatch",
            bookingId,
            shipmentId,
            details: `Snapshot bookingId '${snapshot.bookingId}' does not match document ID '${bookingId}'.`,
          });
          anomalousBookingIds.add(bookingId);
        }
        if (shipmentId && snapshot.shipmentId && snapshot.shipmentId !== shipmentId) {
          anomalies.push({
            type: "snapshot_mismatch",
            bookingId,
            shipmentId,
            details: `Snapshot shipmentId '${snapshot.shipmentId}' does not match booking shipmentId '${shipmentId}'.`,
          });
          anomalousBookingIds.add(bookingId);
        }
        if (booking.reservedWeightKg !== undefined && snapshot.weightKg !== undefined) {
          if (Math.abs(Number(booking.reservedWeightKg) - Number(snapshot.weightKg)) > 0.001) {
            anomalies.push({
              type: "snapshot_mismatch",
              bookingId,
              shipmentId,
              details: `Snapshot weight (${snapshot.weightKg} kg) differs from booking reserved weight (${booking.reservedWeightKg} kg).`,
            });
            anomalousBookingIds.add(bookingId);
          }
        }
      }

      // 4. Check for active administrative holds on active/in_transit bookings
      if (["accepted", "in_transit"].includes(booking.status) && shipmentId) {
        const activeHolds = activeHoldsByShipment.get(shipmentId);
        if (activeHolds && activeHolds.length > 0) {
          for (const hold of activeHolds) {
            anomalies.push({
              type: "active_hold_on_accepted_booking",
              bookingId,
              shipmentId,
              details: `Active administrative hold '${hold.id}' exists on shipment for booking in '${booking.status}' state (reason: ${hold.reasonCode || "unspecified"}).`,
            });
            anomalousBookingIds.add(bookingId);
          }
        }
      }

      // 5. Check for rejected or unresolved safety reviews on active/in_transit bookings
      if (["accepted", "in_transit"].includes(booking.status) && shipmentId) {
        const reviews = reviewsByShipment.get(shipmentId);
        if (reviews && reviews.length > 0) {
          const rejected = reviews.find((r) => r.decision === "rejected");
          if (rejected) {
            anomalies.push({
              type: "blocking_review_on_accepted_booking",
              bookingId,
              shipmentId,
              details: `Rejected safety review '${rejected.id}' exists on shipment for booking in '${booking.status}' state.`,
            });
            anomalousBookingIds.add(bookingId);
          } else {
            const needsInfo = reviews.find((r) => r.decision === "needs_more_information");
            const approved = reviews.find((r) => r.decision === "approved");
            if (needsInfo && !approved) {
              anomalies.push({
                type: "blocking_review_on_accepted_booking",
                bookingId,
                shipmentId,
                details: `Unresolved safety review '${needsInfo.id}' requires additional info on shipment for booking in '${booking.status}' state.`,
              });
              anomalousBookingIds.add(bookingId);
            }
          }
        }
      }
    }

    const anomalousBookings = anomalousBookingIds.size;
    const consistentBookings = Math.max(0, bookingsScanned - anomalousBookings);

    return {
      dryRun,
      bookingsScanned,
      snapshotsScanned,
      holdsScanned,
      reviewsScanned,
      consistentBookings,
      anomalousBookings,
      anomalies,
    };
  }
}
