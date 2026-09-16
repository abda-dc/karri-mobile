export interface RequestBookingCommand {
  readonly shipmentId: string;
  readonly tripId: string;
  readonly senderId: string;
  readonly travelerId: string;
  readonly message?: string;
  readonly operationId?: string;
}

export interface RequestBookingResult {
  readonly success: boolean;
  readonly bookingId: string;
  readonly bookingRequestId: string;
  readonly status: string;
  readonly alreadyExisted: boolean;
  readonly rebooked: boolean;
  readonly tripId: string;
  readonly shipmentId: string;
}

export interface BookingCreationGateway {
  requestBooking(command: RequestBookingCommand): Promise<RequestBookingResult>;
}
