# Database Design

## Principles

Firestore collections use flat top-level records for the MVP. Documents carry explicit participant or owner identifiers, status, and server timestamps. Domain models do not import Firestore types; infrastructure mappers translate provider timestamps and legacy field names.

## Collections

| Collection | Ownership / access | Current status |
| --- | --- | --- |
| `users` | User reads/writes own account document | Domain model, mapper, repository skeleton, and rules draft |
| `profiles` | User reads/writes own profile; trust field protected | Domain model, mapper, repository skeleton, and rules draft |
| `shipments` | Owner writes; signed-in users read active records | Implemented helpers/rules plus repository adapter |
| `trips` | Owner writes; signed-in users read active records | Implemented helpers/rules plus repository adapter |
| `bookingRequests` | Future participants through trusted command | Domain/application foundation; client access denied |
| `bookings` | Future participants read; trusted code writes lifecycle | Domain/application foundation; client access denied |
| `custodyEvents` | Future append-only trusted writes | Append/read repository foundation; client access denied |
| `reviews` | Future eligible booking participants | Domain/application foundation; client access denied |
| `notifications` | Recipient reads; trusted handler writes | Domain/application foundation; client writes denied |
| `trustScores` | Trusted calculation reads/writes | Repository foundation; default rules deny access |

No security-rule or index expansion is included in Milestone 4. A compile-safe repository does not grant runtime access.

## Domain and Firestore mapping

Portable domain timestamps are ISO strings or `null`. Firestore mappers convert them to/from `Timestamp` and use server timestamps for new or updated records. Field-name differences are explicit: notification `recipientId` maps to Firestore `userId`, review `revieweeId` maps to `subjectId`, and user/profile document IDs remain Firebase UIDs.

Existing UI imports from `src/types/models.ts` resolve to provider-independent domain aliases during the listing-flow migration. New service code depends directly on models under `src/domain`.

## Shipment

Core fields are `id`, `ownerId`, origin/destination country and city, package category, description, weight in kilograms, delivery window, reward amount/currency, status, and audit timestamps.

## Trip

Core fields are `id`, `ownerId`, origin/destination country and city, departure and arrival `YYYY-MM-DD` values, available capacity in kilograms, notes, status, and audit timestamps.

## Booking and custody

A booking request and pending booking are created as one repository operation. Production creation and transitions will run transactionally in a Cloud Function. Custody exposes append/read only; no update or delete contract exists.

## Time and money

Firestore server timestamps are authoritative for persisted audit fields. Calendar dates remain strings until airport timezone requirements exist. Reward input remains a numeric MVP amount with currency; production money should use integer minor units after pricing requirements are settled.

## Query shapes

- Owned shipments or trips: `ownerId == auth.uid`, ordered newest-first.
- Matching inventory: `status == active`, ordered newest-first and bounded.
- Custody: `bookingId == target`, ordered chronologically in the adapter until an approved index exists.
- Reviews and notifications: participant-scoped queries only after rules and indexes are reviewed.

## IDs and deletion

Firestore creates current listing IDs and repository-skeleton lifecycle IDs. The current UI exposes no deletion. Lifecycle records are retained or soft-closed according to future policy; custody history is never destructively edited.

See [Domain Model](../architecture/domain-model.md), [Repository Pattern](../architecture/repository-pattern.md), and [Custody Model](../architecture/custody-model.md).
