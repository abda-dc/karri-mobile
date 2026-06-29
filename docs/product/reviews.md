# Reviews

## Current status

Milestone 4 implements a portable Review model, repository contract and Firebase mapper/adapter, plus `ReviewService` eligibility checks and rating aggregation. No review UI or trusted write command exists, and current Firestore rules deny review access.

## Purpose

Reviews let a sender review a traveler and a traveler review a sender after a completed booking. They describe participant experience; they do not guarantee safety.

## Implemented domain rules

- The booking must be `completed`.
- Reviewer and reviewee must be the two different booking participants.
- Direction is explicitly `sender_reviews_traveler` or `traveler_reviews_sender`.
- A participant may submit at most one review for the booking.
- Rating is an integer from 1 to 5.
- Comment is required and limited to 1,000 characters in the service foundation.
- A review publishes `review.submitted` after persistence.

The current service checks duplicates through repository reads. Production enforcement needs a transaction and deterministic uniqueness key in trusted code.

## Display and aggregation

`ReviewService` can calculate average rating and count. Any UI must show both count and context so one review does not resemble extensive history. A review cannot assign its own trust impact.

## Safety and operations

Launch requires reporting, moderation, appeals, private-data redaction, retention rules, and auditable treatment of removed content. These remain future work.

See [Trust Engine](../architecture/trust-engine.md), [Trust Score](trust-score.md), and [Booking Lifecycle](booking-lifecycle.md).
