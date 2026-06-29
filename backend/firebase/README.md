# Firebase backend configuration

This directory is the version-controlled Firebase backend foundation for Karri Platform v2. It contains Firestore rules, Storage rules, and index definitions. It does not contain service-account keys, deployed Cloud Functions, or a selected Firebase project ID.

## Current access model

- A signed-in user can access their own `users/{uid}` and `profiles/{uid}` documents.
- Shipment/trip owners can create and update their records.
- Any signed-in user can read active shipments/trips for MVP matching.
- Inactive records remain readable to their owner.
- Booking requests/bookings are participant-readable and accept only allowlisted actor/state transitions.
- Custody is participant-readable and append-only for an expected actor and booking state.
- Signed-in users may read reviews; completed-booking participants create one deterministic review per direction.
- Notification recipients read/mark their records; validated event actors create deterministic in-app records.
- Trust-score persistence remains denied.
- Storage denies all access until an evidence workflow and tests exist.

Firestore rules do not filter query results. Mobile queries constrain owner, listing status, participant ID, booking ID, review subject, or notification recipient as required by their rule.

## Project setup

1. Create separate Firebase projects for development, preview, and production.
2. Register a Firebase web app for the Expo JavaScript client.
3. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and supply the public project configuration.
4. Enable Anonymous Authentication only for the documented MVP session bridge. Replace it with an approved production sign-in method before a pilot.
5. Create Firestore. Create Storage only when the project plan and access design are ready.
6. Configure Firebase CLI project aliases locally; do not hardcode a personal project ID in source.

## Validation and deployment direction

`firebase.json` references the versioned rules/index files and local Firestore emulator. Add Emulator Suite tests covering every allowed and denied lifecycle case. Typical reviewed deployment commands will be:

```powershell
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage
```

The Milestone 5 rules are an MVP policy boundary while Cloud Functions remain out of scope. Do not deploy them to production without emulator tests, command/idempotency hardening, a data/privacy review, and configured monitoring.
