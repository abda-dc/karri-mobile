import admin from "firebase-admin";
import type { Transaction } from "firebase-admin/firestore";
import {
  ValidationError,
  PermissionDeniedError,
  FailedPreconditionError,
  NotFoundError,
} from "../errors/DomainErrors.js";
import {
  BookingCancellationReasonCode,
  BookingDeclineReasonCode,
} from "../utils/reasonCodes.js";

export interface CancelBookingInput {
  readonly bookingId: string;
  readonly reasonCode?: string | null;
  readonly note?: string | null;
  readonly idempotencyKey?: string | null;
}

export interface CancelBookingResult {
  readonly success: boolean;
  readonly bookingId: string;
  readonly status: "cancelled";
  readonly cancelled: boolean;
  readonly idempotent: boolean;
  readonly capacityRestored: boolean;
  readonly shipmentReleased: boolean;
}

export interface DeclineBookingInput {
  readonly bookingId: string;
  readonly reasonCode?: string | null;
  readonly note?: string | null;
  readonly idempotencyKey?: string | null;
}

export interface DeclineBookingResult {
  readonly success: boolean;
  readonly bookingId: string;
  readonly status: "declined";
  readonly declined: boolean;
  readonly idempotent: boolean;
}

export class BookingCancellationService {
  constructor(private readonly db: admin.firestore.Firestore) {}

  public async cancelBooking(
    transaction: Transaction,
    input: CancelBookingInput,
    callerUid: string,
  ): Promise<CancelBookingResult> {
    if (
      !input.bookingId ||
      typeof input.bookingId !== "string" ||
      input.bookingId.trim().length === 0 ||
      input.bookingId.length > 128
    ) {
      throw new ValidationError("Invalid bookingId.");
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
      input.note !== undefined &&
      input.note !== null &&
      (typeof input.note !== "string" || input.note.length > 500)
    ) {
      throw new ValidationError("Note must be a string under 500 characters.");
    }

    if (input.reasonCode !== undefined && input.reasonCode !== null) {
      const allowedCodes = Object.values(BookingCancellationReasonCode) as string[];
      if (typeof input.reasonCode !== "string" || !allowedCodes.includes(input.reasonCode)) {
        throw new ValidationError(
          `Invalid reasonCode. Allowed cancellation reason codes are: ${allowedCodes.join(", ")}`,
        );
      }
    }

    const bookingRef = this.db.collection("bookings").doc(input.bookingId);
    const bookingDoc = await transaction.get(bookingRef);

    if (!bookingDoc.exists) {
      throw new NotFoundError("Booking not found.");
    }

    const booking = bookingDoc.data()!;

    // Invariant 8: Authorization based on authoritative Firestore ownership
    if (booking.senderId !== callerUid && booking.travelerId !== callerUid) {
      throw new PermissionDeniedError("Only booking participants can cancel this booking.");
    }

    // Invariant 4: Deterministic Idempotency on retry
    if (booking.status === "cancelled") {
      return {
        success: true,
        bookingId: input.bookingId,
        status: "cancelled",
        cancelled: true,
        idempotent: true,
        capacityRestored: false,
        shipmentReleased: false,
      };
    }

    // Invariant 2: Legal cancellation windows — strictly fail closed once physical custody begins
    if (["in_transit", "delivered", "completed"].includes(booking.status)) {
      throw new FailedPreconditionError(
        `Cancellation is not permitted once physical custody has begun (current status: '${booking.status}').`,
      );
    }

    if (["declined", "expired"].includes(booking.status)) {
      throw new FailedPreconditionError(
        `Booking is already in terminal status '${booking.status}'.`,
      );
    }

    // Fail closed if physical custody event already exists
    const pickupEventRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__pickup_confirmed`);
    const pickupEventDoc = await transaction.get(pickupEventRef);
    if (pickupEventDoc.exists) {
      throw new FailedPreconditionError(
        "Physical custody has already commenced. Normal cancellation is blocked.",
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowTimestamp = admin.firestore.Timestamp.now();

    // Invariant 7: Durable, auditable status history
    const existingHistory = Array.isArray(booking.statusHistory) ? booking.statusHistory : [];
    if (!Array.isArray(booking.statusHistory) || booking.statusHistory.length === 0) {
      throw new FailedPreconditionError(
        "Malformed booking status history. Operator reconciliation required.",
      );
    }

    // Case 1: Pending booking cancellation
    if (booking.status === "pending") {
      if (booking.senderId !== callerUid) {
        throw new PermissionDeniedError(
          "Only the booking sender can cancel a pending booking request. Travelers must decline.",
        );
      }

      const bookingRequestRef = this.db.collection("bookingRequests").doc(booking.bookingRequestId);
      const bookingRequestDoc = await transaction.get(bookingRequestRef);
      if (!bookingRequestDoc.exists) {
        throw new FailedPreconditionError(
          "Referenced booking request not found. Operator reconciliation required.",
        );
      }

      const historyReason =
        input.reasonCode || BookingCancellationReasonCode.SENDER_REQUESTED;

      transaction.update(bookingRef, {
        status: "cancelled",
        statusHistory: [
          ...existingHistory,
          {
            status: "cancelled",
            changedAt: nowTimestamp,
            changedBy: callerUid,
            reasonCode: historyReason,
          },
        ],
        updatedAt: timestamp,
      });

      transaction.update(bookingRequestRef, {
        status: "cancelled",
        updatedAt: timestamp,
      });

      return {
        success: true,
        bookingId: input.bookingId,
        status: "cancelled",
        cancelled: true,
        idempotent: false,
        capacityRestored: false,
        shipmentReleased: false,
      };
    }

    // Case 2: Accepted pre-pickup booking cancellation
    if (booking.status === "accepted") {
      // Invariant 6: Retain immutable agreement snapshot unchanged
      const snapshotRef = this.db.collection("bookingAgreementSnapshots").doc(input.bookingId);
      const snapshotDoc = await transaction.get(snapshotRef);
      if (!snapshotDoc.exists) {
        throw new FailedPreconditionError(
          "Accepted booking is missing its agreement snapshot. Operator reconciliation required.",
        );
      }

      // Validate referenced trip
      const tripRef = this.db.collection("trips").doc(booking.tripId);
      const tripDoc = await transaction.get(tripRef);
      if (!tripDoc.exists) {
        throw new FailedPreconditionError(
          "Referenced trip not found. Operator reconciliation required.",
        );
      }
      const trip = tripDoc.data()!;

      // Validate referenced shipment
      const shipmentRef = this.db.collection("shipments").doc(booking.shipmentId);
      const shipmentDoc = await transaction.get(shipmentRef);
      if (!shipmentDoc.exists) {
        throw new FailedPreconditionError(
          "Referenced shipment not found. Operator reconciliation required.",
        );
      }
      const shipment = shipmentDoc.data()!;

      // Validate referenced bookingRequest if present
      let bookingRequestRef: admin.firestore.DocumentReference | null = null;
      let bookingRequestExists = false;
      if (booking.bookingRequestId) {
        bookingRequestRef = this.db.collection("bookingRequests").doc(booking.bookingRequestId);
        const bookingRequestDoc = await transaction.get(bookingRequestRef);
        bookingRequestExists = bookingRequestDoc.exists;
      }

      // Invariant 3 & 4: Exact capacity restoration (bounded between 0 and totalCapacity)
      const reservedWeight = Number(booking.reservedWeightKg ?? shipment.weightKg ?? 0);
      if (!Number.isFinite(reservedWeight) || reservedWeight <= 0) {
        throw new FailedPreconditionError(
          "Invalid reserved weight on accepted booking. Operator reconciliation required.",
        );
      }

      const totalCapacity = Number(trip.totalCapacityKg ?? trip.availableCapacityKg);
      if (!Number.isFinite(totalCapacity) || totalCapacity <= 0) {
        throw new FailedPreconditionError(
          "Invalid trip capacity. Operator reconciliation required.",
        );
      }

      const currentReserved = Number(trip.reservedCapacityKg ?? 0);
      const newReservedCapacity = Math.max(0, Math.round((currentReserved - reservedWeight) * 100) / 100);
      const newAvailableCapacity = Math.min(
        totalCapacity,
        Math.round((totalCapacity - newReservedCapacity) * 100) / 100,
      );

      transaction.update(tripRef, {
        totalCapacityKg: totalCapacity,
        reservedCapacityKg: newReservedCapacity,
        availableCapacityKg: newAvailableCapacity,
        updatedAt: timestamp,
      });

      // Invariant 5: Safe shipment exclusivity release
      let shipmentReleased = false;
      if (shipment.activeBookingId === input.bookingId) {
        transaction.update(shipmentRef, {
          activeBookingId: null,
          activeCarrierId: null,
          activeTripId: null,
          updatedAt: timestamp,
        });
        shipmentReleased = true;
      }

      // Update booking and statusHistory
      const defaultReason =
        callerUid === booking.senderId
          ? BookingCancellationReasonCode.SENDER_REQUESTED
          : BookingCancellationReasonCode.TRAVELER_UNAVAILABLE;
      const historyReason = input.reasonCode || defaultReason;

      transaction.update(bookingRef, {
        status: "cancelled",
        statusHistory: [
          ...existingHistory,
          {
            status: "cancelled",
            changedAt: nowTimestamp,
            changedBy: callerUid,
            reasonCode: historyReason,
          },
        ],
        updatedAt: timestamp,
      });

      // Update booking request if present
      if (bookingRequestRef && bookingRequestExists) {
        transaction.update(bookingRequestRef, {
          status: "cancelled",
          updatedAt: timestamp,
        });
      }

      return {
        success: true,
        bookingId: input.bookingId,
        status: "cancelled",
        cancelled: true,
        idempotent: false,
        capacityRestored: true,
        shipmentReleased,
      };
    }

    throw new FailedPreconditionError(
      `Cannot cancel booking in status '${booking.status}'.`,
    );
  }

  public async declineBooking(
    transaction: Transaction,
    input: DeclineBookingInput,
    callerUid: string,
  ): Promise<DeclineBookingResult> {
    if (
      !input.bookingId ||
      typeof input.bookingId !== "string" ||
      input.bookingId.trim().length === 0 ||
      input.bookingId.length > 128
    ) {
      throw new ValidationError("Invalid bookingId.");
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
      input.note !== undefined &&
      input.note !== null &&
      (typeof input.note !== "string" || input.note.length > 500)
    ) {
      throw new ValidationError("Note must be a string under 500 characters.");
    }

    if (input.reasonCode !== undefined && input.reasonCode !== null) {
      const allowedCodes = Object.values(BookingDeclineReasonCode) as string[];
      if (typeof input.reasonCode !== "string" || !allowedCodes.includes(input.reasonCode)) {
        throw new ValidationError(
          `Invalid reasonCode. Allowed decline reason codes are: ${allowedCodes.join(", ")}`,
        );
      }
    }

    const bookingRef = this.db.collection("bookings").doc(input.bookingId);
    const bookingDoc = await transaction.get(bookingRef);

    if (!bookingDoc.exists) {
      throw new NotFoundError("Booking not found.");
    }

    const booking = bookingDoc.data()!;

    // Only assigned traveler can decline
    if (booking.travelerId !== callerUid) {
      throw new PermissionDeniedError("Only the assigned traveler can decline this booking request.");
    }

    // Idempotency: If already declined, return idempotent success
    if (booking.status === "declined") {
      return {
        success: true,
        bookingId: input.bookingId,
        status: "declined",
        declined: true,
        idempotent: true,
      };
    }

    if (booking.status !== "pending") {
      throw new FailedPreconditionError(
        `Booking cannot transition from ${booking.status} to declined.`,
      );
    }

    const bookingRequestRef = this.db.collection("bookingRequests").doc(booking.bookingRequestId);
    const bookingRequestDoc = await transaction.get(bookingRequestRef);
    if (!bookingRequestDoc.exists) {
      throw new FailedPreconditionError(
        "Referenced booking request not found. Operator reconciliation required.",
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowTimestamp = admin.firestore.Timestamp.now();

    const existingHistory = Array.isArray(booking.statusHistory) ? booking.statusHistory : [];
    if (!Array.isArray(booking.statusHistory) || booking.statusHistory.length === 0) {
      throw new FailedPreconditionError(
        "Malformed booking status history. Operator reconciliation required.",
      );
    }

    const historyReason = input.reasonCode || BookingDeclineReasonCode.OTHER;

    transaction.update(bookingRef, {
      status: "declined",
      statusHistory: [
        ...existingHistory,
        {
          status: "declined",
          changedAt: nowTimestamp,
          changedBy: callerUid,
          reasonCode: historyReason,
        },
      ],
      updatedAt: timestamp,
    });

    transaction.update(bookingRequestRef, {
      status: "declined",
      updatedAt: timestamp,
    });

    return {
      success: true,
      bookingId: input.bookingId,
      status: "declined",
      declined: true,
      idempotent: false,
    };
  }
}
