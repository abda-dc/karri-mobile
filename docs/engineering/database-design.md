# Database Design

## Principles

Firestore collections use flat top-level records for the MVP. Documents carry explicit participant or owner identifiers, status, and server timestamps. Denormalization is allowed for stable display values when it avoids fragile client joins, but authoritative identifiers remain present.

## Collections

| Collection | Ownership / access | Current status |
| --- | --- | --- |
| `users` | User reads/writes own account document | Model and rules draft |
| `profiles` | User reads/writes own profile document | Model and rules draft |
| `shipments` | Owner writes; signed-in users read active records | Implemented helper and rules |
| `trips` | Owner writes; signed-in users read active records | Implemented helper and rules |
| `bookingRequests` | Future participants via trusted command | Model only; client access denied |
| `bookings` | Future participants read; server writes lifecycle | Model only; client access denied |
| `custodyEvents` | Future append-only trusted writes | Model only; client access denied |
| `reviews` | Future eligible booking participants | Model only; client access denied |
| `notifications` | Recipient reads; server writes | Model and recipient-read rule draft |

## Shipment

Core fields are `id`, `ownerId`, origin/destination country and city, package category, description, weight estimate in kilograms, desired delivery window, reward offer and currency, `status`, `createdAt`, and `updatedAt`.

## Trip

Core fields are `id`, `ownerId`, origin/destination country and city, departure and arrival dates as ISO `YYYY-MM-DD` strings, available capacity in kilograms, optional notes, `status`, `createdAt`, and `updatedAt`.

## Time and money

Firestore server timestamps are authoritative for audit fields. Trip and delivery-window values are currently calendar strings because the MVP does not yet model airport timezone or exact departure instants. Reward input is a numeric amount with a fixed MVP display currency; production money should move to integer minor units plus an explicit currency after pricing requirements are settled.

## Query shapes

- Owned shipments: `ownerId == auth.uid`, ordered newest-first by `createdAt`.
- Owned trips: `ownerId == auth.uid`, ordered newest-first by `createdAt`.
- Matching inventory: `status == active`, ordered newest-first and limited to 100 shipments and 100 trips.

Composite indexes are drafted for owner/status plus creation time so server-side ordering can be introduced without redefining data.

## IDs and deletion

Firestore creates listing IDs. The current slice does not expose deletion. Future lifecycle records should be retained or soft-closed according to policy; custody history is never destructively edited through the client.
