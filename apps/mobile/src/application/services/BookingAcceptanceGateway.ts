export interface AcceptBookingCommand {
  readonly bookingId: string;
  readonly actorId: string;
  readonly location?: string | null;
  readonly note?: string | null;
}

export interface AcceptBookingResult {
  readonly success: boolean;
  readonly bookingId: string;
  readonly alreadyAccepted: boolean;
  readonly tripId?: string;
  readonly shipmentId?: string;
  readonly reservedWeightKg?: number;
}

export interface BookingAcceptanceGateway {
  acceptBooking(command: AcceptBookingCommand): Promise<AcceptBookingResult>;
}
