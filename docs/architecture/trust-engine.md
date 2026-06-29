# Trust Engine

## Purpose

Define the bounded, explainable trust calculation and the evidence scopes displayed by the mobile app.

## Scope

The version-1 engine covers completed deliveries, cancellations, average review, account age, verification level, factor explanations, and current visibility limitations.

## Current implementation

The pure `TrustCalculator` applies:

| Factor | Formula | Range |
| --- | --- | ---: |
| Completed deliveries | `min(deliveries, 10) * 4` | 0 to 40 |
| Cancellations | `-min(cancellations, 5) * 5` | -25 to 0 |
| Average review | `average / 5 * 25` with eligible reviews | 0 to 25 |
| Account age | `min(days, 365) / 365 * 15` | 0 to 15 |
| Verification | none `0`, basic `10`, identity `20` | 0 to 20 |

The result is clamped to 0-100 and every rule supplies an explanation. `TrustService.getVisibleSummary` loads eligible reviews and accepts participant-visible booking/account context.

Profile displays full context available to the current account. Trip, match, and booking-participant cards display reviews-only visible evidence for another user. Empty histories display `New`. The calculation is not persisted as authoritative; `trustScores` and profile trust mutation remain denied.

## Design principles

- Never label a person safe.
- Show evidence scope, factors, and counts.
- Do not infer private cancellation/account history for another user.
- Exclude protected traits, package value, private messages, and popularity.
- Version formula changes and keep scores bounded.
- Trusted server code must own future authoritative persistence.

## Future direction

Build a server-generated public trust projection with durable evidence references, role semantics, verified exception policy, appeals, backfill, privacy, and bias/abuse monitoring. Replace reviews-only client summaries when that projection is available.

## Out of scope

- Fraud prediction, safety guarantees, identity-provider integration, complex ML, or client-authoritative trust records.

## Related documents

- [Trust Score](../product/trust-score.md)
- [Reviews](../product/reviews.md)
- [Application Services](application-services.md)
- [Trust Score ADR](../adr/adr-0005-why-trust-score.md)
