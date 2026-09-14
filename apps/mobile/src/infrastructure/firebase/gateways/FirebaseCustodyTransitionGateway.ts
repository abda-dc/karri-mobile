import type {
  ConfirmPickupCustodyGatewayInput,
  ConfirmDeliveryCustodyGatewayInput,
  CompleteBookingCustodyGatewayInput,
  RecordTravelCustodyEventGatewayInput,
  CustodyTransitionGatewayResult,
  CustodyTransitionGateway,
} from "../../../application/services/CustodyTransitionGateway";
import type {
  ConfirmPickupCustodyPayload,
  ConfirmDeliveryCustodyPayload,
  CompleteBookingCustodyPayload,
  RecordTravelCustodyEventPayload,
  CustodyTransitionCallableResult,
} from "../privilegedCallableTransport";

export interface CustodyTransitionTransport {
  confirmPickupCustody(
    payload: ConfirmPickupCustodyPayload,
    expectedUserId?: string,
  ): Promise<CustodyTransitionCallableResult>;

  confirmDeliveryCustody(
    payload: ConfirmDeliveryCustodyPayload,
    expectedUserId?: string,
  ): Promise<CustodyTransitionCallableResult>;

  completeBookingCustody(
    payload: CompleteBookingCustodyPayload,
    expectedUserId?: string,
  ): Promise<CustodyTransitionCallableResult>;

  recordTravelCustodyEvent(
    payload: RecordTravelCustodyEventPayload,
    expectedUserId?: string,
  ): Promise<CustodyTransitionCallableResult>;
}

export class FirebaseCustodyTransitionGateway implements CustodyTransitionGateway {
  constructor(private readonly transport: CustodyTransitionTransport) {}

  async confirmPickup(
    input: ConfirmPickupCustodyGatewayInput,
  ): Promise<CustodyTransitionGatewayResult> {
    const res = await this.transport.confirmPickupCustody(
      {
        bookingId: input.bookingId,
        location: input.location ?? null,
        note: input.note ?? null,
        custodyAcceptance: input.custodyAcceptance,
      },
      input.actorId,
    );

    return {
      success: res.success,
      bookingId: res.bookingId,
      status: res.status,
      eventId: res.eventId,
      alreadyTransitioned: res.alreadyTransitioned,
    };
  }

  async confirmDelivery(
    input: ConfirmDeliveryCustodyGatewayInput,
  ): Promise<CustodyTransitionGatewayResult> {
    const res = await this.transport.confirmDeliveryCustody(
      {
        bookingId: input.bookingId,
        location: input.location ?? null,
        note: input.note ?? null,
      },
      input.actorId,
    );

    return {
      success: res.success,
      bookingId: res.bookingId,
      status: res.status,
      eventId: res.eventId,
      alreadyTransitioned: res.alreadyTransitioned,
    };
  }

  async completeBooking(
    input: CompleteBookingCustodyGatewayInput,
  ): Promise<CustodyTransitionGatewayResult> {
    const res = await this.transport.completeBookingCustody(
      {
        bookingId: input.bookingId,
      },
      input.actorId,
    );

    return {
      success: res.success,
      bookingId: res.bookingId,
      status: res.status,
      eventId: res.eventId,
      alreadyTransitioned: res.alreadyTransitioned,
    };
  }

  async recordTravelEvent(
    input: RecordTravelCustodyEventGatewayInput,
  ): Promise<CustodyTransitionGatewayResult> {
    const res = await this.transport.recordTravelCustodyEvent(
      {
        bookingId: input.bookingId,
        eventType: input.eventType,
        location: input.location ?? null,
        note: input.note ?? null,
      },
      input.actorId,
    );

    return {
      success: res.success,
      bookingId: res.bookingId,
      status: res.status,
      eventId: res.eventId,
      alreadyTransitioned: res.alreadyTransitioned,
    };
  }
}
