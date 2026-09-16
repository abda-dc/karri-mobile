import type {
  BookingCreationGateway,
  RequestBookingCommand,
  RequestBookingResult,
} from "../../../application/services/BookingCreationGateway";
import type {
  RequestBookingCallableResult,
  RequestBookingPayload,
} from "../privilegedCallableTransport";

export interface BookingCreationTransport {
  requestBooking(
    payload: RequestBookingPayload,
    expectedUserId?: string,
  ): Promise<RequestBookingCallableResult>;
}

export class FirebaseBookingCreationGateway implements BookingCreationGateway {
  constructor(private readonly transport: BookingCreationTransport) {}

  async requestBooking(command: RequestBookingCommand): Promise<RequestBookingResult> {
    const res = await this.transport.requestBooking(
      {
        shipmentId: command.shipmentId,
        tripId: command.tripId,
        message: command.message ?? null,
        operationId: command.operationId ?? null,
      },
      command.senderId,
    );

    return {
      success: res.success,
      bookingId: res.bookingId,
      bookingRequestId: res.bookingRequestId,
      status: res.status,
      alreadyExisted: res.alreadyExisted,
      rebooked: res.rebooked,
      tripId: res.tripId,
      shipmentId: res.shipmentId,
    };
  }
}
