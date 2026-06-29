# Custody Model

## Purpose

Define the immutable custody record, lifecycle integration, and participant policy.

## Scope

Custody records cover booking association, event type, server timestamp, performer, optional location/note, and schema-controlled metadata.

## Current implementation

`CustodyEvent` remains plain readonly TypeScript. `CustodyRepository` exposes `append`, `listByBooking`, and `watchByBooking`; it exposes no update/delete operation. `FirebaseCustodyRepository` uses Firestore server timestamps and chronological client ordering.

Booking actions append Shipment Created, Traveler Accepted, Pickup Confirmed, Delivery Confirmed, and Completed. `CustodyService` lets only the traveler append Airport Departure and Airport Arrival while in transit, prevents duplicates, and requires departure before arrival.

Tracking renders timestamp, actor, label, location, and note. Firestore rules repeat participant, actor, booking-state, field-size, and append-only checks.

## Design principles

- Corrections are future appended facts, never mutation.
- Server time is authoritative.
- Event order follows booking lifecycle.
- Exact coordinates are not collected by default.
- Notes remain optional, bounded, and free of private contact data.
- A recorded event is evidence of a platform action, not proof of physical reality.

## Future direction

Move the current atomic Firestore batches behind Cloud Function commands. Add allow/deny emulator tests, evidence references, correction linkage, retention policy, and explicit server-confirmed/pending UI states.

## Out of scope

- Custody edits/deletes, QR handoff, uploads, continuous location, disputes, and exception workflows.

## Related documents

- [Chain of Custody](../product/chain-of-custody.md)
- [Booking State Machine](booking-state-machine.md)
- [Repository Pattern](repository-pattern.md)
- [Chain of Custody ADR](../adr/adr-0006-why-chain-of-custody.md)
