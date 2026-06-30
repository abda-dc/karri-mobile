# ADR-0002: Why Firebase

## Status

Accepted — 2026-06-29

## Context

Karri needs authentication, realtime listing data, file storage, push notifications, controlled backend execution, abuse protection, and remotely managed configuration. The early team should spend its effort on corridor behavior and trust workflows rather than operating databases and servers.

## Decision

Use Firebase Authentication, Cloud Firestore, Cloud Storage, Cloud Functions, Firebase Cloud Messaging, App Check, and Remote Config as the managed backend platform. The current code initializes Auth, Firestore, and Storage. Phase 6 adds provider-neutral push contracts and explicit Firebase stubs, but Cloud Messaging, token registration, and push delivery remain uninitialized. Phase 7 stores self-scoped notification preference documents through a domain-owned repository port; this storage does not enable messaging or grant notification permission.

## Consequences

- Managed services reduce initial operations work and integrate well with Expo's JavaScript runtime.
- Firestore listeners make mobile loading and update behavior straightforward.
- Security rules and query shapes must be designed together.
- Firebase configuration is public project metadata; authorization still depends on rules and trusted code.
- Cost, quotas, lock-in, offline behavior, and emulator coverage require active monitoring.
- Data location, retention, and privacy choices must be reviewed before production launch.
- This decision explicitly replaces any earlier Supabase placeholder copy in this fresh project.
