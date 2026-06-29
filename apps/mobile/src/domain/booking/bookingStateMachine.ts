import { BookingStatus, type Booking } from "./Booking";

const allowedTransitions: Readonly<Record<BookingStatus, ReadonlyArray<BookingStatus>>> = {
  [BookingStatus.Pending]: [
    BookingStatus.Accepted,
    BookingStatus.Declined,
    BookingStatus.Cancelled,
    BookingStatus.Expired,
  ],
  [BookingStatus.Accepted]: [BookingStatus.InTransit],
  [BookingStatus.InTransit]: [BookingStatus.Delivered],
  [BookingStatus.Delivered]: [BookingStatus.Completed],
  [BookingStatus.Completed]: [],
  [BookingStatus.Cancelled]: [],
  [BookingStatus.Declined]: [],
  [BookingStatus.Expired]: [],
};

export class InvalidBookingTransitionError extends Error {
  constructor(currentStatus: BookingStatus, nextStatus: BookingStatus) {
    super(`Booking cannot transition from ${currentStatus} to ${nextStatus}.`);
    this.name = "InvalidBookingTransitionError";
  }
}

export function canTransitionBooking(
  currentStatus: BookingStatus,
  nextStatus: BookingStatus,
): boolean {
  return allowedTransitions[currentStatus].includes(nextStatus);
}

export function transitionBooking(
  booking: Booking,
  nextStatus: BookingStatus,
  occurredAt: string,
): Booking {
  if (!canTransitionBooking(booking.status, nextStatus)) {
    throw new InvalidBookingTransitionError(booking.status, nextStatus);
  }

  return {
    ...booking,
    status: nextStatus,
    updatedAt: occurredAt,
  };
}

export function getAllowedBookingTransitions(
  status: BookingStatus,
): ReadonlyArray<BookingStatus> {
  return allowedTransitions[status];
}
