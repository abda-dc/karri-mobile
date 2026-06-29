# ADR-0005: Why Trust Score

## Status

Accepted — 2026-06-29

## Context

Senders and travelers need a quick way to interpret account history, but a single unexplained number can create false confidence, penalize new users, and hide the evidence that matters. Karri's long-term marketplace requires reputation without pretending that risk can be eliminated algorithmically.

## Decision

Introduce an explainable trust score only after eligible identity, booking, custody, cancellation, and review signals exist. Display the score with its main contributing signals, history volume, and freshness. Treat it as decision support, never a safety guarantee or sole authorization control.

The current MVP defines a placeholder field but does not calculate or display a scored reputation.

## Consequences

- Users can compare relevant history more quickly while still seeing context.
- New-user treatment, appeals, bias, fraud resistance, and score decay require explicit policy.
- Only server-controlled, auditable inputs may change the score.
- Score formula changes require versioning and monitoring for unintended effects.
- Product copy must avoid labels that declare a person “safe” or “unsafe.”
- The score is deferred until there is enough real behavior to evaluate it responsibly.
