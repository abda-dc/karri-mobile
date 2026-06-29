# ADR-0003: Why Cloud Functions

## Status

Accepted — 2026-06-29

## Context

Shipment and trip owners can safely maintain their own listing fields under Firestore rules. A booking, custody handoff, delivery confirmation, review, notification, or trust update affects multiple users and must not be declared authoritative by one mobile client.

## Decision

Use Firebase Cloud Functions for trust-sensitive commands and server-triggered reactions. Callable functions will validate identity, participants, current state, requested transition, and idempotency before using transactions to update state and record domain events.

The current listing slice does not deploy functions. Direct client writes remain limited to owner-controlled shipment and trip records.

## Consequences

- Business rules have a trusted execution boundary and can be tested independently of the UI.
- Multi-document transitions can be transactional and idempotent.
- Cold starts, regional placement, retries, logging, and runtime upgrades become operational concerns.
- Firestore rules still protect direct data access; functions are not a substitute for rules.
- Function APIs require versioning and compatible client error handling.
- The Firebase emulator suite should be introduced before the first lifecycle function ships.
