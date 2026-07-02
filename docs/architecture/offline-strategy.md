# Offline Strategy

## Purpose

Define honest offline behavior for the current Expo/Firebase stack, including cache durability, queued writes, reconnect synchronization, and failure handling.

## Scope

This document covers authentication persistence, Firestore listener behavior, optimistic and queued writes, conflict policy, retries, and future device validation.

## Current implementation

Firebase Authentication persists the mobile session through AsyncStorage. Firestore cache initialization is platform-specific:

- Expo web uses `persistentLocalCache` with multi-tab coordination, backed by browser IndexedDB where Firebase supports it.
- iOS and Android use an explicit `memoryLocalCache`. The Firebase JavaScript SDK queues writes and retries them while the app process remains alive, but this is not durable storage across a force-close or restart.

`FirebaseOfflineStatusGateway` owns one app-lifetime Expo Network listener. All Firebase repository writes pass through its write tracker, which records pending acknowledgements, marks writes taking longer than 1.5 seconds, and surfaces failures. `OfflineService` and `useOfflineStatus` expose provider-neutral state to the shared screen shell; screens never import Expo Network or Firestore.

The gateway also exposes its current provider-neutral status synchronously through `OfflineService.getStatus`. Matching uses that snapshot only to label a successful ranking result as live, cached, or unknown. It does not convert a failed read into a successful result or claim native cache durability.

Firestore remains the mutation queue. The app does not replay mutations in a second custom queue. On reconnect, the gateway re-enables Firestore networking and waits for writes already accepted by the SDK to reach the backend. Realtime listeners then reconcile server state through the Phase 1 subscriptions.

## User-visible behavior

| Condition | Behavior |
| --- | --- |
| Online write | A short syncing indicator remains until Firestore acknowledges the write. |
| Slow write | After 1.5 seconds, the indicator explains that Karri is still syncing and offers a safe queue retry. |
| Offline on web | Available IndexedDB data remains visible and writes stay queued for reconnect. |
| Offline on native | In-process cached data remains visible and writes stay queued only while Karri remains open. |
| Reconnect | Firestore networking resumes, pending acknowledgements are awaited, and realtime listeners reconcile state. |
| Rejected write or conflict | The existing action error remains visible, form input stays intact, and the user may retry the action after reviewing refreshed state. |

The manual **Retry sync** action does not replay a booking, custody, or listing mutation. It only asks Firestore to resume its existing queue and waits for those pending writes, avoiding duplicate commands.

## Optimistic UI policy

Optimistic state is a screen-local projection of user intent, not a second persistence layer:

- Home marks a booking request pending immediately and replaces that marker with confirmed feedback only after `BookingService.request` succeeds. Failure removes the marker and preserves the error.
- Tracking keeps the canonical booking status and custody timeline listener-driven. Accept, decline, cancel, pickup, delivery, and completion display a separate pending target and disable all other lifecycle actions until the service promise settles.
- Custody records are never fabricated locally. Firestore's existing local snapshot may surface an accepted queued event, while the pending lifecycle banner remains until acknowledgement.
- Review submission locks the form with a pending banner. Success inserts the returned review once by ID; failure restores the unchanged rating and comment.
- Notification read state uses a reversible local pending marker. Success is reconciled into the subscribed list; failure removes the marker and Firestore rolls back any rejected local write.

No optimistic path manually replays a mutation. Phase 2 write tracking and Firestore's queue remain responsible for reconnect behavior, while Phase 1 subscriptions remain canonical for stored records.

## Design principles

- Never describe native in-memory behavior as durable offline storage.
- Preserve server timestamps as authoritative audit time.
- Make optimistic state visually distinguishable from server-confirmed state.
- Let the Firebase SDK retry its own accepted writes; do not layer an ambiguous client mutation replay on top.
- Resolve listing conflicts explicitly; never merge booking or custody authority on the client.
- Keep custody append-only and let trusted transactions reject stale transitions.

## Conflict and retry policy

- Network loss does not immediately fail a Firestore write; the SDK keeps the acknowledgement pending and resumes after reconnect.
- Permanent authorization, validation, and state conflicts are not automatically replayed.
- Booking and custody retries re-read authoritative state through their existing services before attempting a new command.
- Owner-controlled records retain Firestore's documented last-write behavior; multi-party booking/custody rules remain authoritative.
- Server timestamps remain the audit time after synchronization.

## Limitations and follow-up

1. Validate queue survival, reconnect timing, and IndexedDB fallback on the supported device/browser matrix.
2. Native durable Firestore persistence requires a supported native persistence adapter or SDK decision; the current JavaScript SDK path is memory-only.
3. Clear or partition browser private caches on sign-out before handling higher-sensitivity production accounts.
4. Add Emulator Suite tests for reconnect conflicts and denied writes when the project adopts an integration-test pattern.
5. Move sensitive commands to idempotent trusted transactions before production; no client queue can replace that boundary.

The beta device/reconnect acceptance gates are tracked in [Release Hardening](../engineering/release-hardening.md). A successful TypeScript or documentation build is not evidence that native queue survival or account-change cache handling has been tested.

## Out of scope

- A custom sync engine, durable native command ledger, background worker, or offline-first booking flow.
- Silent conflict resolution for bookings, custody, reviews, or trust.
- Claiming web SDK behavior is identical on every Expo target.

## Related documents

- [Technical Architecture](technical-architecture.md)
- [Repository Pattern](repository-pattern.md)
- [Mobile Architecture](../engineering/mobile-architecture.md)
- [Authentication](../engineering/authentication.md)
- [Booking State Machine](booking-state-machine.md)
