import type { DomainTimestamp } from "../shared/Entity";

export const CustodyEventType = {
  ShipmentCreated: "shipment_created",
  TravelerAccepted: "traveler_accepted",
  PickupConfirmed: "pickup_confirmed",
  AirportDeparture: "airport_departure",
  AirportArrival: "airport_arrival",
  DeliveryConfirmed: "delivery_confirmed",
  Completed: "completed",
} as const;

export type CustodyEventType =
  (typeof CustodyEventType)[keyof typeof CustodyEventType];

export interface CustodyEvent {
  readonly id: string;
  readonly bookingId: string;
  readonly eventType: CustodyEventType;
  readonly timestamp: DomainTimestamp;
  readonly performedBy: string;
  readonly location: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type NewCustodyEvent = Omit<CustodyEvent, "id" | "timestamp">;
