# Firebase backend configuration

This directory is the version-controlled Firebase backend foundation for Karri Platform v2. It contains Firestore rules, Storage rules, and index definitions. It does not contain service-account keys, deployed Cloud Functions, or a selected Firebase project ID.

## Current access model

- A signed-in user can access their own `users/{uid}` and `profiles/{uid}` documents.
- Shipment/trip owners can create and update their records.
- Any signed-in user can read active shipments/trips for MVP matching.
- Inactive records remain readable to their owner.
- Booking, custody, and review records default to no client access.
- A notification recipient may read their records; only future trusted backend code writes them.
- Storage denies all access until an evidence workflow and tests exist.

Firestore rules do not filter query results. Mobile owner queries constrain `ownerId`, and match queries constrain `status == active`.

## Project setup

1. Create separate Firebase projects for development, preview, and production.
2. Register a Firebase web app for the Expo JavaScript client.
3. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and supply the public project configuration.
4. Enable Anonymous Authentication only for the documented MVP session bridge. Replace it with an approved production sign-in method before a pilot.
5. Create Firestore. Create Storage only when the project plan and access design are ready.
6. Configure Firebase CLI project aliases locally; do not hardcode a personal project ID in source.

## Validation and deployment direction

Before deployment, add Firebase Emulator Suite tests covering allowed and denied cases. A future `firebase.json` should reference these files. Typical reviewed deployment commands will be:

```powershell
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage
```

Do not deploy these first-pass rules to a production project without emulator tests, a data/privacy review, and configured monitoring.
