# Architecture Decision Records

ADRs capture decisions that shape Karri Platform v2. “Accepted” records describe the chosen direction; a consequence may still be future implementation work.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](adr-0001-why-expo.md) | Use Expo for the mobile application | Accepted |
| [0002](adr-0002-why-firebase.md) | Use Firebase as the managed backend platform | Accepted |
| [0003](adr-0003-why-cloud-functions.md) | Put trusted business transitions in Cloud Functions | Accepted |
| [0004](adr-0004-why-event-architecture.md) | Emit durable domain events after important transitions | Accepted |
| [0005](adr-0005-why-trust-score.md) | Build an explainable evidence-based trust score | Accepted |
| [0006](adr-0006-why-chain-of-custody.md) | Preserve an append-only custody history | Accepted |
| [0007](adr-0007-why-feature-flags.md) | Use feature flags for staged exposure | Accepted |
| [0008](adr-0008-why-remote-configuration.md) | Use Remote Config for non-secret operational values | Accepted |
| [0009](adr-0009-hybrid-app-check-callable-transport.md) | Use native App Check with the existing Firebase JavaScript data layer | Accepted |

Superseded decisions should remain in the repository with a new status and a link to the replacing ADR.
