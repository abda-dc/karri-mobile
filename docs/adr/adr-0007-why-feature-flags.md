# ADR-0007: Why Feature Flags

## Status

Accepted — 2026-06-29

## Context

Karri will learn corridor by corridor. Features such as booking, evidence upload, or reviews may be ready for a pilot population before they are safe or operationally supported everywhere. Releasing a new binary for every exposure change is slow and risky.

## Decision

Use named feature flags to control staged client exposure by environment, app version, corridor, or cohort. Defaults in the shipped app must be safe when configuration cannot be fetched. A flag hides or enables a user path; it does not grant data permission or bypass backend validation.

## Consequences

- Features can be rolled out gradually and disabled during an incident.
- Every flag needs an owner, purpose, default, observability, and removal date.
- Tests must cover both enabled and disabled paths for active flags.
- Stale flags create complexity and must be removed after rollout decisions.
- Backend authorization remains mandatory even when a client feature is hidden.
- No feature-flag SDK is added in the current listing slice; the ADR defines the future control.
