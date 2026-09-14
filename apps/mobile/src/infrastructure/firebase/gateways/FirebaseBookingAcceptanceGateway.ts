import type {
  AcceptBookingCommand,
  AcceptBookingResult,
  BookingAcceptanceGateway,
} from "../../../application/services/BookingAcceptanceGateway";
import type {
  AcceptBookingPayload,
  AcceptBookingCallableResult,
} from "../privilegedCallableTransport";

export interface BookingAcceptanceTransport {
  acceptBooking(
    payload: AcceptBookingPayload,
    expectedUserId?: string,
  ): Promise<AcceptBookingCallableResult>;
}

export class FirebaseBookingAcceptanceGateway implements BookingAcceptanceGateway {
  constructor(private readonly transport: BookingAcceptanceTransport) {}

  async acceptBooking(command: AcceptBookingCommand): Promise<AcceptBookingResult> {
    const res = await this.transport.acceptBooking(
      {
        bookingId: command.bookingId,
        location: command.location ?? null,
        note: command.note ?? null,
      },
      command.actorId,
    );

    return {
      success: res.success,
      bookingId: res.bookingId,
      alreadyAccepted: res.alreadyAccepted,
      tripId: res.tripId,
      shipmentId: res.shipmentId,
      reservedWeightKg: res.reservedWeightKg,
    };
  }
}
