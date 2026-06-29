# Reviews

## Current status

Reviews are not implemented. A typed placeholder exists and client access remains denied until booking eligibility and moderation rules are defined.

## Purpose

Reviews help future participants understand completed behavior. They should capture specific journey qualities without becoming an unmoderated venue for personal attacks or private information.

## Planned eligibility

- The reviewer and subject were participants in the same eligible booking.
- The booking reached the required completion state.
- Each participant may submit at most one review of the other for that booking.
- A review cannot directly set its own trust-score impact.
- Submission occurs through trusted backend logic.

## Review content

An initial design should use a small rating scale plus structured signals such as communication, punctuality, description accuracy, and handoff reliability. Optional text has a strict length limit and content policy.

## Display

Show review count and recency with any aggregate. A five-star result from one journey should not appear equivalent to extensive history. Explain that reviews reflect participant experience rather than a guarantee.

## Safety and operations

The launch plan needs reporting, moderation status, appeals, private-data redaction, and retention rules. Removed content should not silently leave trust calculations inconsistent; moderation decisions and derived-score changes require auditable server behavior.
