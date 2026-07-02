# Product Roadmap

The roadmap is outcome-based. Dates should be added only after team capacity and corridor launch commitments are known.

## Phase 0 — Foundation

**Outcome:** the team has one documented architecture and a deployable mobile base.

- Expo Router application shell and reusable mobile UI primitives.
- MkDocs Material handbook published through GitHub Pages.
- Firebase client initialization with environment placeholders.
- Typed Firestore data contracts and first-pass security rules.
- Authentication integration point, with production sign-in still to be finalized.

## Phase 1 — Listing and discovery MVP

**Outcome:** authenticated users can publish supply or demand and see whether exact corridor liquidity exists.

- Create and list the current user's shipments.
- Create and list the current user's trips.
- Read active corridor inventory permitted by Firestore rules.
- Show exact origin-city/country and destination-city/country matches.
- Instrument listing completion and match visibility after analytics is selected.

## Phase 2 — Booking coordination

**Outcome:** a sender and traveler can explicitly request and accept one shared agreement.

- Booking request creation through a callable Cloud Function.
- Traveler accept/decline flow with idempotent validation.
- Participant-only booking views.
- Push and in-app notifications.
- Cancellation policy and operational status handling.

## Phase 3 — Custody and completion

**Outcome:** participants can see who holds the package and the evidence for each handoff.

- Append-only custody event workflow.
- Pickup, in-transit, arrival, handoff, and delivery events.
- Evidence uploads with Storage rules and retention policy.
- Delivery confirmation and exception paths.
- Reviews limited to eligible completed bookings.

## Phase 4 — Trust and corridor expansion

**Outcome:** reliable history improves decisions and repeat use without overstating safety.

- Explainable trust-score summary based on verified signals.
- Provider-neutral explainable matching foundation, with presentation adoption and trusted public evidence deferred to a reviewed follow-up.
- Feature flags and Remote Config rollout controls.
- Corridor-specific categories, capacity guidance, and prohibited-item content.
- Localization and accessibility validation.
- Expansion readiness review per corridor.

## Outside this roadmap slice

Payments, disputes, chat, SMS, AI matching, and an admin portal require separate product, legal, operations, and security decisions. They must not be smuggled into an earlier phase as incidental implementation.
