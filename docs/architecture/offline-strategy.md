# Offline Strategy

## Purpose

Define honest offline behavior for the current Expo/Firebase stack and the gates for adding durable mobile persistence.

## Scope

This document covers authentication persistence, Firestore listener behavior, optimistic and queued writes, conflict policy, retries, and future device validation.

## Current implementation

Firebase Authentication persists the mobile session through AsyncStorage. Firestore is initialized with the modular JavaScript SDK default configuration. Realtime listeners can reuse in-memory data during a running process, and the SDK handles transient network retries, but this repository does not enable or claim durable Firestore persistence across app restarts.

Existing forms wait for Firestore write acknowledgement before showing success. There is no custom mutation queue, offline badge, retry ledger, conflict UI, or sync engine. Milestone 4 intentionally makes no persistence initialization change because durable support must be verified against the exact Expo, React Native, and Firebase SDK combination on devices.

## Design principles

- Never describe in-memory behavior as durable offline storage.
- Preserve server timestamps as authoritative audit time.
- Make optimistic state visually distinguishable from server-confirmed state.
- Use idempotency keys for retryable trusted commands.
- Resolve listing conflicts explicitly; never merge booking or custody authority on the client.
- Keep custody append-only and let trusted transactions reject stale transitions.

## Future direction

1. Build a small device test matrix for iOS and Android development builds.
2. Verify the Firebase SDK's supported persistent-cache path in that environment.
3. Add connection and pending-write indicators before optimistic writes.
4. Queue only idempotent commands with bounded retry and user-visible failure.
5. Use last-write or field-version policy only for owner-controlled drafts.
6. Re-read authoritative booking and custody state after reconnection.
7. Clear private caches on sign-out and document retention behavior.

## Out of scope

- A custom sync engine, background worker, or offline-first booking flow.
- Silent conflict resolution for bookings, custody, reviews, or trust.
- Claiming web SDK behavior is identical on every Expo target.

## Related documents

- [Technical Architecture](technical-architecture.md)
- [Repository Pattern](repository-pattern.md)
- [Mobile Architecture](../engineering/mobile-architecture.md)
- [Authentication](../engineering/authentication.md)
- [Booking State Machine](booking-state-machine.md)
