import type admin from "firebase-admin";

export interface TravelerCustodyInspectionChecks {
  readonly packageAvailableForInspection: boolean;
  readonly packagingSecure: boolean;
  readonly weightAppearsReasonable: boolean;
  readonly noVisibleLeak: boolean;
  readonly noVisibleBatteryDamage: boolean;
  readonly noSuspiciousWiring: boolean;
  readonly noUnusualOdorOrContamination: boolean;
  readonly noVisibleConcealment: boolean;
  readonly visibleContentsAppearConsistent: boolean;
}

export interface TravelerCustodyAcknowledgements {
  readonly personallyInspected: boolean;
  readonly contentsAppearConsistent: boolean;
  readonly noSuspiciousItemsObserved: boolean;
  readonly safeTransportationAccepted: boolean;
  readonly reasonableCustodyResponsibilityAccepted: boolean;
}

export interface TravelerCustodyAcceptancePayload {
  readonly bookingId: string;
  readonly shipmentId: string;
  readonly acceptedByUserId: string;
  readonly custodyVersion: number;
  readonly custodyPolicyVersion: string;
  readonly declarationVersion: string;
  readonly packageContentVersion: number;
  readonly senderDeclarationVersion: string;
  readonly inspection: TravelerCustodyInspectionChecks;
  readonly acknowledgements: TravelerCustodyAcknowledgements;
}

export interface ConfirmPickupCustodyInput {
  readonly bookingId: string;
  readonly location?: string | null;
  readonly note?: string | null;
  readonly custodyAcceptance: TravelerCustodyAcceptancePayload;
  readonly idempotencyKey?: string | null;
}

export interface ConfirmDeliveryCustodyInput {
  readonly bookingId: string;
  readonly location?: string | null;
  readonly note?: string | null;
  readonly idempotencyKey?: string | null;
}

export interface CompleteBookingCustodyInput {
  readonly bookingId: string;
  readonly idempotencyKey?: string | null;
}

export interface RecordTravelEventInput {
  readonly bookingId: string;
  readonly eventType: "airport_departure" | "airport_arrival";
  readonly location?: string | null;
  readonly note?: string | null;
}

export interface AuthoritativeCustodyEvent {
  readonly bookingId: string;
  readonly shipmentId: string;
  readonly tripId: string | null;
  readonly eventType:
    | "shipment_created"
    | "traveler_accepted"
    | "pickup_confirmed"
    | "airport_departure"
    | "airport_arrival"
    | "delivery_confirmed";
  readonly performedBy: string;
  readonly fromPartyId: string | null;
  readonly toPartyId: string | null;
  readonly fromPartyRole?: string;
  readonly toPartyRole?: string;
  readonly location: string | null;
  readonly note: string | null;
  readonly sequence: number;
  readonly previousEventId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly timestamp: admin.firestore.FieldValue | admin.firestore.Timestamp;
}

export interface CustodyTransitionResult {
  readonly success: boolean;
  readonly bookingId: string;
  readonly status: string;
  readonly eventId?: string;
  readonly alreadyTransitioned: boolean;
}
