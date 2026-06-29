# Trust Engine

## Purpose

Define the simple, explainable trust-calculation foundation introduced in Milestone 4.

## Scope

The engine covers completed deliveries, cancellations, average review, account age, verification level, factor explanations, versioning, and the trusted persistence boundary.

## Current implementation

The pure `TrustCalculator` applies five `TrustRule` objects and clamps the result to `0-100`:

| Factor | Formula | Range |
| --- | --- | ---: |
| Completed deliveries | `min(deliveries, 10) * 4` | 0 to 40 |
| Cancellations | `-min(cancellations, 5) * 5` | -25 to 0 |
| Average review | `average / 5 * 25` when at least one eligible review exists | 0 to 25 |
| Account age | `min(days, 365) / 365 * 15` | 0 to 15 |
| Verification level | none `0`, basic `10`, identity `20` | 0 to 20 |

Every factor returns points and a plain-language explanation. The score records formula version `1` and calculation time. `TrustService` validates inputs and persists through `TrustRepository`.

The calculator is not wired to UI or active backend commands. `FirebaseTrustRepository` is a skeleton for a future `trustScores` collection; current rules deny it through the default rule. No authoritative score is currently displayed.

## Design principles

- A score summarizes eligible evidence; it does not declare a person safe.
- Inputs and factor contributions remain inspectable.
- Cancellations cannot outweigh the entire score, and results stay bounded.
- No protected traits, package value, private messages, or popularity signals are inputs.
- Trusted code calculates and persists authoritative scores.
- Formula changes require a new version, backfill plan, and bias/abuse review.

## Future direction

Define eligible completed-delivery and cancellation evidence, verification semantics, exception handling, role-specific displays, and appeal behavior. Run the calculator in a Cloud Function after durable events, persist source references, and show score context only after product and governance review.

## Out of scope

- Production scoring, automatic identity verification, fraud classification, or dispute outcomes.
- A complex machine-learning model.
- Client-authoritative profile score updates.

## Related documents

- [Domain Model](domain-model.md)
- [Application Services](application-services.md)
- [Trust Score](../product/trust-score.md)
- [Reviews](../product/reviews.md)
- [Trust Score ADR](../adr/adr-0005-why-trust-score.md)
