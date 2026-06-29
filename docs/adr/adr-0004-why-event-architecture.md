# ADR-0004: Why Event Architecture

## Status

Accepted — 2026-06-29

## Context

One validated action can have several consequences. Accepting a booking may change state, create notifications, update analytics, and establish an audit record. Coupling all consequences into one synchronous mobile request makes the system fragile and hard to extend.

## Decision

Record a durable domain event after each important, validated state transition. Event names use completed business language such as `booking.requested` or `custody.picked_up`. Events include an identifier, type, aggregate reference, actor, server timestamp, schema version, and minimal non-secret payload.

The current direct listing slice does not yet emit domain events. Event production begins with Cloud Function-owned lifecycle operations.

## Consequences

- Notifications, analytics, and audit consumers can evolve without changing the initiating mobile screen.
- Event handlers must be idempotent because delivery may be retried.
- Schemas need versioning and retention decisions.
- State remains the source for current truth; events explain how it changed.
- Sensitive package, identity, or location data should not be copied broadly into event payloads.
- This adds operational complexity only when lifecycle automation is introduced, not to the initial listing forms.
