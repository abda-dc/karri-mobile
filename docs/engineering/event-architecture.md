# Event Architecture

## Purpose

Events preserve the fact that an important business transition completed and let notifications, audit, analytics, and later integrations react independently.

## Current local implementation

Milestone 4 introduces a synchronous, in-memory `EventBus` and typed domain events. Shipment, Trip, Booking, and Review services publish after repository persistence. `NotificationService` can subscribe and materialize in-app records when a composition root starts it.

The bus has no network, Firebase, React, or Expo dependency. It is not durable, is not started by the current UI, and does not make unfinished Firestore writes legal.

## Event envelope

```json
{
  "id": "booking.accepted:booking-id:timestamp",
  "type": "booking.accepted",
  "aggregateId": "booking-id",
  "actorId": "participant-or-system-id",
  "occurredAt": "ISO timestamp",
  "schemaVersion": 1,
  "payload": {
    "recipientIds": ["firebase-uid"]
  }
}
```

## Current vocabulary

- `shipment.created`
- `trip.created`
- `booking.requested`
- `booking.accepted`
- `booking.declined`
- `booking.cancelled`
- `booking.expired`
- `package.picked_up`
- `package.delivered`
- `review.submitted`

## Production direction

Trusted functions will record durable events after validated transactional changes. Durable handlers use deterministic effect IDs, at-least-once semantics, bounded retries, observability, and failed-effect storage. Payloads remain minimal; consumers load authorized records when needed.

## Rules

- Use completed-tense business language.
- Publish only after persistence succeeds.
- Version schemas rather than changing old meaning.
- Never include package content, contact details, tokens, or evidence URLs by default.
- Do not use local events as the sole source of authoritative screen state.
- Treat push as a reaction, not the system of record.

See [Event Bus](../architecture/event-bus.md), [Application Services](../architecture/application-services.md), and [Event Architecture ADR](../adr/adr-0004-why-event-architecture.md).
