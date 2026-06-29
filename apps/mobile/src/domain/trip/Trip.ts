import type { DomainEntity } from "../shared/Entity";
import type { ListingStatus } from "../shipment/Shipment";

export interface Trip extends DomainEntity {
  readonly ownerId: string;
  readonly originCountry: string;
  readonly originCity: string;
  readonly destinationCountry: string;
  readonly destinationCity: string;
  readonly departureDate: string;
  readonly arrivalDate: string;
  readonly availableCapacityKg: number;
  readonly notes: string;
  readonly status: ListingStatus;
}

export type NewTrip = Omit<Trip, "id" | "createdAt" | "updatedAt">;
