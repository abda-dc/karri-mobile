import type {
  Booking,
  BookingRequest,
  NewBooking,
  NewBookingRequest,
} from "./Booking";

export interface NewBookingRecords {
  readonly request: NewBookingRequest;
  readonly booking: Omit<NewBooking, "bookingRequestId">;
}

export interface CreatedBookingRecords {
  readonly request: BookingRequest;
  readonly booking: Booking;
}

export interface BookingRepository {
  createRequest(records: NewBookingRecords): Promise<CreatedBookingRecords>;
  findById(bookingId: string): Promise<Booking | null>;
  findRequestById(requestId: string): Promise<BookingRequest | null>;
  saveTransition(
    booking: Booking,
    request: BookingRequest | null,
  ): Promise<{ readonly booking: Booking; readonly request: BookingRequest | null }>;
}
