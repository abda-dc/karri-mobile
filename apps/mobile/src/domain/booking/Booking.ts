import type { DomainEntity } from "../shared/Entity";

export const BookingStatus = {
  Pending: "pending",
  Accepted: "accepted",
  InTransit: "in_transit",
  Delivered: "delivered",
  Completed: "completed",
  Cancelled: "cancelled",
  Declined: "declined",
  Expired: "expired",
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const BookingRequestStatus = {
  Pending: "pending",
  Accepted: "accepted",
  Cancelled: "cancelled",
  Declined: "declined",
  Expired: "expired",
} as const;

export type BookingRequestStatus =
  (typeof BookingRequestStatus)[keyof typeof BookingRequestStatus];

export interface BookingRequest extends DomainEntity {
  readonly shipmentId: string;
  readonly tripId: string;
  readonly senderId: string;
  readonly travelerId: string;
  readonly message: string;
  readonly status: BookingRequestStatus;
}

export interface Booking extends DomainEntity {
  readonly bookingRequestId: string;
  readonly shipmentId: string;
  readonly tripId: string;
  readonly senderId: string;
  readonly travelerId: string;
  readonly status: BookingStatus;
}

export type NewBookingRequest = Omit<
  BookingRequest,
  "id" | "createdAt" | "updatedAt"
>;

export type NewBooking = Omit<Booking, "id" | "createdAt" | "updatedAt">;
