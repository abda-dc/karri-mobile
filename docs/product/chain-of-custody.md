# Chain of Custody

## Purpose

Chain of custody answers who recorded responsibility for a package, when, and with what limited context. It is evidence of platform actions, not a guarantee about physical reality.

## Current status

Milestone 4 adds a readonly `CustodyEvent`, an append/read-only repository interface, a Firestore mapper, and `FirebaseCustodyRepository`. No custody UI, upload flow, trusted command, participant rule, or index is enabled. Current Firestore rules deny all access.

## Event sequence foundation

- Shipment Created
- Traveler Accepted
- Pickup Confirmed
- Airport Departure
- Airport Arrival
- Delivery Confirmed
- Completed

The exact product sequence must remain compatible with the booking state machine. Not every informational airport event changes booking status.

## Event fields

Each event has an ID, booking ID, event type, server timestamp, performer UID, optional location label, and schema-controlled metadata. Exact coordinates are not collected by default.

## Integrity rules

- Events are append-only; no update/delete repository methods exist.
- A trusted command validates participant, booking state, expected prior event, and idempotency.
- Corrections append a new linked fact rather than changing an earlier event.
- Evidence access is participant-limited and retention-controlled.
- Pending client intent must be visually distinct from server-confirmed custody.

## Future user experience

The timeline emphasizes current responsibility and next action, then allows authorized evidence inspection. It avoids claiming that a photo, timestamp, or location label alone proves package contents or delivery.

See [Custody Model](../architecture/custody-model.md), [Booking Lifecycle](booking-lifecycle.md), and [Chain of Custody ADR](../adr/adr-0006-why-chain-of-custody.md).
