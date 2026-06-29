# ADR-0006: Why Chain of Custody

## Status

Accepted — 2026-06-29

## Context

The central trust question in peer-to-peer delivery is who possessed the package at a given time and what evidence supports a handoff. A mutable status field alone cannot distinguish a legitimate transition from an overwrite or explain disagreements.

## Decision

Represent custody as an append-only collection of events tied to a booking. Cloud Functions will validate the participant, expected prior state, event type, timestamp, and permitted evidence before append. The booking may hold a derived current status for efficient display, but custody events remain the audit history.

Milestone 5 implements an append-only MVP timeline guarded by application rules and Firestore participant/state policy. No update or delete path exists. Trusted transactional functions, deterministic effect IDs, evidence policy, and correction linkage remain future hardening.

## Consequences

- Participants and support can reconstruct the package journey.
- Incorrect entries are corrected by a linked compensating event, not destructive editing.
- Evidence uploads need restricted Storage paths, integrity metadata, retention, and privacy controls.
- Offline handoffs require careful pending-state and server-time design.
- Event ordering and duplicate submission must be handled explicitly.
- Custody evidence improves accountability but cannot prove facts beyond the quality of the captured evidence.
