import type { BookingStatus } from "../booking/Booking";

export type AdminOperationsUnauthorizedReason =
  | "insufficient-role"
  | "permission-denied";

export type AdminOperationsSection<T> =
  | { readonly status: "available"; readonly value: T }
  | {
      readonly status: "unauthorized";
      readonly reason: AdminOperationsUnauthorizedReason;
    }
  | { readonly status: "unavailable"; readonly reason: "query-failed" };

export interface AdminShipmentSafetyReview {
  readonly id: string;
  readonly shipmentId: string;
  readonly decision: "approved" | "rejected" | "needs_more_information";
  readonly reasonCode: string;
  readonly createdAt: string;
}

export interface AdminAdministrativeHold {
  readonly id: string;
  readonly shipmentId: string;
  readonly reasonCode: string;
  readonly placedAt: string;
}

export interface AdminRecentBooking {
  readonly id: string;
  readonly shipmentId: string;
  readonly tripId: string;
  readonly status: BookingStatus;
  readonly createdAt: string;
}

export interface AdminOperationsOverview {
  readonly activeShipments: AdminOperationsSection<number>;
  readonly activeTrips: AdminOperationsSection<number>;
  readonly pendingBookingRequests: AdminOperationsSection<number>;
  readonly activeBookings: AdminOperationsSection<number>;
  readonly recentShipmentSafetyReviews: AdminOperationsSection<
    ReadonlyArray<AdminShipmentSafetyReview>
  >;
  readonly activeAdministrativeHolds: AdminOperationsSection<
    ReadonlyArray<AdminAdministrativeHold>
  >;
  readonly recentBookings: AdminOperationsSection<
    ReadonlyArray<AdminRecentBooking>
  >;
}
