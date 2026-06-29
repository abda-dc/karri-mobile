# Chain of Custody

## Purpose

Chain of custody answers: who was responsible for the package, during which period, and what evidence supports each handoff? It is a record of claimed and confirmed events, not an absolute guarantee about physical reality.

## Current status

The repository includes a typed `custodyEvents` placeholder and deny-by-default client rules. No custody UI, upload, or transition is implemented.

## Planned event sequence

- **Pickup pending:** booking accepted; sender still holds the package.
- **Picked up:** sender-to-traveler handoff recorded.
- **In transit:** traveler confirms journey progress where appropriate.
- **Arrived:** package reached the destination region and delivery is pending.
- **Delivered:** traveler-to-recipient handoff recorded.
- **Exception:** a documented interruption requiring follow-up.

## Event fields

Each event needs an ID, booking ID, actor UID, event type, server timestamp, optional location label, previous-event reference, evidence references, and schema version. Exact coordinates should not be collected by default.

## Integrity rules

- Events are append-only and functions-owned.
- The actor must be an eligible booking participant for the transition.
- The prior booking/custody state must permit the next event.
- Duplicate commands produce one result.
- Corrections link to the earlier event and explain the correction.
- Evidence access is participant-limited and retention-controlled.

## User experience

The timeline should emphasize current responsibility and next action, then allow a user to inspect evidence. It should distinguish pending client submission from server-confirmed custody and avoid implying that a photo alone proves contents or delivery.
