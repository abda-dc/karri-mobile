# Event Architecture

## Current implementation

Application services publish typed completed facts to one synchronous in-memory `EventBus` created by the mobile composition root. `NotificationService` subscribes once and materializes Firestore in-app notifications.

Current events are `shipment.created`, `trip.created`, `booking.requested`, `booking.accepted`, `booking.declined`, `booking.cancelled`, `booking.expired`, `package.picked_up`, `package.delivered`, and `review.submitted`. Notification handlers subscribe only to booking, package, and review events required by Milestone 5.

```json
{
  "id": "booking.accepted:booking-id:timestamp",
  "type": "booking.accepted",
  "aggregateId": "booking-id",
  "actorId": "firebase-uid",
  "occurredAt": "ISO timestamp",
  "schemaVersion": 1,
  "payload": { "recipientIds": ["firebase-uid"] }
}
```

## Delivery behavior

- Services publish only after their primary repository operation succeeds.
- The local bus invokes subscribers synchronously.
- Notification writes begin asynchronously and report failure to the composition root logger.
- Deterministic notification IDs prevent duplicate effects after a retry.
- Firestore rules validate the source state before accepting a notification.

## Limitations and future direction

The bus is not durable and does not provide replay, cross-device delivery, retry queues, atomic business/effect transactions, or dead-letter handling. Cloud Functions should eventually record durable events in trusted transactions and run idempotent consumers.

Payloads remain identifier-only and exclude package content, contact details, tokens, and evidence URLs.

See [Event Bus](../architecture/event-bus.md), [Notifications](../product/notifications.md), and [Event Architecture ADR](../adr/adr-0004-why-event-architecture.md).
