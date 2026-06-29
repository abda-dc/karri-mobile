import type {
  Booking as DomainBooking,
  BookingRequest as DomainBookingRequest,
  BookingRequestStatus as DomainBookingRequestStatus,
  BookingStatus as DomainBookingStatus,
} from "../domain/booking/Booking";
import type { CustodyEvent as DomainCustodyEvent } from "../domain/custody/CustodyEvent";
import type { Notification as DomainNotification } from "../domain/notification/Notification";
import type { Profile as DomainProfile } from "../domain/profile/Profile";
import type { Review as DomainReview } from "../domain/review/Review";
import type {
  ListingStatus as DomainListingStatus,
  Shipment as DomainShipment,
} from "../domain/shipment/Shipment";
import type { DomainTimestamp } from "../domain/shared/Entity";
import type { Trip as DomainTrip } from "../domain/trip/Trip";
import type { User as DomainUser } from "../domain/user/User";

// Compatibility aliases for the existing screens while they migrate behind
// application services. These aliases remain provider-independent.
export type RecordTimestamp = DomainTimestamp;
export type ListingStatus = DomainListingStatus;
export type BookingRequestStatus = DomainBookingRequestStatus;
export type BookingStatus = DomainBookingStatus;
export type UserRecord = DomainUser;
export type Profile = DomainProfile;
export type Shipment = DomainShipment;
export type Trip = DomainTrip;
export type BookingRequest = DomainBookingRequest;
export type Booking = DomainBooking;
export type CustodyEvent = DomainCustodyEvent;
export type Review = DomainReview;
export type NotificationRecord = DomainNotification;

export interface ShipmentInput {
  readonly originCountry: string;
  readonly originCity: string;
  readonly destinationCountry: string;
  readonly destinationCity: string;
  readonly packageCategory: string;
  readonly packageDescription: string;
  readonly weightKg: number;
  readonly deliveryWindow: string;
  readonly rewardAmount: number;
}

export interface TripInput {
  readonly originCountry: string;
  readonly originCity: string;
  readonly destinationCountry: string;
  readonly destinationCity: string;
  readonly departureDate: string;
  readonly arrivalDate: string;
  readonly availableCapacityKg: number;
  readonly notes: string;
}
