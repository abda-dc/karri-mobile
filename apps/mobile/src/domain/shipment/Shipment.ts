import type { DomainEntity } from "../shared/Entity";

export const ListingStatus = {
  Draft: "draft",
  Active: "active",
  Closed: "closed",
  Cancelled: "cancelled",
} as const;

export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export interface Shipment extends DomainEntity {
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
  readonly rewardCurrency: string;
  readonly status: ListingStatus;
}

export type NewShipment = Omit<Shipment, "id" | "createdAt" | "updatedAt">;
