# Authorization

## Model

Firebase Authentication proves which account is making a request. Firestore and Storage rules decide which data that account may access. Future Cloud Functions add command-level participant and state validation.

## Current rules

- `users/{uid}` and `profiles/{uid}` are accessible only when `request.auth.uid == uid`; identity ownership is immutable, and clients cannot assign or change `trustScore`.
- A shipment or trip can be created only with `ownerId == request.auth.uid`.
- Owners can update their own shipment/trip while owner and creation time remain immutable.
- Signed-in users can read active shipment/trip records for matching.
- Owners can read their own inactive records.
- Booking requests/bookings are participant-readable; only the expected sender/traveler can perform an allowlisted forward transition.
- Custody events are participant-readable and append-only for the expected actor/state.
- Completed-booking participants create one deterministic review per direction; updates/deletes are denied.
- Notification recipients read/mark their own records; validated event actors create deterministic in-app records.
- `trustScores` and client profile trust mutation remain denied.

## Query/rule relationship

Firestore rules do not filter result sets. An owner list query must constrain `ownerId` to the current UID, and a marketplace query must constrain `status` to `active`. A broad collection read will be rejected even if every currently stored document would happen to be visible.

## Future participant authorization

The current rules implement participant membership and expected transitions for the MVP. Production Cloud Functions will add transactional command validation, idempotency, durable events, and capacity coordination without broadening client permissions.

## Administrative access

No admin client or broad admin rules exist. Future operational access should use custom claims, least-privilege tooling, auditable actions, and server-side access—not a hidden mobile screen.
