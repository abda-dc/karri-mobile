# Trust Score

## Product promise

Karri trust is explainable decision support. It summarizes specific evidence that may help a user ask better questions; it does not guarantee safety, identity, delivery, legality, or a successful transaction.

## Current MVP presentation

The version-1 client calculation appears on Profile, trip cards, route matches, and booking participant summaries. Full Profile presentation shows:

- the bounded score or `New` for users with no completed-delivery/review history;
- the evidence scope and formula version;
- named positive, missing, and cautionary factors;
- the exact points and explanation from every visible rule;
- transparent guidance about what can add evidence; and
- a reminder that the result is not a safety guarantee.

Compact cards intentionally show less detail. Other-user cards use visible completed-review evidence rather than claiming access to private history; current-user cards may include authorized account context supplied by their screen.

## Factors

- Completed deliveries: up to 40 points.
- Cancellations: up to a 25-point deduction when participant history is available.
- Average eligible review: up to 25 points.
- Account age: up to 15 points for the current user.
- Identity verification: one factor worth 0, 10, or 20 points.

Basic identity verification means draft, submitted, or under review and contributes limited evidence. Only a currently verified identity receives the full identity factor. Unverified, rejected, expired, and revoked states contribute zero. Identity never multiplies behavioral evidence or makes a safety claim.

## Privacy boundary

The current user's Profile may use participant-visible bookings, account creation time, eligible reviews, and its own self-readable identity level. Other-user cards use reviews-only evidence. They do not read or infer private identity status, account age, cancellations, or participant history.

Missing private context must not be presented as a known zero. Reviews-only cards therefore label their scope and omit explanations for evidence the client cannot access.

## Current authority boundary

The displayed score is a client-calculated MVP projection, not authoritative persisted trust. `trustScores` remains denied by Firestore rules, and clients cannot update profile trust fields. The calculation is deterministic, bounded 0–100, and versioned, but the client remains an untrusted presentation environment.

Production requires trusted server calculation backed by durable evidence references and a privacy-reviewed public projection.

## Future policy work

Before production trust influences material decisions, Karri must define evidence freshness and decay, role semantics, corrections and appeals, exception policy, abuse monitoring, bias/fairness review, user-facing change notices, and rollback/backfill procedures. Future reviewer, KYC, and evidence-upload workflows remain separate and deferred.

See [Trust Engine](../architecture/trust-engine.md), [Identity Verification](../architecture/identity-verification.md), [Reviews](reviews.md), and [Trust Score ADR](../adr/adr-0005-why-trust-score.md).
