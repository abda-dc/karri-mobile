# Reviews

## Current implementation

After a booking reaches `completed`, each participant may submit one review of the other from Tracking. Rating is required as an integer from 1 to 5; comment is optional and limited to 1,000 characters.

`ReviewService` verifies completed state, participant direction, rating bounds, and prior reviews. `FirebaseReviewRepository` uses the deterministic document ID `bookingId__reviewerId__revieweeId`. Firestore rules repeat the completed-booking, participant, direction, rating, timestamp, and document-ID checks and deny updates/deletes.

After persistence, `review.submitted` creates an in-app notification for the reviewee. Review averages feed the visible trust summary.

## Display and trust

Trust surfaces show average rating and evidence count. A review is eligible behavior evidence, not a safety guarantee. Reviews are readable to signed-in users for the current trust preview; comments must therefore avoid private contact or package information.

## Current limitations

Moderation, reporting, appeals, editing, removal, private-data redaction, structured review dimensions, and disputes are not implemented. Production needs abuse review and an auditable moderation policy.

See [Trust Score](trust-score.md), [Trust Engine](../architecture/trust-engine.md), and [Booking Lifecycle](booking-lifecycle.md).
