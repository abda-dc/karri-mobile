# Trust Score

## Current status

Milestone 4 adds a pure, versioned TrustRule/TrustCalculator/TrustScore foundation and a TrustService/TrustRepository boundary. The calculator is not connected to UI or a trusted backend trigger. Current Firestore rules do not expose `trustScores`, and clients cannot set the reserved profile trust field.

## Product intent

A future score summarizes eligible platform history. It does not label a person safe, replace judgment, grant authorization, or hide underlying evidence. New users should receive neutral “new” treatment rather than a punitive public number.

## Formula version 1

The foundation uses completed deliveries, cancellations, average eligible review, account age, and verification level. Contributions are individually explained and the result is clamped to 0-100. The exact point formula is documented in [Trust Engine](../architecture/trust-engine.md).

Excluded inputs include protected characteristics, package value, private messages, and social popularity.

## Calculation boundary

`TrustService` validates non-negative counts and review bounds, then asks the pure calculator for a result and persists through `TrustRepository`. Production calculation belongs in trusted code using durable evidence references, a server timestamp, and formula version.

## Explainability

Any display should show eligible journey count, review count, recency, verification meaning, factor contributions, and a “how this works” explanation. Users need a path to inspect and challenge eligible evidence.

## Governance before launch

- Define eligible completion, cancellation, and verified-exception evidence.
- Define identity verification levels and regional availability.
- Decide role-specific scoring, history decay, recovery, and minimum display history.
- Establish appeals, moderation, backfill, bias, abuse, privacy, and retention review.

Until those questions are answered with corridor research, review/history display is safer than exposing the calculated foundation.

See [Trust Engine](../architecture/trust-engine.md), [Reviews](reviews.md), and [Trust Score ADR](../adr/adr-0005-why-trust-score.md).
