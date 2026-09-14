import admin from "firebase-admin";
import type { Transaction } from "firebase-admin/firestore";
import {
  ValidationError,
  PermissionDeniedError,
  FailedPreconditionError,
  NotFoundError,
} from "../errors/DomainErrors.js";
import type {
  ConfirmPickupCustodyInput,
  ConfirmDeliveryCustodyInput,
  CompleteBookingCustodyInput,
  RecordTravelEventInput,
  CustodyTransitionResult,
} from "../types/CustodyTypes.js";
import { assertShipmentSafetyClear } from "./SafetyEnforcementService.js";

export class CustodyTransitionService {
  constructor(private readonly db: admin.firestore.Firestore) {}

  /**
   * Internal validation helper enforcing predecessor-chain integrity.
   * Fails closed if the predecessor event document is missing, malformed,
   * or has mismatched bookingId, shipmentId, or eventType.
   */
  private assertCustodyEventMatches(
    docSnapshot: admin.firestore.DocumentSnapshot,
    expectedBookingId: string,
    expectedShipmentId: string,
    expectedEventType: string,
    contextLabel: string,
  ): admin.firestore.DocumentData {
    if (!docSnapshot.exists) {
      throw new FailedPreconditionError(
        `Authoritative predecessor custody event (${expectedEventType}) is missing. ${contextLabel}. Operator reconciliation required.`,
      );
    }
    const data = docSnapshot.data();
    if (!data || typeof data !== "object") {
      throw new FailedPreconditionError(
        `Authoritative predecessor custody event (${expectedEventType}) is malformed. ${contextLabel}.`,
      );
    }
    if (data.eventType !== expectedEventType) {
      throw new FailedPreconditionError(
        `Predecessor custody event type mismatch. Expected '${expectedEventType}', found '${data.eventType}'. ${contextLabel}.`,
      );
    }
    if (data.bookingId !== expectedBookingId) {
      throw new FailedPreconditionError(
        `Predecessor custody event bookingId mismatch. Expected '${expectedBookingId}', found '${data.bookingId}'. ${contextLabel}.`,
      );
    }
    if (data.shipmentId !== expectedShipmentId) {
      throw new FailedPreconditionError(
        `Predecessor custody event shipmentId mismatch. Expected '${expectedShipmentId}', found '${data.shipmentId}'. ${contextLabel}.`,
      );
    }
    return data;
  }

  public async confirmPickupCustody(
    transaction: Transaction,
    input: ConfirmPickupCustodyInput,
    callerUid: string,
  ): Promise<CustodyTransitionResult> {
    if (!input.bookingId || typeof input.bookingId !== "string" || input.bookingId.trim().length === 0 || input.bookingId.length > 128) {
      throw new ValidationError("Invalid bookingId.");
    }
    if (!callerUid || typeof callerUid !== "string" || callerUid.trim().length === 0 || callerUid.length > 128) {
      throw new ValidationError("Invalid callerUid.");
    }
    if (input.location !== undefined && input.location !== null && (typeof input.location !== "string" || input.location.length > 160)) {
      throw new ValidationError("Location must be a string under 160 characters.");
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
      throw new PermissionDeniedError("Only the assigned traveler can confirm pickup custody.");
    }

    const pickupEventRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__pickup_confirmed`);

    // Idempotency: If already in_transit or in a later lifecycle state, and pickup event exists and matches
    if (["in_transit", "delivered", "completed"].includes(booking.status)) {
      const existingEventDoc = await transaction.get(pickupEventRef);
      if (existingEventDoc.exists) {
        this.assertCustodyEventMatches(
          existingEventDoc,
          input.bookingId,
          booking.shipmentId,
          "pickup_confirmed",
          "Pickup retry verification",
        );
        return {
          success: true,
          bookingId: input.bookingId,
          status: booking.status,
          eventId: pickupEventRef.id,
          alreadyTransitioned: true,
        };
      }
    }

    if (booking.status !== "accepted") {
      throw new FailedPreconditionError(`Booking cannot transition from ${booking.status} to in_transit.`);
    }

    // Predecessor-chain validation: traveler_accepted event must exist and correspond to the same booking & shipment
    const travelerAcceptedRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__traveler_accepted`);
    const travelerAcceptedDoc = await transaction.get(travelerAcceptedRef);
    this.assertCustodyEventMatches(
      travelerAcceptedDoc,
      input.bookingId,
      booking.shipmentId,
      "traveler_accepted",
      "Traveler acceptance predecessor verification before pickup",
    );

    // Server-side R04 verification check
    const agreementRef = this.db.collection("bookingHandoffAgreements").doc(input.bookingId);
    const agreementDoc = await transaction.get(agreementRef);
    if (!agreementDoc.exists) {
      throw new FailedPreconditionError("Booking handoff agreement record is missing.");
    }

    const agreement = agreementDoc.data()!;
    if (!agreement.pickupVerification || agreement.pickupVerification.verified !== true) {
      throw new FailedPreconditionError("Pickup verification code has not been verified.");
    }

    // Invariant: Re-verify authoritative safety state before pickup custody transition
    await assertShipmentSafetyClear(transaction, this.db, booking.shipmentId);

    // Validate referenced Shipment
    const shipmentRef = this.db.collection("shipments").doc(booking.shipmentId);
    const shipmentDoc = await transaction.get(shipmentRef);
    if (!shipmentDoc.exists) {
      throw new NotFoundError("Referenced shipment not found.");
    }

    const shipment = shipmentDoc.data()!;
    if (shipment.activeBookingId && shipment.activeBookingId !== input.bookingId) {
      throw new FailedPreconditionError("Shipment is assigned to another booking.");
    }

    // Retrieve authoritative immutable agreement snapshot (R06 Closure Gate 2)
    const snapshotRef = this.db.collection("bookingAgreementSnapshots").doc(input.bookingId);
    const snapshotDoc = await transaction.get(snapshotRef);
    if (!snapshotDoc.exists) {
      throw new FailedPreconditionError(
        "Accepted booking agreement snapshot is missing. Custody cannot be confirmed without an immutable agreement record."
      );
    }

    const snapshot = snapshotDoc.data()!;

    // Validate custody acceptance checklist against the immutable snapshot
    const decl = input.custodyAcceptance;
    if (!decl || typeof decl !== "object") {
      throw new ValidationError("Traveler custody acceptance declaration is required to confirm pickup.");
    }
    if (decl.bookingId !== input.bookingId || decl.shipmentId !== booking.shipmentId) {
      throw new ValidationError("Declaration booking or shipment ID mismatch.");
    }
    if (decl.acceptedByUserId !== callerUid) {
      throw new ValidationError("Declaration acceptedByUserId mismatch.");
    }
    if (decl.custodyVersion !== 1) {
      throw new ValidationError("Invalid declaration custody policy version.");
    }
    if (decl.packageContentVersion !== snapshot.packageContentVersion) {
      throw new FailedPreconditionError("Outdated package content version. Accepted agreement version mismatch.");
    }
    const expectedSenderDeclVersion = snapshot.senderSafetyDeclaration?.declarationVersion ?? snapshot.safetyDeclaration?.declarationVersion ?? "v1";
    if (decl.senderDeclarationVersion !== expectedSenderDeclVersion) {
      throw new FailedPreconditionError("Mismatched sender safety declaration version.");
    }

    const insp = decl.inspection;
    if (
      !insp ||
      insp.packageAvailableForInspection !== true ||
      insp.packagingSecure !== true ||
      insp.weightAppearsReasonable !== true ||
      insp.noVisibleLeak !== true ||
      insp.noVisibleBatteryDamage !== true ||
      insp.noSuspiciousWiring !== true ||
      insp.noUnusualOdorOrContamination !== true ||
      insp.noVisibleConcealment !== true ||
      insp.visibleContentsAppearConsistent !== true
    ) {
      throw new ValidationError("All visual inspection checklist items must be successfully verified.");
    }

    const acks = decl.acknowledgements;
    if (
      !acks ||
      acks.personallyInspected !== true ||
      acks.contentsAppearConsistent !== true ||
      acks.noSuspiciousItemsObserved !== true ||
      acks.safeTransportationAccepted !== true ||
      acks.reasonableCustodyResponsibilityAccepted !== true
    ) {
      throw new ValidationError("All custody acknowledgements must be accepted.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowTimestamp = admin.firestore.Timestamp.now();
    const existingHistory = Array.isArray(booking.statusHistory) ? booking.statusHistory : [];

    // Atomic Writes:
    // 1. Update booking
    transaction.update(bookingRef, {
      status: "in_transit",
      statusHistory: [
        ...existingHistory,
        {
          status: "in_transit",
          changedAt: nowTimestamp,
          changedBy: callerUid,
        },
      ],
      updatedAt: timestamp,
    });

    // 2. Append immutable pickup custody event
    transaction.set(pickupEventRef, {
      bookingId: input.bookingId,
      shipmentId: booking.shipmentId,
      tripId: booking.tripId ?? null,
      eventType: "pickup_confirmed",
      performedBy: callerUid,
      fromPartyId: booking.senderId,
      fromPartyRole: "sender",
      toPartyId: callerUid,
      toPartyRole: "traveler",
      location: input.location?.trim() || null,
      note: input.note?.trim() || "Shipment custody transferred to traveler.",
      sequence: 3,
      previousEventId: travelerAcceptedRef.id,
      metadata: {
        bookingStatus: "in_transit",
        verified: true,
        verificationType: "handoff_pin",
      },
      timestamp: timestamp,
    });

    // 3. Write traveler custody acceptance
    const acceptanceRef = this.db.collection("travelerCustodyAcceptances").doc(input.bookingId);
    transaction.set(acceptanceRef, {
      ...decl,
      acceptedAt: timestamp,
      acceptedByUserId: callerUid,
    });

    return {
      success: true,
      bookingId: input.bookingId,
      status: "in_transit",
      eventId: pickupEventRef.id,
      alreadyTransitioned: false,
    };
  }

  public async confirmDeliveryCustody(
    transaction: Transaction,
    input: ConfirmDeliveryCustodyInput,
    callerUid: string,
  ): Promise<CustodyTransitionResult> {
    if (!input.bookingId || typeof input.bookingId !== "string" || input.bookingId.trim().length === 0 || input.bookingId.length > 128) {
      throw new ValidationError("Invalid bookingId.");
    }
    if (!callerUid || typeof callerUid !== "string" || callerUid.trim().length === 0 || callerUid.length > 128) {
      throw new ValidationError("Invalid callerUid.");
    }
    if (input.location !== undefined && input.location !== null && (typeof input.location !== "string" || input.location.length > 160)) {
      throw new ValidationError("Location must be a string under 160 characters.");
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
      throw new PermissionDeniedError("Only the assigned traveler can confirm delivery custody.");
    }

    const deliveryEventRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__delivery_confirmed`);

    // Idempotency: If already delivered or completed, and delivery event exists and matches
    if (["delivered", "completed"].includes(booking.status)) {
      const existingEventDoc = await transaction.get(deliveryEventRef);
      if (existingEventDoc.exists) {
        this.assertCustodyEventMatches(
          existingEventDoc,
          input.bookingId,
          booking.shipmentId,
          "delivery_confirmed",
          "Delivery retry verification",
        );
        return {
          success: true,
          bookingId: input.bookingId,
          status: booking.status,
          eventId: deliveryEventRef.id,
          alreadyTransitioned: true,
        };
      }
    }

    if (booking.status !== "in_transit") {
      throw new FailedPreconditionError(`Booking cannot transition from ${booking.status} to delivered.`);
    }

    // Predecessor-chain validation: pickup_confirmed event must exist and correspond to the same booking & shipment
    const pickupEventRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__pickup_confirmed`);
    const pickupEventDoc = await transaction.get(pickupEventRef);
    this.assertCustodyEventMatches(
      pickupEventDoc,
      input.bookingId,
      booking.shipmentId,
      "pickup_confirmed",
      "Pickup predecessor verification before delivery",
    );

    // Server-side R04 verification check
    const agreementRef = this.db.collection("bookingHandoffAgreements").doc(input.bookingId);
    const agreementDoc = await transaction.get(agreementRef);
    if (!agreementDoc.exists) {
      throw new FailedPreconditionError("Booking handoff agreement record is missing.");
    }

    const agreement = agreementDoc.data()!;
    if (!agreement.deliveryVerification || agreement.deliveryVerification.verified !== true) {
      throw new FailedPreconditionError("Delivery verification code has not been verified.");
    }

    // PII Minimization for Immutable Custody Ledger:
    // Never store receiver phone, email, name, or meeting location in identity-ID fields or metadata.
    // Use minimal stable representation:
    // If agreement explicitly states sender is receiver: toPartyId = booking.senderId, toPartyRole = "sender_receiver"
    // If intended external receiver: toPartyId = null, toPartyRole = "intended_receiver"
    const isSenderReceiver = agreement.receiver?.isSenderReceiver === true;
    const toPartyId: string | null = isSenderReceiver ? booking.senderId : null;
    const toPartyRole: string = isSenderReceiver ? "sender_receiver" : "intended_receiver";

    // Determine previous event ID in custody sequence (intermediate airport_arrival if recorded, else pickup_confirmed)
    const airportArrivalRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__airport_arrival`);
    const airportArrivalDoc = await transaction.get(airportArrivalRef);
    let previousEventId = pickupEventRef.id;
    if (airportArrivalDoc.exists && airportArrivalDoc.data()?.eventType === "airport_arrival") {
      previousEventId = airportArrivalRef.id;
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowTimestamp = admin.firestore.Timestamp.now();
    const existingHistory = Array.isArray(booking.statusHistory) ? booking.statusHistory : [];

    // Atomic Writes:
    // 1. Update booking
    transaction.update(bookingRef, {
      status: "delivered",
      statusHistory: [
        ...existingHistory,
        {
          status: "delivered",
          changedAt: nowTimestamp,
          changedBy: callerUid,
        },
      ],
      updatedAt: timestamp,
    });

    // 2. Append immutable delivery custody event (strictly non-PII)
    transaction.set(deliveryEventRef, {
      bookingId: input.bookingId,
      shipmentId: booking.shipmentId,
      tripId: booking.tripId ?? null,
      eventType: "delivery_confirmed",
      performedBy: callerUid,
      fromPartyId: callerUid,
      fromPartyRole: "traveler",
      toPartyId,
      toPartyRole,
      location: input.location?.trim() || null,
      note: input.note?.trim() || "Shipment delivered to intended receiver.",
      sequence: 4,
      previousEventId,
      metadata: {
        bookingStatus: "delivered",
        verified: true,
        verificationType: "handoff_pin",
      },
      timestamp: timestamp,
    });

    return {
      success: true,
      bookingId: input.bookingId,
      status: "delivered",
      eventId: deliveryEventRef.id,
      alreadyTransitioned: false,
    };
  }

  public async completeBookingCustody(
    transaction: Transaction,
    input: CompleteBookingCustodyInput,
    callerUid: string,
  ): Promise<CustodyTransitionResult> {
    if (!input.bookingId || typeof input.bookingId !== "string" || input.bookingId.trim().length === 0 || input.bookingId.length > 128) {
      throw new ValidationError("Invalid bookingId.");
    }
    if (!callerUid || typeof callerUid !== "string" || callerUid.trim().length === 0 || callerUid.length > 128) {
      throw new ValidationError("Invalid callerUid.");
    }

    const bookingRef = this.db.collection("bookings").doc(input.bookingId);
    const bookingDoc = await transaction.get(bookingRef);

    if (!bookingDoc.exists) {
      throw new NotFoundError("Booking not found.");
    }

    const booking = bookingDoc.data()!;
    if (booking.senderId !== callerUid) {
      throw new PermissionDeniedError("Only the booking sender can acknowledge completion.");
    }

    // Idempotency: If already completed, return idempotent success
    if (booking.status === "completed") {
      return {
        success: true,
        bookingId: input.bookingId,
        status: "completed",
        alreadyTransitioned: true,
      };
    }

    if (booking.status !== "delivered") {
      throw new FailedPreconditionError(`Booking cannot transition from ${booking.status} to completed.`);
    }

    // Predecessor-chain validation: delivery_confirmed event must exist and correspond to the same booking & shipment
    const deliveryEventRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__delivery_confirmed`);
    const deliveryEventDoc = await transaction.get(deliveryEventRef);
    this.assertCustodyEventMatches(
      deliveryEventDoc,
      input.bookingId,
      booking.shipmentId,
      "delivery_confirmed",
      "Delivery predecessor verification before completion",
    );

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowTimestamp = admin.firestore.Timestamp.now();
    const existingHistory = Array.isArray(booking.statusHistory) ? booking.statusHistory : [];

    // Atomic write: update booking status and history.
    // NOTE (R05 Invariant): Completion is an administrative / sender acknowledgement, NOT a physical custody transfer.
    // We do NOT create a fake custody transfer event.
    transaction.update(bookingRef, {
      status: "completed",
      statusHistory: [
        ...existingHistory,
        {
          status: "completed",
          changedAt: nowTimestamp,
          changedBy: callerUid,
        },
      ],
      updatedAt: timestamp,
    });

    return {
      success: true,
      bookingId: input.bookingId,
      status: "completed",
      alreadyTransitioned: false,
    };
  }

  public async recordTravelEvent(
    transaction: Transaction,
    input: RecordTravelEventInput,
    callerUid: string,
  ): Promise<CustodyTransitionResult> {
    if (!input.bookingId || typeof input.bookingId !== "string" || input.bookingId.trim().length === 0 || input.bookingId.length > 128) {
      throw new ValidationError("Invalid bookingId.");
    }
    if (!callerUid || typeof callerUid !== "string" || callerUid.trim().length === 0 || callerUid.length > 128) {
      throw new ValidationError("Invalid callerUid.");
    }
    if (!["airport_departure", "airport_arrival"].includes(input.eventType)) {
      throw new ValidationError("Invalid travel event type.");
    }
    if (input.location !== undefined && input.location !== null && (typeof input.location !== "string" || input.location.length > 160)) {
      throw new ValidationError("Location must be a string under 160 characters.");
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
      throw new PermissionDeniedError("Only the assigned traveler can record travel events.");
    }

    if (booking.status !== "in_transit") {
      throw new FailedPreconditionError("Travel events require an in-transit booking.");
    }

    const eventRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__${input.eventType}`);
    const existingDoc = await transaction.get(eventRef);
    if (existingDoc.exists) {
      this.assertCustodyEventMatches(
        existingDoc,
        input.bookingId,
        booking.shipmentId,
        input.eventType,
        "Travel event retry verification",
      );
      return {
        success: true,
        bookingId: input.bookingId,
        status: "in_transit",
        eventId: eventRef.id,
        alreadyTransitioned: true,
      };
    }

    // Predecessor-chain checks:
    // 1. airport_departure requires authoritative pickup_confirmed event
    // 2. airport_arrival requires authoritative airport_departure event
    let previousEventId: string;
    if (input.eventType === "airport_departure") {
      const pickupRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__pickup_confirmed`);
      const pickupDoc = await transaction.get(pickupRef);
      this.assertCustodyEventMatches(
        pickupDoc,
        input.bookingId,
        booking.shipmentId,
        "pickup_confirmed",
        "Airport departure predecessor verification",
      );
      previousEventId = pickupRef.id;
    } else {
      const departureRef = this.db.collection("custodyEvents").doc(`${input.bookingId}__airport_departure`);
      const departureDoc = await transaction.get(departureRef);
      if (!departureDoc.exists) {
        throw new FailedPreconditionError("Airport arrival requires previous airport departure event.");
      }
      this.assertCustodyEventMatches(
        departureDoc,
        input.bookingId,
        booking.shipmentId,
        "airport_departure",
        "Airport arrival predecessor verification",
      );
      previousEventId = departureRef.id;
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    transaction.set(eventRef, {
      bookingId: input.bookingId,
      shipmentId: booking.shipmentId,
      tripId: booking.tripId ?? null,
      eventType: input.eventType,
      performedBy: callerUid,
      fromPartyId: callerUid,
      fromPartyRole: "traveler",
      toPartyId: callerUid,
      toPartyRole: "traveler",
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
      sequence: input.eventType === "airport_departure" ? 3.1 : 3.2,
      previousEventId,
      metadata: {
        bookingStatus: "in_transit",
      },
      timestamp,
    });

    return {
      success: true,
      bookingId: input.bookingId,
      status: "in_transit",
      eventId: eventRef.id,
      alreadyTransitioned: false,
    };
  }
}
