# Backend Architecture

## Current backend surface

The current repository backend is declarative Firebase configuration:

- `backend/firebase/firestore.rules`
- `backend/firebase/storage.rules`
- `backend/firebase/firestore.indexes.json`

The mobile app accesses Auth and Firestore through the Firebase client SDK. There is no deployed custom server or Cloud Function in this slice.

## Direct client operations

Direct writes are limited to records where one authenticated owner controls the content:

- Create and update that user's shipment listing.
- Create and update that user's trip listing.
- Read owned listings.
- Read active shipment/trip inventory for matching.

The owner UID comes from Firebase Auth. Rules verify ownership and the permitted document shape.

## Planned Cloud Function operations

Cloud Functions will own commands that coordinate participants or create trust evidence:

| Command | Why trusted execution is required |
| --- | --- |
| Request booking | Links sender, traveler, shipment, and trip consistently |
| Accept/decline booking | Validates traveler role and current state |
| Record custody | Enforces transition order and append-only evidence |
| Confirm delivery | Prevents unilateral status overwrite |
| Submit review | Verifies completed-booking eligibility |
| Recalculate trust | Protects formula inputs and auditability |
| Dispatch notification | Centralizes templates, preferences, and retries |

## Function conventions

- Verify `context.auth` and App Check when enabled.
- Validate input with an explicit schema.
- Use Firestore transactions for competing state changes.
- Support idempotency keys on user-triggered commands.
- Return stable machine codes plus safe messages.
- Record server timestamps and a versioned event only after success.
- Log identifiers and outcomes, not package descriptions or private evidence.

## Local development direction

The Firebase Emulator Suite should be added with the first function. Rules and function integration tests must run against emulators before backend deployment automation is introduced.
