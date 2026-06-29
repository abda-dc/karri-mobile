# Technology Roadmap

## Purpose

Describe the current Karri Mobile technology stack and the staged path from the implemented listing slice to trusted marketplace workflows.

## Scope

The roadmap covers mobile, domain, application, persistence, trusted execution, configuration, observability, and delivery technology. Product sequencing remains in the product roadmap.

## Current implementation

| Layer | Technology | Status |
| --- | --- | --- |
| Mobile | Expo React Native, React, Expo Router | Active |
| Language | TypeScript with strict checking | Active |
| Presentation state | React state and Firebase listeners | Active; Zustand is not installed |
| Domain | Plain TypeScript models, lifecycle guards, trust rules, domain events | Foundation implemented; not yet wired to screens |
| Application | Shipment, Trip, Booking, Notification, Review, Trust, and Remote Config services | Foundation implemented; not yet wired to screens |
| Authentication | Firebase Authentication | Active; anonymous MVP bridge |
| Database | Cloud Firestore | Active for shipment and trip flows |
| Storage | Cloud Storage | Initialized but unused |
| Persistence adapters | Firebase repository classes and Firestore mappers | Compile-safe skeletons; sensitive writes remain denied |
| Documentation | MkDocs Material | Active |
| Documentation CI | GitHub Actions and GitHub Pages | Active |

The implemented runtime path now uses presentation screens/components, application services, domain rules, repository interfaces, and Firebase adapters. Firestore rules are the current MVP policy boundary; trusted Cloud Function commands remain the production migration path.

## Design principles

- Prefer a small, mobile-first stack with explicit status labels.
- Keep domain models portable and infrastructure-specific code replaceable.
- Use direct client writes only for owner-controlled records protected by Firestore rules.
- Move multi-party and trust-sensitive commands to Cloud Functions.
- Add state, sync, analytics, and deployment tooling only when a real flow needs it.
- Verify compatibility in Expo before enabling native-sensitive Firebase features.

## Future direction

### Stage 1: adopt the application boundary

- Wire existing shipment and trip screens to application services and repository interfaces.
- Keep current user behavior unchanged while removing direct presentation-to-Firestore coupling.
- Add focused unit tests for validators, lifecycle guards, and trust rules.

### Stage 2: trusted booking coordination

- Add callable Cloud Functions and Emulator Suite integration tests.
- Implement idempotent booking request and transition commands.
- Persist durable domain events after successful transactions.
- Enable participant reads with reviewed Firestore rules.

### Stage 3: custody, in-app notifications, and reviews

- Append server-confirmed custody events.
- Materialize in-app notification records from durable events.
- Add eligible completed-booking reviews and moderation foundations.
- Keep push as an optional hint rather than the source of truth.

### Stage 4: configuration, offline hardening, and trust display

- Connect the typed configuration service to Firebase Remote Config.
- Validate durable offline behavior on supported iOS and Android builds.
- Calculate trust in trusted code and display evidence with score context.
- Add App Check, crash reporting, monitoring, and measured rollout controls.

### Stage 5: release maturity

- Introduce EAS build profiles and environment-separated Firebase projects.
- Automate mobile and Firebase verification before approved deployment.
- Add rollback, incident, privacy, retention, and corridor-readiness procedures.

## Out of scope

- A backend migration or second persistence platform.
- Payments, disputes, chat, SMS, AI matching, and mobile money.
- A web application or admin portal.
- Complex trust scoring or production rollout in this milestone.

## Related documents

- [Platform Services](platform-services.md)
- [Technical Architecture](technical-architecture.md)
- [Application Services](application-services.md)
- [Offline Strategy](offline-strategy.md)
- [Product Roadmap](../product/product-roadmap.md)
