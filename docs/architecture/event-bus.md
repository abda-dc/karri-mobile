# Event Bus

## Purpose

Describe the lightweight in-process event mechanism used to decouple application services from reactions such as in-app notification creation.

## Scope

This document covers the synchronous local bus, event vocabulary, subscription lifecycle, and its distinction from future durable server events.

## Current implementation

`apps/mobile/src/domain/events/EventBus.ts` provides:

- `publish(event)`
- `subscribe(eventType, handler)`
- `unsubscribe(eventType, handler)`

Publication is synchronous, in memory, and dependency-free. Subscriptions return an unsubscribe callback. The platform event union currently includes `ShipmentCreated`, `TripCreated`, `BookingRequested`, `BookingAccepted`, `BookingDeclined`, `BookingCancelled`, `BookingExpired`, `PackagePickedUp`, `PackageDelivered`, and `ReviewSubmitted` using completed-tense string types.

`NotificationService` subscribes to these facts and creates in-app notification records through `NotificationRepository` when explicitly started. Nothing starts it in the current UI, and current Firestore rules deny client notification writes.

## Design principles

- Events describe completed facts, not requests to perform work.
- Business services publish; notification behavior does not live inside business rules.
- Local handlers run synchronously, while asynchronous side effects handle their own failures.
- Subscribers must unsubscribe when their composition root stops.
- Event payloads carry minimal identifiers and recipient IDs, not private package content.
- The local bus is not a durable audit log or cross-device transport.

## Future direction

Trusted Cloud Functions will record versioned durable events in the same transaction as sensitive state changes where practical. Durable consumers will use idempotent effect keys, retries, monitoring, and failed-effect handling. The in-process bus can remain for local composition and tests without pretending to replace server delivery.

## Out of scope

- Network delivery, replay, queues, dead-letter storage, or cross-process guarantees.
- Push, email, and SMS transports.
- Starting notification handlers before write authorization exists.

## Related documents

- [Application Services](application-services.md)
- [Event Architecture](../engineering/event-architecture.md)
- [Notifications](../product/notifications.md)
- [Event Architecture ADR](../adr/adr-0004-why-event-architecture.md)
