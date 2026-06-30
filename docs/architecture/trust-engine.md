# Trust Engine

## Purpose

Define Karri's bounded, deterministic, and explainable trust calculation without turning a score into a safety claim or authorization decision.

## Explainable trust philosophy

Trust is a summary of limited evidence. Every point must come from a named rule, every deduction must be visible, and missing evidence must remain distinguishable from cautionary evidence. The UI retains the underlying counts, formula version, evidence scope, and factor explanations instead of presenting an unexplained number.

The score supports judgment; it does not label a person safe or unsafe, guarantee delivery, replace normal caution, or authorize a marketplace action.

## Version-1 calculation

The provider-neutral `TrustCalculator` applies:

| Factor | Formula | Range |
| --- | --- | ---: |
| Completed deliveries | `min(deliveries, 10) * 4` | 0 to 40 |
| Cancellations | `-min(cancellations, 5) * 5` | -25 to 0 |
| Average eligible review | `average / 5 * 25` when reviews exist | 0 to 25 |
| Account age | `min(days, 365) / 365 * 15` | 0 to 15 |
| Identity verification | none `0`, basic `10`, verified identity `20` | 0 to 20 |

The sum is clamped to 0–100 and stored with `formulaVersion: 1`. The calculator is pure: identical inputs and calculation time produce the same score and factor results. `TrustService` derives account age from its injected clock and supplies that same timestamp to the calculator.

Each rule emits its points and plain-language explanation. Presentation groups those results as positive, missing, or cautionary evidence and can show focused improvement guidance without changing the score.

## Identity as one evidence source

Identity verification is exactly one factor, not a multiplier or shortcut around behavioral evidence:

| Verification state | Trust input | Points |
| --- | --- | ---: |
| `draft`, `submitted`, `under_review` | `basic` | 10 |
| `verified` | `identity` | 20 |
| `unverified`, `rejected`, `expired`, `revoked` | `none` | 0 |

The identity domain derives these levels from its state machine. Starting verification provides limited evidence only; it does not mean identity has been proven. Failed, stale, or revoked verification adds nothing. The factor explanation states the exact contribution.

## Evidence and privacy scopes

`TrustService.getVisibleSummary` supports two explicit scopes:

- `participant_history`: current-user surfaces may supply authorized private context such as participant bookings, Firebase Auth account creation time, and the self-readable identity level, alongside eligible reviews.
- `reviews_only`: another user's card uses visible eligible review evidence. It does not read or infer that person's private identity status, cancellation history, account age, or participant history.

The presentation filters reviews-only explanations to evidence actually visible in that scope. Empty completed-delivery and review history displays `New` instead of a punitive `0/100` badge.

## Authority boundary

The current value is an on-device MVP projection. It is useful for validating the formula and explainability, but it is not an authoritative persisted reputation record. Firestore denies client access to `trustScores`, and clients cannot write the reserved profile trust field.

Production trust must be calculated by trusted server code from durable, authorized evidence references. A public projection should disclose scope and freshness without exposing private identity records or operational history.

## Design principles

- Never label a person safe or unsafe.
- Show evidence scope, named factors, counts, points, and formula version.
- Keep missing evidence separate from negative evidence.
- Exclude protected traits, package value, private messages, and popularity.
- Version formula changes and keep scores bounded.
- Do not use the score as the sole authorization, enforcement, or dispute decision.

## Future work

- durable trust evidence references and server-authoritative projections;
- freshness/decay policy, role semantics, backfills, and verified exceptions;
- user appeals, correction paths, and decision audit records;
- abuse/fraud monitoring without black-box scoring;
- privacy, fairness, and bias review before rollout;
- reviewer/KYC/upload workflows with explicit access and retention policy.

## Related documents

- [Trust Score](../product/trust-score.md)
- [Identity Verification](identity-verification.md)
- [Reviews](../product/reviews.md)
- [Application Services](application-services.md)
- [Trust Score ADR](../adr/adr-0005-why-trust-score.md)
