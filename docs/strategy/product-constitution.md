# Product Constitution

These principles govern product and engineering decisions. A short-term growth opportunity does not override them without an explicit, documented decision.

## 1. Trust is the product

Price and speed matter, but users return only if they understand who is involved and what evidence supports the journey.

## 2. Custody must be visible

Every meaningful handoff will become a recorded custody event. Custody history is append-only; corrections add evidence rather than silently rewriting history.

## 3. Simplicity earns adoption

Forms request only information needed for the next decision. Status language is plain. Error, loading, and empty states are part of the feature rather than polish deferred indefinitely.

## 4. Sensitive decisions run in trusted code

The current client may create and update owner-controlled shipment and trip listings. Booking acceptance, custody transitions, review eligibility, notifications, and trust updates will be validated by Cloud Functions before becoming authoritative.

## 5. Important actions produce events

Business events create a reliable record for notifications, analytics, audit, and future integrations. An event describes something that happened; it is not a command to make it happen.

## 6. Authorization is explicit

Every collection and operation has an owner or participant model. Authentication alone never grants broad write access.

## 7. Configuration changes safely

Feature flags control staged exposure. Remote configuration supplies non-secret operational values. Neither mechanism replaces security rules or server-side validation.

## 8. Reputation must be explainable

Trust scores summarize eligible evidence; they do not declare that a person is safe. Users should see the main contributing signals and the amount of history behind the score.

## 9. Documentation follows reality

Plans are labeled as plans. Implemented behavior is documented after code changes. The handbook must not imply that payments, disputes, chat, AI matching, or advanced scoring exist before they do.

## 10. Expansion is corridor-led

Karri earns the right to expand by making a small number of corridors reliable. Global reach is the direction, not a shortcut around local learning.
