# Firebase backend configuration

This directory is the version-controlled Firebase backend foundation for Karri Platform v2. It contains Firestore rules, Storage rules, index definitions, and callable Cloud Functions. It does not contain service-account keys, Firebase tokens, or private provider credentials.

## Current access model

- A signed-in user can access their own `users/{uid}` and `profiles/{uid}` documents.
- Shipment/trip owners can create and update their records.
- Any signed-in user can read active shipments/trips for MVP matching.
- Inactive records remain readable to their owner.
- Booking requests/bookings are participant-readable and accept only allowlisted actor/state transitions.
- Custody is participant-readable and append-only for an expected actor and booking state. New writes require a matching shipment link, deterministic ID, allowlisted metadata, and required predecessor event.
- Signed-in users may read reviews; completed-booking participants create one deterministic review per direction.
- Notification recipients read/mark their records; validated event actors create deterministic in-app records.
- Signed-in users read and update only their own validated notification preference document; Email/SMS remain disabled placeholders.
- Signed-in users read only their own identity-verification aggregate and may create/edit a draft or submit it; client review outcomes, evidence uploads, audit rewrites, and deletes are denied.
- Trust-score persistence remains denied.
- Storage denies all access until an evidence workflow and tests exist.

Firestore rules do not filter query results. Mobile queries constrain owner, listing status, participant ID, booking ID, review subject, or notification recipient as required by their rule.

Shipment timeline queries constrain `custodyEvents.shipmentId`; they read the same immutable custody records rather than a second collection. They are sender-facing because a shipment may have bookings with different travelers, and Firestore does not filter unauthorized results. Travelers continue to use booking-scoped custody queries. Historical custody records without this additive field remain available only through their booking-scoped query until a reviewed backfill exists.

## Project setup

1. Use the checked-in `development` Firebase alias for the current development project only: `karri-mobile-dev`.
2. Register a Firebase web app for the Expo JavaScript client.
3. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and supply the public project configuration.
4. Enable Anonymous Authentication only for the documented MVP session bridge. Replace it with an approved production sign-in method before a pilot.
5. Create Firestore. Create Storage only after the identity-evidence privacy, retention, authorization, scanning, and rule design is approved; current Storage rules deny all access.
6. Do not add preview or production aliases until those Firebase projects exist and have reviewed ownership.

## Validation and deployment direction

`firebase.json` references the versioned rules/index files, Storage rules, callable Functions, and local emulators. The repository-root validation commands start emulators with the demo-only project ID `demo-karri-mobile`; they do not read the checked-in development alias, operator-selected projects, production credentials, or mobile `.env` files.

```powershell
npm run firebase:validate
npm run firebase:validate:firestore
npm run firebase:validate:storage
npm run firebase:validate:functions
```

Development deploy commands are explicit and narrowly scoped. They always pass `--project development` and therefore resolve only to `karri-mobile-dev` through the checked-in `backend/firebase/.firebaserc` alias:

```powershell
npm run firebase:deploy:development:firestore:rules
npm run firebase:deploy:development:firestore:indexes
npm run firebase:deploy:development:storage
npm run firebase:deploy:development:functions
npm run firebase:deploy:development
```

Do not run broad `firebase deploy` commands. Use the scripts above so predeploy validation runs and the target project is explicit.

## Callable Functions runtime

The current callable Functions are deployed only when `npm run firebase:deploy:development:functions` or the complete development stack command is run. Each callable is configured for `us-east1`, `minInstances: 0`, `maxInstances: 10`, `memory: 256MiB`, and `timeoutSeconds: 60`.

App Check enforcement is intentionally disabled for this development foundation because the mobile rollout policy is not complete yet. This is temporary: before preview or production projects are introduced, define App Check rollout mode, monitoring, and failure handling.

Callable HTTPS functions do not use automatic retry semantics. Clients must treat returned errors as authoritative and retry only after refreshing relevant state.

## Development rollback

Rollback is a redeploy of the previous reviewed source revision to the same explicit development alias.

```powershell
git switch <previous-reviewed-branch-or-tag>
npm run firebase:validate
npm run firebase:deploy:development
```

For a partial rollback, run the narrow deploy script for the surface being restored, such as `npm run firebase:deploy:development:firestore:rules` or `npm run firebase:deploy:development:functions`.

Credentials, Firebase tokens, service-account JSON, signing keys, and provider secrets stay outside Git. Use local ADC, approved Firebase CLI auth, or future workload identity in automation.

## Authorized callable smoke test

After the development stack is deployed, the admin package includes a guarded live smoke tool for `karri-mobile-dev` only. It validates the deployed `placeAdministrativeHold` callable with temporary Auth users and smoke-prefixed Firestore data, then cleans up the shipment, hold, audit log, and users in a `finally` path.

Prerequisites are local user Application Default Credentials from `gcloud auth application-default login`, plus the development Firebase Web API key supplied only through `FIREBASE_WEB_API_KEY`. The live smoke uses Identity Toolkit REST anonymous sign-up for temporary client sessions and Google Secure Token REST to refresh the temporary admin user's claim-bearing ID token. Tokens stay in process memory only and are never logged.

The smoke run creates billable Firebase Auth, Firestore, Cloud Functions, and Cloud Logging operations. Normal usage should be small, but it is not guaranteed free; a $10 budget is only an alert, not a hard spending cap. The ADC identity must be able to get/delete Firebase Auth users created by REST sign-up, set custom claims, revoke refresh tokens, create/read/delete the scoped Firestore smoke documents, and invoke the deployed callable. No service-account JSON key, Firebase CLI token, custom-token signing, or IAM `signBlob` permission is required.

```powershell
$env:FIREBASE_PROJECT_ID="karri-mobile-dev"
$env:KARRI_ALLOW_LIVE_SMOKE="karri-mobile-dev"
$env:FIREBASE_WEB_API_KEY="<development Firebase web API key>"
npm run firebase:smoke:development:callable
```

The command hard-fails for any project other than `karri-mobile-dev`, never logs tokens or credentials, and must not be run from CI until an approved live-smoke environment and credential policy exists.
