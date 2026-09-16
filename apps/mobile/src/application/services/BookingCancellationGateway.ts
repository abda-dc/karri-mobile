export interface CancelBookingCommand {
  readonly bookingId: string;
  readonly actorId: string;
  readonly reasonCode?: string | null;
  readonly note?: string | null;
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

export interface DeclineBookingCommand {
  readonly bookingId: string;
  readonly actorId: string;
  readonly reasonCode?: string | null;
  readonly note?: string | null;
}

export interface DeclineBookingResult {
  readonly success: boolean;
  readonly bookingId: string;
  readonly status: "declined";
  readonly declined: boolean;
  readonly idempotent: boolean;
}

export interface BookingCancellationGateway {
  cancelBooking(command: CancelBookingCommand): Promise<CancelBookingResult>;
  declineBooking(command: DeclineBookingCommand): Promise<DeclineBookingResult>;
}
