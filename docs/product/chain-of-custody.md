# Chain of Custody

## Purpose

Chain of custody shows who recorded responsibility-related events, when, and with what optional context. It is an audit-friendly platform record, not proof of physical reality.

## Current implementation

Tracking displays a chronological timeline with timestamp, actor, event label, optional location, and optional note. The implemented event vocabulary is:

- Shipment Created
- Traveler Accepted
- Pickup Confirmed
- Airport Departure
- Airport Arrival
- Delivery Confirmed
- Completed

Booking lifecycle actions append Shipment Created, Traveler Accepted, Pickup Confirmed, Delivery Confirmed, and Completed automatically. While a booking is in transit, the traveler may append Airport Departure and then Airport Arrival.

## Integrity rules

- `CustodyRepository` exposes append/read/watch only; there is no update or delete method.
- Firestore rules deny every custody update and delete.
- The service prevents duplicate travel events and requires departure before arrival.
- Rules require an authenticated booking participant, expected actor, compatible booking state, server timestamp, and bounded note/location fields.
- Custody history is separate from status history; informational airport events do not change booking status.

## Current limitations

Booking request/state changes and their lifecycle custody event are written in the same Firestore batch with deterministic custody IDs. In-app notification effects remain asynchronous. Production hardening still requires Cloud Function command transactions, allow/deny emulator tests, evidence policy, and correction-link semantics.

Evidence uploads, QR handoff, exact geolocation, disputes, and deletion remain out of scope.

See [Custody Model](../architecture/custody-model.md), [Booking Lifecycle](booking-lifecycle.md), and [Chain of Custody ADR](../adr/adr-0006-why-chain-of-custody.md).
