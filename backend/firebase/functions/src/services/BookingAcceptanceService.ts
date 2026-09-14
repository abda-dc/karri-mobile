import type { Transaction } from "firebase-admin/firestore";
import admin from "firebase-admin";
import {
  ValidationError,
  PermissionDeniedError,
  ConflictError,
  FailedPreconditionError,
  NotFoundError,
} from "../errors/DomainErrors.js";

import { HandoffCoordinationService } from "./HandoffCoordinationService.js";
import { assertShipmentSafetyClear } from "./SafetyEnforcementService.js";
import type { BookingAgreementSnapshot } from "../types/SnapshotTypes.js";

export interface AcceptBookingInput {
  bookingId: string;
  location?: string | null;
  note?: string | null;
  idempotencyKey?: string | null;
}

export interface AcceptBookingResult {
  success: boolean;
  bookingId: string;
  alreadyAccepted: boolean;
  tripId: string;
  shipmentId: string;
  reservedWeightKg: number;
}

export class BookingAcceptanceService {
  private readonly handoffService: HandoffCoordinationService;

  constructor(
    private readonly db: admin.firestore.Firestore,
    handoffService?: HandoffCoordinationService,
  ) {
    this.handoffService = handoffService ?? new HandoffCoordinationService(db);
  }

  public async acceptBooking(
    transaction: Transaction,
    input: AcceptBookingInput,
    callerUid: string,
  ): Promise<AcceptBookingResult> {
    if (!input.bookingId || typeof input.bookingId !== "string" || input.bookingId.trim().length === 0 || input.bookingId.length > 128) {
      throw new ValidationError("Invalid bookingId.");
    }
    if (!callerUid || typeof callerUid !== "string" || callerUid.trim().length === 0 || callerUid.length > 128) {
      throw new ValidationError("Invalid callerUid.");
    }
    if (input.location !== undefined && input.location !== null && (typeof input.location !== "string" || input.location.length > 120)) {
      throw new ValidationError("Location must be a string under 120 characters.");
    }
    if (input.note !== undefined && input.note !== null && (typeof input.note !== "string" || input.note.length > 500)) {
      throw new ValidationError("Note must be a string under 500 characters.");
    }

    const bookingRef = this.db.collection("bookings").doc(input.bookingId);
    const bookingDoc = await transaction.get(bookingRef);

    if (!bookingDoc.exists) {
      throw new NotFoundError("Booking not found.");
    }

    const booking = bookingDoc.data()!;
    if (booking.travelerId !== callerUid) {
      throw new PermissionDeniedError("Only the assigned traveler can accept this booking.");
    }

    // Deterministic Idempotency: If this booking was already accepted by this traveler, return the existing result.
    if (booking.status === "accepted") {
      return {
        success: true,
        bookingId: input.bookingId,
        alreadyAccepted: true,
        tripId: booking.tripId,
        shipmentId: booking.shipmentId,
        reservedWeightKg: Number(booking.reservedWeightKg ?? 0),
      };
    }

    if (booking.status !== "pending") {
      throw new FailedPreconditionError(`Booking cannot transition from ${booking.status} to accepted.`);
    }

    // Validate referenced BookingRequest
    const bookingRequestRef = this.db.collection("bookingRequests").doc(booking.bookingRequestId);
    const bookingRequestDoc = await transaction.get(bookingRequestRef);
    if (!bookingRequestDoc.exists) {
      throw new NotFoundError("Booking request not found.");
    }

    const bookingRequest = bookingRequestDoc.data()!;
    if (bookingRequest.status !== "pending") {
      throw new FailedPreconditionError(`Booking request cannot transition from ${bookingRequest.status} to accepted.`);
    }

    // Validate referenced Shipment
    const shipmentRef = this.db.collection("shipments").doc(booking.shipmentId);
    const shipmentDoc = await transaction.get(shipmentRef);
    if (!shipmentDoc.exists) {
      throw new NotFoundError("Referenced shipment not found.");
    }

    const shipment = shipmentDoc.data()!;
    if (shipment.status !== "active") {
      throw new FailedPreconditionError("Referenced shipment is no longer active.");
    }

    // Invariant: Shipment must be clear of administrative holds and rejected/pending safety reviews
    await assertShipmentSafetyClear(transaction, this.db, booking.shipmentId);

    // Invariant 2: Single active carrier per shipment
    if (
      (shipment.activeBookingId && shipment.activeBookingId !== input.bookingId) ||
      (shipment.activeCarrierId && shipment.activeCarrierId !== callerUid)
    ) {
      throw new ConflictError("This shipment has already been accepted by another traveler.");
    }

    // Validate referenced Trip
    const tripRef = this.db.collection("trips").doc(booking.tripId);
    const tripDoc = await transaction.get(tripRef);
    if (!tripDoc.exists) {
      throw new NotFoundError("Referenced trip not found.");
    }

    const trip = tripDoc.data()!;
    if (trip.ownerId !== callerUid) {
      throw new PermissionDeniedError("Caller does not own the referenced trip.");
    }
    if (trip.status !== "active") {
      throw new FailedPreconditionError("Referenced trip is no longer active.");
    }

    // Determine trusted weights and capacities
    const shipmentWeight = Number(shipment.weightKg);
    if (!Number.isFinite(shipmentWeight) || shipmentWeight <= 0 || shipmentWeight > 100) {
      throw new ValidationError("Invalid shipment weight.");
    }

    const totalCapacity = Number(trip.totalCapacityKg ?? trip.availableCapacityKg);
    if (!Number.isFinite(totalCapacity) || totalCapacity <= 0 || totalCapacity > 100) {
      throw new ValidationError("Invalid trip capacity.");
    }

    let currentReservedCapacity: number;

    if (trip.reservedCapacityKg !== undefined) {
      currentReservedCapacity = Number(trip.reservedCapacityKg);
      if (!Number.isFinite(currentReservedCapacity) || currentReservedCapacity < 0) {
        throw new ValidationError("Invalid trip reserved capacity.");
      }
    } else {
      // Legacy compatibility: derive reserved capacity from existing active commitments on this trip
      const COMMITTED_STATUSES = ["accepted", "in_transit", "delivered", "completed"];
      const existingBookingsSnap = await transaction.get(
        this.db.collection("bookings").where("tripId", "==", booking.tripId)
      );

      let derivedWeight = 0;
      for (const bDoc of existingBookingsSnap.docs) {
        if (bDoc.id === input.bookingId) {
          continue; // Skip the booking currently being accepted
        }
        const bData = bDoc.data();
        if (COMMITTED_STATUSES.includes(bData.status)) {
          if (bData.reservedWeightKg !== undefined && Number.isFinite(Number(bData.reservedWeightKg))) {
            derivedWeight += Number(bData.reservedWeightKg);
          } else {
            // Need to read the associated shipment to determine weight
            const histShipmentRef = this.db.collection("shipments").doc(bData.shipmentId);
            const histShipmentDoc = await transaction.get(histShipmentRef);
            if (!histShipmentDoc.exists) {
              throw new FailedPreconditionError(
                "Historical booking references missing shipment. Operator reconciliation required."
              );
            }
            const sWeight = Number(histShipmentDoc.data()?.weightKg);
            if (!Number.isFinite(sWeight) || sWeight <= 0) {
              throw new FailedPreconditionError(
                "Historical booking references shipment with invalid weight. Operator reconciliation required."
              );
            }
            derivedWeight += sWeight;
          }
        }
      }

      derivedWeight = Math.round(derivedWeight * 100) / 100;

      // Invariant: Fail closed if historical commitments exceed advertised trip capacity
      if (derivedWeight > totalCapacity) {
        throw new FailedPreconditionError(
          "Historical commitments exceed advertised trip capacity (over-capacity conflict). Operator reconciliation required."
        );
      }

      currentReservedCapacity = derivedWeight;
    }

    const remainingCapacity = Math.round((totalCapacity - currentReservedCapacity) * 100) / 100;

    // Invariant 1: Capacity check
    if (shipmentWeight > remainingCapacity) {
      throw new ConflictError("This trip no longer has enough available capacity.");
    }

    // Read profiles, existing handoff secrets, and agreement snapshot before performing any writes
    const secretsRef = this.db.collection("bookingHandoffSecrets").doc(input.bookingId);
    const agreementRef = this.db.collection("bookingHandoffAgreements").doc(input.bookingId);
    const snapshotRef = this.db.collection("bookingAgreementSnapshots").doc(input.bookingId);
    const [senderProfileDoc, travelerProfileDoc, secretsDoc, snapshotDoc] = await Promise.all([
      transaction.get(this.db.collection("profiles").doc(booking.senderId)),
      transaction.get(this.db.collection("profiles").doc(callerUid)),
      transaction.get(secretsRef),
      transaction.get(snapshotRef),
    ]);

    // Invariant 3: All-or-nothing atomic writes
    const newReservedCapacity = Math.round((currentReservedCapacity + shipmentWeight) * 100) / 100;
    const newAvailableCapacity = Math.max(0, Math.round((totalCapacity - newReservedCapacity) * 100) / 100);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 1. Reserve trip capacity
    transaction.update(tripRef, {
      totalCapacityKg: totalCapacity,
      reservedCapacityKg: newReservedCapacity,
      availableCapacityKg: newAvailableCapacity,
      updatedAt: timestamp,
    });

    // 2. Claim shipment exclusivity
    transaction.update(shipmentRef, {
      activeBookingId: input.bookingId,
      activeCarrierId: callerUid,
      activeTripId: booking.tripId,
      updatedAt: timestamp,
    });

    // 3. Transition booking
    const existingHistory = Array.isArray(booking.statusHistory) ? booking.statusHistory : [];
    const nowTimestamp = admin.firestore.Timestamp.now();
    transaction.update(bookingRef, {
      status: "accepted",
      reservedWeightKg: shipmentWeight,
      statusHistory: [
        ...existingHistory,
        {
          status: "accepted",
          changedAt: nowTimestamp,
          changedBy: callerUid,
        },
      ],
      updatedAt: timestamp,
    });

    // 4. Transition booking request
    transaction.update(bookingRequestRef, {
      status: "accepted",
      updatedAt: timestamp,
    });

    // 5. Write lifecycle custody event
    const custodyEventRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__traveler_accepted`);
    transaction.set(custodyEventRef, {
      bookingId: input.bookingId,
      shipmentId: booking.shipmentId,
      eventType: "traveler_accepted",
      performedBy: callerUid,
      location: input.location?.trim() || null,
      note: input.note?.trim() || "Booking accepted by traveler.",
      metadata: {
        bookingStatus: "accepted",
        reservedWeightKg: shipmentWeight,
      },
      timestamp: timestamp,
    });

    // 6. Initialize handoff coordination if not already present
    if (!secretsDoc.exists) {
      const senderName = senderProfileDoc.data()?.displayName ?? "";
      const travelerName = travelerProfileDoc.data()?.displayName ?? "";
      const initialHandoff = this.handoffService.createInitialHandoffRecords(
        input.bookingId,
        booking.senderId,
        callerUid,
        senderName,
        travelerName,
      );
      transaction.set(secretsRef, initialHandoff.secrets);
      transaction.set(agreementRef, initialHandoff.agreement);
    }

    // 7. Write immutable accepted-shipment agreement snapshot
    if (!snapshotDoc.exists) {
      const snapshotRecord: BookingAgreementSnapshot = {
        bookingId: input.bookingId,
        shipmentId: booking.shipmentId,
        tripId: booking.tripId,
        senderId: booking.senderId,
        travelerId: callerUid,
        packageCategory: shipment.packageCategory,
        packageDescription: shipment.packageDescription,
        weightKg: shipmentWeight,
        originCountry: shipment.originCountry,
        originCity: shipment.originCity,
        destinationCountry: shipment.destinationCountry,
        destinationCity: shipment.destinationCity,
        deliveryWindow: shipment.deliveryWindow,
        rewardAmount: Number(shipment.rewardAmount),
        rewardCurrency: shipment.rewardCurrency,
        containsBattery: Boolean(shipment.containsBattery),
        batteryType: shipment.batteryType || "none",
        containsLiquid: Boolean(shipment.containsLiquid),
        containsFoodOrAgri: Boolean(shipment.containsFoodOrAgri),
        containsMedicine: Boolean(shipment.containsMedicine),
        customsDeclarationRequired: Boolean(shipment.customsDeclarationRequired),
        packageContentVersion: Number(shipment.packageContentVersion || 1),
        senderSafetyDeclaration: shipment.safetyDeclaration || null,
        snapshotVersion: 1,
        createdAt: timestamp,
      };
      transaction.set(snapshotRef, snapshotRecord);
    }

    return {
      success: true,
      bookingId: input.bookingId,
      alreadyAccepted: false,
      tripId: booking.tripId,
      shipmentId: booking.shipmentId,
      reservedWeightKg: shipmentWeight,
    };
  }
}
