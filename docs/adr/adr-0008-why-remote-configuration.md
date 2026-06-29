# ADR-0008: Why Remote Configuration

## Status

Accepted — 2026-06-29

## Context

Corridor availability, help text, category lists, capacity guidance, minimum supported versions, and operational messages can change faster than app-store releases. Hardcoding every business-facing value would fragment behavior and slow safe corrections.

## Decision

Use Firebase Remote Config for non-secret, read-only operational values with typed local defaults. Validate fetched values before use and activate them at predictable points. Keep authorization, prices agreed in bookings, prohibited-item enforcement, and other security-critical rules in trusted backend code and persisted records.

## Consequences

- Operations can adjust supported presentation and rollout values without a new binary.
- Safe cached defaults allow the app to start when configuration is unavailable.
- Configuration needs schema ownership, validation, change history, and environment separation.
- Users must see material terms before accepting them; remote changes cannot silently rewrite an existing agreement.
- Secrets never belong in Remote Config.
- Remote Config is planned but not initialized by the current mobile slice.
