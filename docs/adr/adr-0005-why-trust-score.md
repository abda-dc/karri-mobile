# ADR-0005: Why Trust Score

## Status

Accepted — 2026-06-29

## Context

Senders and travelers need a quick way to interpret account history, but a single unexplained number can create false confidence, penalize new users, hide missing context, and amplify bias. Karri needs reputation evidence without pretending that algorithmic scoring eliminates risk.

The mobile MVP can calculate a transparent projection from evidence already visible to the user. It cannot be trusted to author or persist an authoritative marketplace reputation record.

## Decision

Use a deterministic, bounded, versioned trust calculation whose rules and contributions are visible. Display evidence scope, counts, positive evidence, missing evidence, cautionary evidence, and formula version. Preserve `New` treatment for accounts without completed-delivery/review history.

Treat identity verification as one evidence source only: in-progress verification may add limited evidence, currently verified identity may add more, and unverified, rejected, expired, or revoked status adds none.

Treat every trust result as decision support, never a safety guarantee, sole authorization control, enforcement outcome, or substitute for user judgment.

For the MVP, calculate the display projection on the client from authorized visible inputs while denying client persistence to `trustScores` and reserved profile trust fields. Move authoritative calculation and public projection to trusted server infrastructure before production reliance.

## Consequences

- Users can inspect why a displayed value changed instead of trusting a black box.
- Private current-user context remains separate from reviews-only evidence shown about another user.
- Formula changes require a new version, migration/backfill planning, monitoring, and user-facing explanation.
- Product copy must not declare a person “safe,” “unsafe,” verified beyond the evidence, or guaranteed to perform.
- Identity evidence cannot overpower delivery/review history or bypass authorization rules.
- Production requires durable evidence references, appeals/corrections, policy ownership, abuse monitoring, and privacy/bias review.
- Reviewer workflows, third-party KYC, OCR, and document upload remain deferred decisions.

## Alternatives rejected

- **Opaque machine-learning score:** insufficient explainability, auditability, and bias controls for the current evidence base.
- **Client-authoritative persisted score:** an untrusted device can manipulate inputs and must not own marketplace reputation.
- **Identity-only trust badge:** identity proof does not establish safe behavior or successful delivery history.
- **No reputation context:** hides useful completed-delivery and review evidence from users making decisions.

## Related documents

- [Trust Engine](../architecture/trust-engine.md)
- [Trust Score](../product/trust-score.md)
- [Identity Verification](../architecture/identity-verification.md)
