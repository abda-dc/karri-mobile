import admin from "firebase-admin";
import type { Transaction } from "firebase-admin/firestore";
import {
  ValidationError,
  PermissionDeniedError,
  ConflictError,
  FailedPreconditionError,
  NotFoundError,
} from "../errors/DomainErrors.js";
import { assertShipmentSafetyClear } from "./SafetyEnforcementService.js";

export interface RequestBookingInput {
  readonly shipmentId: string;
  readonly tripId: string;
  readonly message?: string | null;
  readonly operationId?: string | null;
}

export interface RequestBookingResult {
  readonly success: boolean;
  readonly bookingId: string;
  readonly bookingRequestId: string;
  readonly status: "pending" | "accepted" | "in_transit" | "delivered";
  readonly alreadyExisted: boolean;
  readonly rebooked: boolean;
  readonly tripId: string;
  readonly shipmentId: string;
}

const ACTIVE_BOOKING_STATUSES = new Set([
  "pending",
  "accepted",
  "in_transit",
  "delivered",
]);

export class BookingCreationService {
  constructor(private readonly db: admin.firestore.Firestore) {}

  public async requestBooking(
    transaction: Transaction,
    input: RequestBookingInput,
    callerUid: string,
  ): Promise<RequestBookingResult> {
    if (
      !input.shipmentId ||
      typeof input.shipmentId !== "string" ||
      input.shipmentId.trim().length === 0 ||
      input.shipmentId.length > 128
    ) {
      throw new ValidationError("Invalid shipmentId.");
    }

    if (
      !input.tripId ||
      typeof input.tripId !== "string" ||
      input.tripId.trim().length === 0 ||
      input.tripId.length > 128
    ) {
      throw new ValidationError("Invalid tripId.");
    }

    if (
      !callerUid ||
      typeof callerUid !== "string" ||
      callerUid.trim().length === 0 ||
      callerUid.length > 128
    ) {
      throw new ValidationError("Invalid callerUid.");
    }

    if (
      input.message !== undefined &&
      input.message !== null &&
      (typeof input.message !== "string" || input.message.length > 500)
    ) {
      throw new ValidationError("Message must be a string under 500 characters.");
    }

    if (
      input.operationId !== undefined &&
      input.operationId !== null &&
      (typeof input.operationId !== "string" ||
        input.operationId.trim().length === 0 ||
        input.operationId.length > 256)
    ) {
      throw new ValidationError("Invalid operationId.");
    }

    // 1. Fetch Shipment
    const shipmentRef = this.db.collection("shipments").doc(input.shipmentId);
    const shipmentDoc = await transaction.get(shipmentRef);

    if (!shipmentDoc.exists) {
      throw new NotFoundError("Shipment was not found.");
    }

    const shipment = shipmentDoc.data()!;
    if (shipment.ownerId !== callerUid) {
      throw new PermissionDeniedError("Only the shipment owner can request a booking.");
    }

    if (shipment.status !== "active") {
      throw new FailedPreconditionError("Shipment listing is not active.");
    }

    // 2. Fetch Trip
    const tripRef = this.db.collection("trips").doc(input.tripId);
    const tripDoc = await transaction.get(tripRef);

    if (!tripDoc.exists) {
      throw new NotFoundError("Trip was not found.");
    }

    const trip = tripDoc.data()!;
    if (trip.ownerId === callerUid) {
      throw new ValidationError("A sender cannot request a booking from the same account.");
    }

    if (trip.status !== "active") {
      throw new FailedPreconditionError("Trip listing is not active.");
    }

    // 3. Validate Corridor Match
    const normalize = (val: unknown) => (typeof val === "string" ? val.trim().toLowerCase() : "");
    if (
      normalize(shipment.originCountry) !== normalize(trip.originCountry) ||
      normalize(shipment.originCity) !== normalize(trip.originCity) ||
      normalize(shipment.destinationCountry) !== normalize(trip.destinationCountry) ||
      normalize(shipment.destinationCity) !== normalize(trip.destinationCity)
    ) {
      throw new ValidationError("Shipment and trip corridors must match.");
    }

    // 4. Validate Capacity
    const weight = Number(shipment.weightKg ?? 0);
    const capacity = Number(trip.availableCapacityKg ?? 0);
    if (weight > capacity) {
      throw new FailedPreconditionError("The trip does not have enough available capacity.");
    }

    // 5. Assert Safety Clearance
    await assertShipmentSafetyClear(transaction, this.db, input.shipmentId);

    // 6. Check existing bookings for this shipment
    const existingBookingsQuery = await transaction.get(
      this.db.collection("bookings").where("shipmentId", "==", input.shipmentId),
    );

    const existingDocs = existingBookingsQuery.docs;
    const activeBookingDoc = existingDocs.find((d) =>
      ACTIVE_BOOKING_STATUSES.has(d.data().status),
    );

    if (activeBookingDoc) {
      const activeData = activeBookingDoc.data();
      // If the active booking matches the SAME trip and SAME sender: idempotent resolution
      if (activeData.tripId === input.tripId && activeData.senderId === callerUid) {
        if (input.operationId && activeData.operationId && activeData.operationId === input.operationId.trim()) {
          const existingMsg = (activeData.message ?? "").trim().slice(0, 500);
          const incomingMsg = (input.message ?? "").trim().slice(0, 500);
          if (existingMsg !== incomingMsg) {
            throw new ConflictError("Operation ID already exists with a different request payload.");
          }
        }
        return {
          success: true,
          bookingId: activeBookingDoc.id,
          bookingRequestId: activeData.bookingRequestId,
          status: activeData.status,
          alreadyExisted: true,
          rebooked: false,
          tripId: input.tripId,
          shipmentId: input.shipmentId,
        };
      }

      // If active on a DIFFERENT trip: conflict
      throw new ConflictError("This shipment already has an active booking.");
    }

    // Check if shipment had a completed booking
    const completedBookingDoc = existingDocs.find((d) => d.data().status === "completed");
    if (completedBookingDoc) {
      throw new FailedPreconditionError("A completed shipment cannot be rebooked.");
    }

    // Check prior attempts for this specific trip
    const priorTripBookings = existingDocs.filter(
      (d) => d.data().tripId === input.tripId,
    );
    const isRebooking = priorTripBookings.length > 0;

    // Check if an operationId was provided and if a booking with that ID already exists
    if (input.operationId) {
      const opTrimmed = input.operationId.trim();
      const opQuery = await transaction.get(
        this.db
          .collection("bookings")
          .where("senderId", "==", callerUid)
          .where("operationId", "==", opTrimmed),
      );
      if (!opQuery.empty) {
        const opDoc = opQuery.docs[0];
        const opData = opDoc.data();
        const existingMsg = (opData.message ?? "").trim().slice(0, 500);
        const incomingMsg = (input.message ?? "").trim().slice(0, 500);
        if (
          opData.shipmentId !== input.shipmentId ||
          opData.tripId !== input.tripId ||
          existingMsg !== incomingMsg
        ) {
          throw new ConflictError("Operation ID already exists with a different request payload.");
        }
        return {
          success: true,
          bookingId: opDoc.id,
          bookingRequestId: opData.bookingRequestId,
          status: opData.status,
          alreadyExisted: true,
          rebooked: false,
          tripId: input.tripId,
          shipmentId: input.shipmentId,
        };
      }
    }

    let bookingId: string;
    if (input.operationId) {
      bookingId = `booking__${input.shipmentId}__${input.tripId}__${input.operationId.trim()}`;
    } else if (isRebooking) {
      bookingId = `booking__${input.shipmentId}__${input.tripId}__attempt_${priorTripBookings.length + 1}`;
    } else {
      bookingId = `booking__${input.shipmentId}__${input.tripId}`;
    }

    const bookingRef = this.db.collection("bookings").doc(bookingId);
    const existingDoc = await transaction.get(bookingRef);
    if (existingDoc.exists) {
      const data = existingDoc.data()!;
      if (data.senderId === callerUid) {
        const existingMsg = (data.message ?? "").trim().slice(0, 500);
        const incomingMsg = (input.message ?? "").trim().slice(0, 500);
        if (
          data.shipmentId !== input.shipmentId ||
          data.tripId !== input.tripId ||
          existingMsg !== incomingMsg
        ) {
          throw new ConflictError("Operation ID already exists with a different request payload.");
        }
        return {
          success: true,
          bookingId: existingDoc.id,
          bookingRequestId: data.bookingRequestId,
          status: data.status,
          alreadyExisted: true,
          rebooked: isRebooking,
          tripId: input.tripId,
          shipmentId: input.shipmentId,
        };
      }
    }

    const bookingRequestId = `request__${bookingId}`;
    const bookingRequestRef = this.db.collection("bookingRequests").doc(bookingRequestId);
    const custodyEventRef = this.db.collection("custodyEvents").doc(`${bookingId}__shipment_created`);

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowTimestamp = admin.firestore.Timestamp.now();

    // Atomic Writes:
    // 1. Create booking
    transaction.set(bookingRef, {
      bookingRequestId,
      operationId: input.operationId?.trim() ?? null,
      shipmentId: input.shipmentId,
      tripId: input.tripId,
      senderId: callerUid,
      travelerId: trip.ownerId,
      message: (input.message ?? "").trim().slice(0, 500),
      status: "pending",
      statusHistory: [
        {
          status: "pending",
          changedAt: nowTimestamp,
          changedBy: callerUid,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // 2. Create booking request
    transaction.set(bookingRequestRef, {
      bookingId,
      operationId: input.operationId?.trim() ?? null,
      shipmentId: input.shipmentId,
      tripId: input.tripId,
      senderId: callerUid,
      travelerId: trip.ownerId,
      message: (input.message ?? "").trim().slice(0, 500),
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // 3. Create initial custody event
    transaction.set(custodyEventRef, {
      bookingId,
      shipmentId: input.shipmentId,
      tripId: input.tripId,
      eventType: "shipment_created",
      performedBy: callerUid,
      fromPartyId: callerUid,
      fromPartyRole: "sender",
      toPartyId: null,
      toPartyRole: null,
      location: null,
      note: "Booking request created for this shipment.",
      sequence: 1,
      previousEventId: null,
      metadata: {
        bookingStatus: "pending",
      },
      timestamp,
    });

    return {
      success: true,
      bookingId,
      bookingRequestId,
      status: "pending",
      alreadyExisted: false,
      rebooked: isRebooking,
      tripId: input.tripId,
      shipmentId: input.shipmentId,
    };
  }
}
