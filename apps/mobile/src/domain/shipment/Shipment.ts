import type { DomainEntity } from "../shared/Entity";

export const ListingStatus = {
  Draft: "draft",
  Active: "active",
  Closed: "closed",
  Cancelled: "cancelled",
} as const;

export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export interface SafetyDeclarationSnapshot {
  readonly policyVersion: string;
  readonly declarationVersion: string;
  readonly acceptedAt: string;
  readonly acceptedByUserId: string;
  readonly packageContentVersion: number;
  readonly acknowledgements: {
    readonly contentsAccurate: true;
    readonly noProhibitedItems: true;
    readonly inspectionPermitted: true;
    readonly customsResponsibilityAccepted: true;
  };
}

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

  // Safety & Declaration fields
  readonly containsBattery: boolean;
  readonly batteryType: "lithium_ion" | "lithium_metal" | "none";
  readonly containsLiquid: boolean;
  readonly containsFoodOrAgri: boolean;
  readonly containsMedicine: boolean;
  readonly customsDeclarationRequired: boolean;
  readonly packageContentVersion: number;
  readonly safetyDeclaration: SafetyDeclarationSnapshot | null;
}

export type NewShipment = Omit<Shipment, "id" | "createdAt" | "updatedAt">;
