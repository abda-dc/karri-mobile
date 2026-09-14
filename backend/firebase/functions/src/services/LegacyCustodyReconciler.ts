import admin from "firebase-admin";

export type CustodyAnomalyType =
  | "missing_event"
  | "orphan_event"
  | "duplicate_event"
  | "invalid_sequence"
  | "booking_mismatch"
  | "shipment_mismatch"
  | "event_type_mismatch";

export interface CustodyRecordAnomaly {
  readonly type: CustodyAnomalyType;
  readonly bookingId: string;
  readonly eventId?: string;
  readonly details: string;
}

export interface CustodyReconciliationReport {
  readonly dryRun: boolean;
  readonly bookingsScanned: number;
  readonly custodyEventsScanned: number;
  readonly consistentBookings: number;
  readonly anomalousBookings: number;
  readonly anomalies: ReadonlyArray<CustodyRecordAnomaly>;
}

export class LegacyCustodyReconciler {
  constructor(private readonly db: admin.firestore.Firestore) {}

  public async reconcile(options: { dryRun?: boolean } = {}): Promise<CustodyReconciliationReport> {
    // R05 Invariant: This tool is strictly a read-only audit / preflight tool.
    // Writes / in-place repairs are intentionally disabled in R05.
    const dryRun = true;

    const bookingsSnapshot = await this.db.collection("bookings").get();
    const custodyEventsSnapshot = await this.db.collection("custodyEvents").get();

    const bookingsScanned = bookingsSnapshot.size;
    const custodyEventsScanned = custodyEventsSnapshot.size;

    const anomalies: CustodyRecordAnomaly[] = [];

    // Map bookings by ID
    const bookingsMap = new Map<string, admin.firestore.DocumentData>();
    for (const doc of bookingsSnapshot.docs) {
      bookingsMap.set(doc.id, { id: doc.id, ...doc.data() });
    }

    // Group events by bookingId and perform per-event structural validation
    const eventsByBooking = new Map<string, admin.firestore.DocumentData[]>();
    for (const doc of custodyEventsSnapshot.docs) {
      const data: admin.firestore.DocumentData = { id: doc.id, ...doc.data() };
      const bookingId = data.bookingId;

      // Check deterministic document ID pattern: `${bookingId}__${eventType}`
      if (doc.id.includes("__")) {
        const [idPrefix, idSuffix] = doc.id.split("__");
        if (idPrefix && bookingId && idPrefix !== bookingId) {
          anomalies.push({
            type: "booking_mismatch",
            bookingId: bookingId ?? idPrefix,
            eventId: doc.id,
            details: `Event document ID prefix '${idPrefix}' does not match event payload bookingId '${bookingId}'.`,
          });
        }
        if (idSuffix && data.eventType && idSuffix !== data.eventType) {
          anomalies.push({
            type: "event_type_mismatch",
            bookingId: bookingId ?? idPrefix,
            eventId: doc.id,
            details: `Event document ID suffix '${idSuffix}' does not match event payload eventType '${data.eventType}'.`,
          });
        }
      }

      // Check orphan status
      if (!bookingId || !bookingsMap.has(bookingId)) {
        anomalies.push({
          type: "orphan_event",
          bookingId: bookingId ?? "unknown",
          eventId: doc.id,
          details: `Custody event references non-existent booking: ${bookingId ?? "null"}`,
        });
      } else {
        // Cross-check shipmentId against linked booking
        const linkedBooking = bookingsMap.get(bookingId)!;
        if (data.shipmentId && linkedBooking.shipmentId && data.shipmentId !== linkedBooking.shipmentId) {
          anomalies.push({
            type: "shipment_mismatch",
            bookingId,
            eventId: doc.id,
            details: `Event shipmentId '${data.shipmentId}' does not match booking shipmentId '${linkedBooking.shipmentId}'.`,
          });
        }
      }

      if (bookingId) {
        const list = eventsByBooking.get(bookingId) ?? [];
        list.push(data);
        eventsByBooking.set(bookingId, list);
      }
    }

    let consistentBookings = 0;
    let anomalousBookings = 0;

    for (const [bookingId, booking] of bookingsMap.entries()) {
      const events = eventsByBooking.get(bookingId) ?? [];
      const eventTypes = events.map((e) => e.eventType);

      let bookingHasAnomaly = false;

      // Check for duplicate event types
      const seenTypes = new Set<string>();
      for (const type of eventTypes) {
        if (seenTypes.has(type)) {
          anomalies.push({
            type: "duplicate_event",
            bookingId,
            details: `Duplicate custody event type found: ${type}`,
          });
          bookingHasAnomaly = true;
        }
        seenTypes.add(type);
      }

      const hasAccepted = seenTypes.has("traveler_accepted");
      const hasPickup = seenTypes.has("pickup_confirmed");
      const hasDeparture = seenTypes.has("airport_departure");
      const hasArrival = seenTypes.has("airport_arrival");
      const hasDelivery = seenTypes.has("delivery_confirmed");

      // Check sequence integrity
      if (hasDelivery && !hasPickup) {
        anomalies.push({
          type: "invalid_sequence",
          bookingId,
          details: "Delivery confirmed event exists without predecessor pickup confirmed event.",
        });
        bookingHasAnomaly = true;
      }
      if (hasPickup && !hasAccepted) {
        anomalies.push({
          type: "invalid_sequence",
          bookingId,
          details: "Pickup confirmed event exists without predecessor traveler accepted event.",
        });
        bookingHasAnomaly = true;
      }
      if (hasArrival && !hasDeparture) {
        anomalies.push({
          type: "invalid_sequence",
          bookingId,
          details: "Airport arrival event exists without predecessor airport departure event.",
        });
        bookingHasAnomaly = true;
      }
      if (hasDeparture && !hasPickup) {
        anomalies.push({
          type: "invalid_sequence",
          bookingId,
          details: "Airport departure event exists without predecessor pickup confirmed event.",
        });
        bookingHasAnomaly = true;
      }

      // Check lifecycle alignment
      const status = booking.status;
      if (["accepted", "in_transit", "delivered", "completed"].includes(status) && !hasAccepted) {
        anomalies.push({
          type: "missing_event",
          bookingId,
          details: `Booking status is '${status}' but traveler_accepted custody event is missing.`,
        });
        bookingHasAnomaly = true;
      }
      if (["in_transit", "delivered", "completed"].includes(status) && !hasPickup) {
        anomalies.push({
          type: "missing_event",
          bookingId,
          details: `Booking status is '${status}' but pickup_confirmed custody event is missing.`,
        });
        bookingHasAnomaly = true;
      }
      if (["delivered", "completed"].includes(status) && !hasDelivery) {
        anomalies.push({
          type: "missing_event",
          bookingId,
          details: `Booking status is '${status}' but delivery_confirmed custody event is missing.`,
        });
        bookingHasAnomaly = true;
      }

      // If this booking had any anomaly reported above
      const hasSpecificAnomaly = anomalies.some((a) => a.bookingId === bookingId);
      if (bookingHasAnomaly || hasSpecificAnomaly) {
        anomalousBookings++;
      } else {
        consistentBookings++;
      }
    }

    return {
      dryRun,
      bookingsScanned,
      custodyEventsScanned,
      consistentBookings,
      anomalousBookings,
      anomalies,
    };
  }
}
