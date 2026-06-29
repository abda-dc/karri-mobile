# Platform Services

## Purpose

Define the managed services Karri Mobile uses now, the services it intends to add, and the boundary each service must respect.

## Scope

This document covers the Expo mobile runtime, Firebase platform services, source control, documentation hosting, and observability candidates. It does not authorize a service merely by listing it.

## Current implementation

| Service | Purpose | Status |
| --- | --- | --- |
| Expo and React Native | Mobile runtime and development | Active |
| Expo Router | File-based application navigation | Active |
| Firebase Authentication | Identity and persisted mobile session | Active; anonymous MVP bridge only |
| Cloud Firestore | Shipment and trip persistence and realtime reads | Active |
| Cloud Storage | Future evidence storage | Initialized but unused; rules deny access |
| GitHub | Source control and collaboration | Active |
| GitHub Actions | MkDocs validation and publication | Active for documentation only |
| MkDocs Material | Platform handbook | Active |

Firebase is the authoritative backend direction. Firebase initialization, Auth operations, Firestore access, mappers, and repository adapters all live under `apps/mobile/src/infrastructure/firebase`. Existing listing screens still call the narrow infrastructure helper directly until migration behind application services is intentional and tested.

## Design principles

- Add a service only when it improves safety, reliability, delivery speed, or user communication.
- Keep business rules in the domain and application layers; managed services persist or transport outcomes.
- Keep secrets and service-account credentials out of the mobile bundle.
- Treat client devices as untrusted and enforce sensitive commands in rules and trusted backend code.
- Prefer one provider per capability during the MVP.
- Record whether a service is active, initialized, planned, or merely a candidate.

## Future direction

| Service | Intended use | Adoption gate |
| --- | --- | --- |
| Firebase Cloud Functions | Trusted booking, custody, review, notification, and trust commands | Emulator tests and command contracts |
| Firebase Cloud Messaging | Minimal push hints for in-app records | Preferences, privacy copy, token lifecycle, and retries |
| Firebase Remote Config | Validated non-secret operational configuration | Provider adapter and schema validation |
| Firebase App Check | Abuse resistance | Platform configuration and enforcement rollout |
| EAS Build and EAS Update | Signed releases and compatible updates | Release policy and environment separation |
| Sentry | Crash and exception reporting | Privacy review before beta |
| Product analytics | Funnel learning | Event taxonomy, consent, and data-minimization review |
| Uptime monitoring | Function and public health monitoring | A deployed backend surface to monitor |

Every candidate remains replaceable at the application boundary. Firebase-specific code stays in infrastructure so domain rules do not need to change if persistence changes later.

## Out of scope

- Payments, Stripe, mobile money, SMS, chat, and transactional email.
- An admin portal or a second backend platform.
- Claiming that planned Firebase services are deployed.
- Selecting analytics, monitoring, or email vendors in this milestone.

## Related documents

- [Architecture Overview](README.md)
- [Technical Architecture](technical-architecture.md)
- [Repository Pattern](repository-pattern.md)
- [Remote Configuration](remote-config.md)
- [Technology Roadmap](technology-roadmap.md)
- [Firebase ADR](../adr/adr-0002-why-firebase.md)
