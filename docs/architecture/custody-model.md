# Custody Model

## Purpose

Define the immutable chain-of-custody domain record and persistence contract.

## Scope

The model covers custody event identity, booking association, event type, timestamp, performer, optional location label, metadata, and append/read behavior.

## Current implementation

`CustodyEvent` is a readonly plain TypeScript model with:

- `id`
- `bookingId`
- `eventType`
- `timestamp`
- `performedBy`
- `location`
- `metadata`

Supported foundation types are Shipment Created, Traveler Accepted, Pickup Confirmed, Airport Departure, Airport Arrival, Delivery Confirmed, and Completed. `CustodyRepository` exposes only `append` and `listByBooking`. `FirebaseCustodyRepository` maps to `custodyEvents` and contains no update or delete method.

The repository is not wired to UI, and current Firestore rules deny all custody access. A repository shape demonstrates immutability but does not make a mobile append authoritative.

## Design principles

- History is append-only; corrections append a linked fact instead of mutating history.
- Server time is authoritative for persisted events.
- The performer must be an eligible participant for the expected transition.
- Location is an optional human-readable label; exact coordinates are not collected by default.
- Metadata remains minimal, non-secret, and schema-controlled.
- Reads are ordered chronologically for a booking.

## Future direction

Implement a trusted append command that validates booking state, actor, event order, idempotency, and evidence references in one transaction. Add participant-only reads, Emulator Suite tests, correction linkage, evidence retention rules, and UI language that distinguishes submitted from server-confirmed events.

## Out of scope

- Deleting or updating custody history.
- Evidence uploads, QR handoff, geolocation tracking, or dispute resolution.
- Enabling client writes in this milestone.

## Related documents

- [Chain of Custody](../product/chain-of-custody.md)
- [Booking State Machine](booking-state-machine.md)
- [Repository Pattern](repository-pattern.md)
- [Chain of Custody ADR](../adr/adr-0006-why-chain-of-custody.md)
