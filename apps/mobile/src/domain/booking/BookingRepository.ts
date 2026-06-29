import type {
  Booking,
  BookingRequest,
  NewBooking,
  NewBookingRequest,
} from "./Booking";
import type { NewCustodyEvent } from "../custody/CustodyEvent";

export interface NewBookingRecords {
  readonly request: NewBookingRequest;
  readonly booking: Omit<NewBooking, "bookingRequestId">;
  readonly initialCustodyEvent: Omit<NewCustodyEvent, "bookingId">;
}

export interface CreatedBookingRecords {
  readonly request: BookingRequest;
  readonly booking: Booking;
}

export interface BookingRepository {
  createRequest(records: NewBookingRecords): Promise<CreatedBookingRecords>;
  findById(bookingId: string): Promise<Booking | null>;
  findRequestById(requestId: string): Promise<BookingRequest | null>;
  listByParticipant(userId: string): Promise<ReadonlyArray<Booking>>;
  watchByParticipant(
    userId: string,
    onData: (bookings: ReadonlyArray<Booking>) => void,
    onError: (error: Error) => void,
  ): () => void;
  saveTransition(
    booking: Booking,
    request: BookingRequest | null,
    lifecycleCustodyEvent: NewCustodyEvent | null,
  ): Promise<{ readonly booking: Booking; readonly request: BookingRequest | null }>;
}
