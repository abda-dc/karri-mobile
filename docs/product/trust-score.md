# Trust Score

## Current implementation

Milestone 5 displays the version-1 explainable trust calculation on Profile, trip cards, route matches, and booking participant summaries.

For the current user, Profile supplies participant-visible booking history, Firebase Auth account creation time, eligible reviews, and anonymous verification state. For another user, the mobile client can safely read only public signed-in review evidence, so the UI labels that scope as visible completed-review evidence. It does not imply access to private cancellation or account-age history.

New users with no completed/review evidence display `New` rather than a punitive `0/100` badge.

## Factors

- Completed deliveries: up to 40 points.
- Cancellations: up to a 25-point deduction when participant history is available.
- Average eligible review: up to 25 points.
- Account age: up to 15 points for the current user.
- Verification: 0, 10, or 20 points; anonymous MVP sessions receive none.

The result is bounded from 0 to 100, versioned, and accompanied by factor explanations.

## Trust boundary

The displayed value is a client-calculated evidence summary, not an authoritative persisted score. `trustScores` remains denied by Firestore rules, and clients cannot write the reserved profile trust field.

Production requires a trusted server calculation with durable evidence references, role semantics, exception policy, backfills, appeals, privacy review, and bias/abuse monitoring.

See [Trust Engine](../architecture/trust-engine.md), [Reviews](reviews.md), and [Trust Score ADR](../adr/adr-0005-why-trust-score.md).
