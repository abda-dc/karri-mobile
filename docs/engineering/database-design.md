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
| `custodyEvents` | Participants read by booking or shipment; expected actor appends deterministic shipment-linked events; update/delete denied |
| `reviews` | Signed-in reads; completed-booking participant creates deterministic record; update/delete denied |
| `notifications` | Recipient reads/marks read; validated event actor creates deterministic record |
| `notificationPreferences` | Owner reads/writes validated channel, category, and quiet-hours settings |
| `identityVerifications` | Owner reads; client creates/edits a draft and submits; review states are trusted-server only |
| `trustScores` | Denied; authoritative persistence remains future work |

## Booking records

A deterministic shipment/trip key creates one request and one pending booking in a Firestore batch. Booking documents include `statusHistory`, whose prior entries remain unchanged and whose final entry must match the new status and authenticated actor. Request and booking outcomes update together for accepted, declined, or cancelled states.

Rules re-read linked shipment/trip records to validate owners, active state, exact corridor fields, and capacity. Sensitive core identifiers and creation time are immutable.

## Custody and review records

New custody events store `bookingId`, `shipmentId`, type, performer, server timestamp, optional location/note, and allowlisted booking-status metadata. Firestore verifies that the shipment belongs to the booking, the deterministic ID is `bookingId__eventType`, and the required predecessor event exists. There is no destructive write path.

Historical events without `shipmentId` remain readable through booking-scoped queries. They are intentionally absent from shipment-scoped queries until an explicit, reviewed backfill is performed.

Reviews use `bookingId__reviewerId__revieweeId` as the document ID to enforce one review per direction. Comments may be empty and are limited to 1,000 characters.

## Notifications

Notification IDs derive from event type, related entity, and recipient. Records store recipient `userId`, template text, event type, related entity type/ID, unread/read status, and timestamps. The composite `userId ASC, createdAt DESC` index supports the Profile watcher.

Future trusted delivery may add server-only `domainEvents`, `pushRegistrations`, and `notificationDeliveries` collections. They do not exist in the current schema or rules. Their proposed IDs, access boundaries, privacy fields, and retention are defined in [Notification Delivery](../architecture/notification-delivery.md).

## Identity verification

`identityVerifications/{userId}` holds one metadata-only aggregate per user. It includes the finite workflow state, derived level, allowlisted document metadata, append-only status events, and audit timestamps. Document bytes, base64, OCR output, document numbers, and public evidence URLs are not valid fields.

The client may create an empty draft, edit document metadata while draft, and submit it. It may not write review states or review-only fields. Storage remains deny-all, so client records cannot claim an uploaded object yet. See [Identity Verification](../architecture/identity-verification.md).

## Time and query shapes

Firestore server timestamps remain authoritative for document audit fields and custody events. Domain status-history timestamps are converted to Firestore timestamps and constrained to typed append entries.

Participant booking screens run separate `senderId == uid` and `travelerId == uid` queries and merge by ID. Custody queries constrain `bookingId` or `shipmentId`; reviews constrain `bookingId` or `subjectId`; notifications constrain recipient and order newest-first. Identity verification uses a direct owner-document lookup and requires no collection query.

## Production hardening

The current rules are an MVP policy boundary. Emulator allow/deny tests, Cloud Function transactions, command idempotency, capacity reservation, durable events, and privacy review remain required before production deployment.

See [Booking Lifecycle](../product/booking-lifecycle.md), [Custody Model](../architecture/custody-model.md), [Shipment Timeline](../architecture/shipment-timeline.md), and [Repository Pattern](../architecture/repository-pattern.md).
