import type { BookingStatus } from "../../domain/booking/Booking";
import type { ReviewDirection } from "../../domain/review/Review";
import type { TrustInputs } from "../../domain/trust/TrustScore";
import type { CustodyEventType } from "../../domain/custody/CustodyEvent";

import type { SafetyDeclarationSnapshot } from "../../domain/shipment/Shipment";

export interface CreateShipmentDto {
  readonly ownerId: string;
  readonly originCountry: string;
  readonly originCity: string;
  readonly destinationCountry: string;
  readonly destinationCity: string;
  readonly packageCategory: string;
  readonly packageDescription: string;
  readonly weightKg: number;
  readonly deliveryWindow: string;
  readonly rewardAmount: number;
  readonly rewardCurrency?: string;

  // Safety & Declaration fields
  readonly containsBattery: boolean;
  readonly batteryType: "lithium_ion" | "lithium_metal" | "none";
  readonly containsLiquid: boolean;
  readonly containsFoodOrAgri: boolean;
  readonly containsMedicine: boolean;
  readonly customsDeclarationRequired: boolean;
  readonly packageContentVersion: number;
  readonly safetyDeclaration: SafetyDeclarationSnapshot;
}

export interface CreateTripDto {
  readonly ownerId: string;
  readonly originCountry: string;
  readonly originCity: string;
  readonly destinationCountry: string;
  readonly destinationCity: string;
  readonly departureDate: string;
  readonly arrivalDate: string;
  readonly availableCapacityKg: number;
  readonly notes?: string;
}

export interface RequestBookingDto {
  readonly shipmentId: string;
  readonly tripId: string;
  readonly senderId: string;
  readonly travelerId: string;
  readonly message?: string;
}

export interface TransitionBookingDto {
  readonly bookingId: string;
  readonly actorId: string;
  readonly nextStatus: BookingStatus;
  readonly location?: string;
  readonly note?: string;
}

export interface RecordCustodyEventDto {
  readonly bookingId: string;
  readonly actorId: string;
  readonly eventType: CustodyEventType;
  readonly location?: string;
  readonly note?: string;
}

export interface SubmitReviewDto {
  readonly bookingId: string;
  readonly reviewerId: string;
  readonly revieweeId: string;
  readonly direction: ReviewDirection;
  readonly rating: number;
  readonly comment: string;
}

export interface CalculateTrustDto {
  readonly userId: string;
  readonly inputs: TrustInputs;
}
