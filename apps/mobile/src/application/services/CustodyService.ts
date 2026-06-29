import type { RecordCustodyEventDto } from "../dto/commands";
import { BookingStatus } from "../../domain/booking/Booking";
import type { BookingRepository } from "../../domain/booking/BookingRepository";
import {
  CustodyEventType,
  type CustodyEvent,
} from "../../domain/custody/CustodyEvent";
import type { CustodyRepository } from "../../domain/custody/CustodyRepository";
import { DomainValidationError, optionalText } from "./validation";

export class CustodyService {
  constructor(
    private readonly custody: CustodyRepository,
    private readonly bookings: BookingRepository,
  ) {}

  async recordTravelEvent(input: RecordCustodyEventDto): Promise<CustodyEvent> {
    const booking = await this.bookings.findById(input.bookingId);

    if (!booking) {
      throw new DomainValidationError("Booking was not found.");
    }

    if (booking.travelerId !== input.actorId) {
      throw new DomainValidationError("Only the booking traveler can record travel events.");
    }

    if (booking.status !== BookingStatus.InTransit) {
      throw new DomainValidationError("Travel events require an in-transit booking.");
    }

    const allowedTypes: ReadonlyArray<CustodyEventType> = [
      CustodyEventType.AirportDeparture,
      CustodyEventType.AirportArrival,
    ];

    if (!allowedTypes.includes(input.eventType)) {
      throw new DomainValidationError("This custody event is managed by the booking lifecycle.");
    }

    const existing = await this.custody.listByBooking(booking.id);

    if (existing.some((event) => event.eventType === input.eventType)) {
      throw new DomainValidationError("This custody event has already been recorded.");
    }

    if (
      input.eventType === CustodyEventType.AirportArrival &&
      !existing.some((event) => event.eventType === CustodyEventType.AirportDeparture)
    ) {
      throw new DomainValidationError("Record airport departure before airport arrival.");
    }

    return this.custody.append({
      bookingId: booking.id,
      eventType: input.eventType,
      performedBy: input.actorId,
      location: optionalText(input.location ?? "", "location", 160) || null,
      note: optionalText(input.note ?? "", "note", 500) || null,
      metadata: { bookingStatus: booking.status },
    });
  }

  listByBooking(bookingId: string): Promise<ReadonlyArray<CustodyEvent>> {
    return this.custody.listByBooking(bookingId);
  }

  watchByBooking(
    bookingId: string,
    onData: (events: ReadonlyArray<CustodyEvent>) => void,
    onError: (error: Error) => void,
  ): () => void {
    return this.custody.watchByBooking(bookingId, onData, onError);
  }
}
