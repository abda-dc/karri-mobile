# Authorization

## Model

Firebase Authentication proves which account is making a request. Firestore and Storage rules decide which data that account may access. Future Cloud Functions add command-level participant and state validation.

## Current rules

- `users/{uid}` and `profiles/{uid}` are accessible only when `request.auth.uid == uid`; identity ownership is immutable, and clients cannot assign or change `trustScore`.
- A shipment or trip can be created only with `ownerId == request.auth.uid`.
- Owners can update their own shipment/trip while owner and creation time remain immutable.
- Signed-in users can read active shipment/trip records for matching.
- Owners can read their own inactive records.
- Booking requests, bookings, custody events, and reviews default to denied until their workflows are implemented.
- Notification recipients may read their own records, while clients cannot create or mutate notifications.

## Query/rule relationship

Firestore rules do not filter result sets. An owner list query must constrain `ownerId` to the current UID, and a marketplace query must constrain `status` to `active`. A broad collection read will be rejected even if every currently stored document would happen to be visible.

## Future participant authorization

Bookings will name sender and traveler UIDs. Participant reads can then require membership, while state transitions remain functions-only. Custody events will validate the actor against both booking participation and the expected transition. Reviews will require an eligible completed booking and one review per reviewer/subject pair.

## Administrative access

No admin client or broad admin rules exist. Future operational access should use custom claims, least-privilege tooling, auditable actions, and server-side access—not a hidden mobile screen.
