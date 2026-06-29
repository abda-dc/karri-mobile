# API Design

## Current interfaces

The current mobile listing slice has no HTTP API. Existing screens use typed helpers around Firebase Auth and Firestore to create and subscribe to shipment/trip records.

Milestone 4 adds internal application contracts:

- Presentation-facing service methods for shipment, trip, booking, review, trust, notification, and configuration behavior.
- Domain repository interfaces that contain no Firebase types.
- Firebase/Firestore implementation skeletons and mappers under infrastructure.
- A local event publisher/subscriber contract.

These interfaces are not an authorization boundary. Existing rules still deny booking, custody, review, notification writes, and trust-score records.

## Future command API

Trust-sensitive actions use versioned callable Cloud Functions. Commands accept the minimum identifiers and decisions needed; they do not trust client-supplied owner, status, score, actor, or server timestamps.

```json
{
  "version": 1,
  "idempotencyKey": "client-generated-unique-key",
  "bookingId": "booking-id",
  "expectedStatus": "accepted",
  "action": "start_transit"
}
```

Success returns authoritative IDs and state. Errors use stable codes such as `unauthenticated`, `forbidden`, `invalid-state`, `not-found`, `conflict`, or `rate-limited`, with safe user-facing messages.

## Design rules

- Authenticate and validate App Check when enforcement is enabled.
- Derive actor UID from Firebase Auth.
- Validate size, type, enumeration, participants, and current state.
- Use transactions and idempotency keys for competing commands.
- Record authoritative server timestamps and durable events after success.
- Keep list queries bounded and participant-scoped.
- Map provider data at infrastructure boundaries.
- Document every callable function beside its consuming feature.

REST endpoints remain out of scope until a consumer cannot use callable functions or authorized direct reads.

See [Application Services](../architecture/application-services.md), [Repository Pattern](../architecture/repository-pattern.md), and [Booking State Machine](../architecture/booking-state-machine.md).
