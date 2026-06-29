# API Design

## Current interfaces

The current mobile slice has no HTTP API. It uses typed local helpers around Firebase Auth and Firestore:

- Start or reuse the temporary Firebase Auth session.
- Create a shipment or trip for an authenticated UID.
- Subscribe to owned shipments or trips.
- Subscribe to active shipment and trip inventory.

These helpers keep collection names, timestamps, and mapping logic outside screens while staying smaller than a generic data-access framework.

## Future command API

Trust-sensitive actions will use versioned callable Cloud Functions. A command accepts the minimum identifiers and user decisions needed; it does not trust client-supplied owner, status, score, or timestamp fields.

Example shape:

```json
{
  "version": 1,
  "idempotencyKey": "client-generated-unique-key",
  "shipmentId": "shipment-id",
  "tripId": "trip-id",
  "message": "Optional short note"
}
```

Success returns authoritative IDs and state. Errors return stable codes such as `unauthenticated`, `forbidden`, `invalid-state`, `not-found`, `conflict`, or `rate-limited` with safe user-facing messages.

## Design rules

- Authenticate and validate App Check before business logic when enforcement is enabled.
- Do not accept actor UID or server timestamps from clients.
- Validate size, type, enumeration, and cross-record state.
- Make retries safe with idempotency keys and transactions.
- Version inputs/events when compatibility changes.
- Keep list queries bounded and paginated before corridor volume grows.
- Document every callable function next to the feature that consumes it.

REST endpoints are not introduced without a consumer that cannot use Firebase callable functions or direct authorized reads.
