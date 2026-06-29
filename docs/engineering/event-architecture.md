# Event Architecture

## Purpose

Events will preserve the fact that an important business transition completed and allow notifications, audit, analytics, and later integrations to react independently. The listing MVP does not yet produce domain events.

## Event envelope

```json
{
  "id": "event-id",
  "type": "booking.requested",
  "aggregateType": "booking",
  "aggregateId": "booking-id",
  "actorId": "firebase-uid",
  "occurredAt": "server timestamp",
  "schemaVersion": 1,
  "payload": {}
}
```

Payloads carry the minimum data needed by consumers. Consumers load sensitive authoritative records only when their authorization and purpose require it.

## Initial event vocabulary

- `booking.requested`
- `booking.accepted`
- `booking.declined`
- `booking.cancelled`
- `custody.picked_up`
- `custody.in_transit`
- `custody.arrived`
- `custody.delivered`
- `review.submitted`
- `trust.updated`

## Production rules

- Emit after a validated state transition in the same trusted operation where practical.
- Use completed-tense business names.
- Treat handlers as at-least-once and idempotent.
- Store a handler receipt or deterministic effect key for side effects.
- Version schemas instead of changing old meaning.
- Do not use an event as the sole source of current screen state in the early architecture.
- Avoid package content, contact details, tokens, and evidence URLs in payloads.

## Failure handling

Retries should use exponential backoff and a bounded attempt policy. Persistent failures need an observable dead-letter or failed-effect record and an operations runbook before event-driven notification delivery is considered production-ready.
