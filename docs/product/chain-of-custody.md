# Chain of Custody

## Purpose

Chain of custody shows who recorded responsibility-related events, when, and with what optional context. It is an audit-friendly platform record, not proof of physical reality.

## Current implementation

Tracking displays a compact current-custody summary and a chronological shipment timeline with timestamp, actor, event label, optional location, and optional note. The same records also contribute custody entries to the combined Activity Feed. The implemented event vocabulary is:

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
- `ShipmentTimelineRepository` reads the same immutable events by shipment; it does not persist a parallel history.
- Firestore rules deny every custody update and delete.
- The custody state helper prevents duplicate or backward travel events and requires departure before arrival.
- Rules require an authenticated booking participant, expected actor, compatible booking state, deterministic event ID, matching shipment link, predecessor event, server timestamp, allowlisted metadata, and bounded note/location fields.
- Custody history is separate from status history; informational airport events do not change booking status.

## Current limitations

Booking request/state changes and their lifecycle custody event are written in the same Firestore batch with deterministic custody IDs. In-app notification effects remain asynchronous. Production hardening still requires Cloud Function command transactions, allow/deny emulator tests, evidence policy, and correction-link semantics.

New events also contain `shipmentId`, which enables a shipment-scoped timeline without duplicating the custody record. The sender view uses that shipment-scoped application service and filters the projection to the current booking. The traveler view keeps the participant-safe booking query and narrows shipment-linked events to the same `ShipmentLifecycleEvent` projection. Both views keep the complete booking-scoped query for custody summary/history, so historical records remain visible there; they require an explicit backfill before they can appear in the shipment timeline.

Evidence uploads, QR handoff, exact geolocation, disputes, and deletion remain out of scope.

See [Custody Model](../architecture/custody-model.md), [Booking Lifecycle](booking-lifecycle.md), and [Chain of Custody ADR](../adr/adr-0006-why-chain-of-custody.md).
