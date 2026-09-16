import type {
  BookingCancellationGateway,
  CancelBookingCommand,
  CancelBookingResult,
  DeclineBookingCommand,
  DeclineBookingResult,
} from "../../../application/services/BookingCancellationGateway";
import type {
  CancelBookingCallableResult,
  CancelBookingPayload,
  DeclineBookingCallableResult,
  DeclineBookingPayload,
} from "../privilegedCallableTransport";

export interface BookingCancellationTransport {
  cancelBooking(
    payload: CancelBookingPayload,
    expectedUserId?: string,
  ): Promise<CancelBookingCallableResult>;
  declineBooking(
    payload: DeclineBookingPayload,
    expectedUserId?: string,
  ): Promise<DeclineBookingCallableResult>;
}

export class FirebaseBookingCancellationGateway implements BookingCancellationGateway {
  constructor(private readonly transport: BookingCancellationTransport) {}

  async cancelBooking(command: CancelBookingCommand): Promise<CancelBookingResult> {
    const res = await this.transport.cancelBooking(
      {
        bookingId: command.bookingId,
        reasonCode: command.reasonCode ?? null,
        note: command.note ?? null,
      },
      command.actorId,
    );

    return {
      success: res.success,
      bookingId: res.bookingId,
      status: res.status,
      cancelled: res.cancelled,
      idempotent: res.idempotent,
      capacityRestored: res.capacityRestored,
      shipmentReleased: res.shipmentReleased,
    };
  }

  async declineBooking(command: DeclineBookingCommand): Promise<DeclineBookingResult> {
    const res = await this.transport.declineBooking(
      {
        bookingId: command.bookingId,
        reasonCode: command.reasonCode ?? null,
        note: command.note ?? null,
      },
      command.actorId,
    );

    return {
      success: res.success,
      bookingId: res.bookingId,
      status: res.status,
      declined: res.declined,
      idempotent: res.idempotent,
    };
  }
}
