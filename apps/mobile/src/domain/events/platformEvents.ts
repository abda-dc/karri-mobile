import type { DomainEvent } from "./DomainEvent";

interface ParticipantPayload {
  readonly recipientIds: ReadonlyArray<string>;
}

export type ShipmentCreated = DomainEvent<
  "shipment.created",
  ParticipantPayload & { readonly ownerId: string }
>;
export type TripCreated = DomainEvent<
  "trip.created",
  ParticipantPayload & { readonly ownerId: string }
>;
export type BookingRequested = DomainEvent<
  "booking.requested",
  ParticipantPayload & {
    readonly requestId: string;
    readonly senderId: string;
    readonly travelerId: string;
  }
>;
export type BookingAccepted = DomainEvent<"booking.accepted", ParticipantPayload>;
export type BookingDeclined = DomainEvent<"booking.declined", ParticipantPayload>;
export type BookingCancelled = DomainEvent<"booking.cancelled", ParticipantPayload>;
export type BookingExpired = DomainEvent<"booking.expired", ParticipantPayload>;
export type PackagePickedUp = DomainEvent<"package.picked_up", ParticipantPayload>;
export type PackageDelivered = DomainEvent<"package.delivered", ParticipantPayload>;
export type ShipmentCompleted = DomainEvent<"shipment.completed", ParticipantPayload>;
export type ReviewSubmitted = DomainEvent<
  "review.submitted",
  ParticipantPayload & { readonly revieweeId: string }
>;

export type PlatformDomainEvent =
  | ShipmentCreated
  | TripCreated
  | BookingRequested
  | BookingAccepted
  | BookingDeclined
  | BookingCancelled
  | BookingExpired
  | PackagePickedUp
  | PackageDelivered
  | ShipmentCompleted
  | ReviewSubmitted;

export type PlatformEventType = PlatformDomainEvent["type"];

export function createPlatformEvent<TEvent extends PlatformDomainEvent>(
  event: Omit<TEvent, "id" | "schemaVersion">,
): TEvent {
  return {
    ...event,
    id: `${event.type}:${event.aggregateId}:${event.occurredAt}`,
    schemaVersion: 1,
  } as TEvent;
}
