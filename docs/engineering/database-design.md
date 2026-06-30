# Database Design

## Principles

Firestore uses top-level collections with explicit owner/participant IDs, finite statuses, immutable core identifiers, and server timestamps. Infrastructure mappers translate Firestore values to portable domain models.

## Collections

| Collection | Current access and behavior |
| --- | --- |
| `users` | Own account document; foundation only |
| `profiles` | Own profile; clients cannot change reserved trust score |
| `shipments` | Owner writes; signed-in users read active listings |
| `trips` | Owner writes; signed-in users read active listings |
| `bookingRequests` | Sender creates; participants read; allowlisted pending outcome update |
| `bookings` | Sender creates pending record; participants read; role/state-guarded updates |
| `custodyEvents` | Participants read; expected actor appends; update/delete denied |
| `reviews` | Signed-in reads; completed-booking participant creates deterministic record; update/delete denied |
| `notifications` | Recipient reads/marks read; validated event actor creates deterministic record |
| `trustScores` | Denied; authoritative persistence remains future work |

## Booking records

A deterministic shipment/trip key creates one request and one pending booking in a Firestore batch. Booking documents include `statusHistory`, whose prior entries remain unchanged and whose final entry must match the new status and authenticated actor. Request and booking outcomes update together for accepted, declined, or cancelled states.

Rules re-read linked shipment/trip records to validate owners, active state, exact corridor fields, and capacity. Sensitive core identifiers and creation time are immutable.

## Custody and review records

Custody events store `bookingId`, type, performer, server timestamp, optional location/note, and metadata. There is no destructive write path.

Reviews use `bookingId__reviewerId__revieweeId` as the document ID to enforce one review per direction. Comments may be empty and are limited to 1,000 characters.

## Notifications

Notification IDs derive from event type, related entity, and recipient. Records store recipient `userId`, template text, event type, related entity type/ID, unread/read status, and timestamps. The composite `userId ASC, createdAt DESC` index supports the Profile watcher.

Future trusted delivery may add server-only `domainEvents`, `pushRegistrations`, and `notificationDeliveries` collections. They do not exist in the current schema or rules. Their proposed IDs, access boundaries, privacy fields, and retention are defined in [Notification Delivery](../architecture/notification-delivery.md).

## Time and query shapes

Firestore server timestamps remain authoritative for document audit fields and custody events. Domain status-history timestamps are converted to Firestore timestamps and constrained to typed append entries.

Participant booking screens run separate `senderId == uid` and `travelerId == uid` queries and merge by ID. Custody queries constrain `bookingId`; reviews constrain `bookingId` or `subjectId`; notifications constrain recipient and order newest-first.

## Production hardening

The current rules are an MVP policy boundary. Emulator allow/deny tests, Cloud Function transactions, command idempotency, capacity reservation, durable events, and privacy review remain required before production deployment.

See [Booking Lifecycle](../product/booking-lifecycle.md), [Custody Model](../architecture/custody-model.md), and [Repository Pattern](../architecture/repository-pattern.md).
