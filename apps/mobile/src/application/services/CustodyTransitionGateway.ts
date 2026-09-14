import type { TravelerCustodyAcceptance } from "../../domain/custody/TravelerCustodyAcceptance";

export interface ConfirmPickupCustodyGatewayInput {
  readonly bookingId: string;
  readonly actorId: string;
  readonly location?: string;
  readonly note?: string;
  readonly custodyAcceptance: Omit<TravelerCustodyAcceptance, "acceptedAt">;
}

export interface ConfirmDeliveryCustodyGatewayInput {
  readonly bookingId: string;
  readonly actorId: string;
  readonly location?: string;
  readonly note?: string;
}

export interface CompleteBookingCustodyGatewayInput {
  readonly bookingId: string;
  readonly actorId: string;
}

export interface RecordTravelCustodyEventGatewayInput {
  readonly bookingId: string;
  readonly actorId: string;
  readonly eventType: "airport_departure" | "airport_arrival";
  readonly location?: string;
  readonly note?: string;
}

export interface CustodyTransitionGatewayResult {
  readonly success: boolean;
  readonly bookingId: string;
  readonly status: string;
  readonly eventId?: string;
  readonly alreadyTransitioned: boolean;
}

export interface CustodyTransitionGateway {
  confirmPickup(
    input: ConfirmPickupCustodyGatewayInput,
  ): Promise<CustodyTransitionGatewayResult>;

  confirmDelivery(
    input: ConfirmDeliveryCustodyGatewayInput,
  ): Promise<CustodyTransitionGatewayResult>;

  completeBooking(
    input: CompleteBookingCustodyGatewayInput,
  ): Promise<CustodyTransitionGatewayResult>;

  recordTravelEvent(
    input: RecordTravelCustodyEventGatewayInput,
  ): Promise<CustodyTransitionGatewayResult>;
}
