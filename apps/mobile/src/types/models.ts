import type { Timestamp } from "firebase/firestore";

export type RecordTimestamp = Timestamp | null;
export type UserStatus = "active" | "disabled";
export type ProfileStatus = "incomplete" | "active";
export type ListingStatus = "draft" | "active" | "closed" | "cancelled";
export type BookingRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export type BookingStatus =
  | "accepted"
  | "pickup_pending"
  | "in_custody"
  | "in_transit"
  | "delivery_pending"
  | "delivered"
  | "cancelled"
  | "exception";
export type CustodyEventStatus = "recorded" | "corrected";
export type ReviewStatus = "pending" | "published" | "removed";
export type NotificationStatus = "unread" | "read";

export interface UserRecord {
  id: string;
  userId: string;
  email: string | null;
  status: UserStatus;
  createdAt: RecordTimestamp;
  updatedAt: RecordTimestamp;
}

export interface Profile {
  id: string;
  userId: string;
  displayName: string;
  homeRegion: string;
  primaryDestinationCountry: string;
  roles: Array<"sender" | "traveler">;
  trustScore: number | null;
  status: ProfileStatus;
  createdAt: RecordTimestamp;
  updatedAt: RecordTimestamp;
}

export interface Shipment {
  id: string;
  ownerId: string;
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  packageCategory: string;
  packageDescription: string;
  weightKg: number;
  deliveryWindow: string;
  rewardAmount: number;
  rewardCurrency: string;
  status: ListingStatus;
  createdAt: RecordTimestamp;
  updatedAt: RecordTimestamp;
}

export interface ShipmentInput {
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  packageCategory: string;
  packageDescription: string;
  weightKg: number;
  deliveryWindow: string;
  rewardAmount: number;
}

export interface Trip {
  id: string;
  ownerId: string;
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  departureDate: string;
  arrivalDate: string;
  availableCapacityKg: number;
  notes: string;
  status: ListingStatus;
  createdAt: RecordTimestamp;
  updatedAt: RecordTimestamp;
}

export interface TripInput {
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  departureDate: string;
  arrivalDate: string;
  availableCapacityKg: number;
  notes: string;
}

export interface BookingRequest {
  id: string;
  userId: string;
  shipmentId: string;
  tripId: string;
  senderId: string;
  travelerId: string;
  status: BookingRequestStatus;
  createdAt: RecordTimestamp;
  updatedAt: RecordTimestamp;
}

export interface Booking {
  id: string;
  userId: string;
  bookingRequestId: string;
  shipmentId: string;
  tripId: string;
  senderId: string;
  travelerId: string;
  status: BookingStatus;
  createdAt: RecordTimestamp;
  updatedAt: RecordTimestamp;
}

export interface CustodyEvent {
  id: string;
  userId: string;
  bookingId: string;
  actorId: string;
  eventType: string;
  note: string;
  status: CustodyEventStatus;
  createdAt: RecordTimestamp;
  updatedAt: RecordTimestamp;
}

export interface Review {
  id: string;
  userId: string;
  bookingId: string;
  reviewerId: string;
  subjectId: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: RecordTimestamp;
  updatedAt: RecordTimestamp;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  relatedId: string | null;
  status: NotificationStatus;
  createdAt: RecordTimestamp;
  updatedAt: RecordTimestamp;
}
