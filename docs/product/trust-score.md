# Trust Score

## Current status

Karri does not calculate or display a trust score in the current MVP. Models reserve a simple placeholder field for future compatibility, but no client can write an authoritative score.

## Product intent

A future trust score will summarize verified platform history so users can compare context quickly. It will not label a person safe, replace judgment, grant authorization, or hide the underlying evidence.

## Candidate signals

- Identity/contact verification state.
- Completed bookings and role-specific history.
- Custody-event completeness.
- On-time and successful handoffs.
- Cancellations or validated exceptions.
- Eligible review patterns and volume.
- Account age and recent activity, used carefully.

Package value, protected characteristics, private messages, and social popularity are not appropriate shortcuts for trustworthiness.

## Explainability

The UI should present a score band or summary alongside contributing signals, number of eligible journeys, recency, and a “how this works” explanation. New users receive a neutral “new” state rather than a punitive low score.

## Calculation boundary

Only trusted server code updates the score from versioned, auditable inputs. A calculation record should capture formula version, input references, timestamp, and outcome. Formula changes require backfill planning and bias/abuse monitoring.

## Governance questions before launch

- What evidence can a user inspect or challenge?
- How are reversals, moderation, and exceptions handled?
- How does history decay or recover?
- Which signals differ between sender and traveler roles?
- What minimum history supports a displayed score?

Until these questions are answered with real corridor research, a simple review/history display is safer than premature scoring.
