# Matching Engine Architecture

## Boundary

Matching is a read-only application/domain capability:

```text
MatchingService
  -> ShipmentService / TripService
      -> ShipmentRepository / TripRepository
          -> Firebase adapters
  -> TrustService / IdentityVerificationService / OfflineService
  -> pure scoringFactors
      -> MatchScore + MatchReason + MatchResult
```

`MatchingService` imports service and domain contracts only. Firebase reads remain inside repository implementations. No match is persisted and no domain event is published. Milestone 9B composes the service once in `mobileServices`; Send and Travel call that application instance without accessing repositories.

## Domain models

- `MatchScore`: bounded formula-v1 total plus all seven factor contributions.
- `MatchReason`: stable code, factor, tone, title, and plain-language explanation.
- `MatchResult`: pair, eligibility, evidence explanations, evaluation time, and freshness.
- `MatchFilter`: validated ranking, eligibility, category, selection, and result-limit controls.
- `MatchEvidence`: narrow provider-neutral trust, identity, and completed-delivery inputs.

`scoringFactors.ts` exports one pure function per factor plus `scoreMatch`. These functions contain no repositories, services, clocks, framework APIs, or provider types, making the formula reusable by a future trusted backend.

## Orchestration

`findMatches` performs bounded one-shot active listing reads, narrows requested IDs, loads traveler evidence once per unique owner, evaluates the Cartesian pairs, applies eligibility and minimum-score filters, sorts deterministically, and enforces the result limit. `findMatchesForShipments` and `findMatchesForTrips` reuse that ranking pipeline and apply the result limit per requested listing. Evidence failures degrade only the affected evidence to unavailable; inventory read failures remain visible to the caller.

`evaluate` exposes deterministic pair scoring for already-loaded domain objects and injected evidence. The service clock supplies one shared evaluation timestamp. `OfflineService` supplies a snapshot of provider-neutral connection state for freshness labeling.

## Privacy and authority

The mobile identity repository is self-scoped. `IdentityVerificationService.getVisibleStatusSummary(subject, viewer)` returns `null` without a repository read when the IDs differ. That prevents ranking from probing private verification documents.

The current `TrustService` other-user scope uses eligible visible reviews. The matching engine does not enlarge that scope. Production matching should consume a server-owned public evidence projection that discloses formula version, scope, and freshness without exposing identity records or private booking history.

Numeric rank is never authorization. Booking services and security rules must independently enforce active listings, ownership, exact corridor, capacity, participants, and lifecycle state.

## Formula evolution

Version changes must preserve old explanations, add deterministic fixtures, document weight and eligibility changes, and receive fairness/privacy review. Do not tune weights from protected traits, package value, popularity, or opaque behavioral inference.

## Follow-up

- Add a project test runner and pure factor/service fixtures.
- Introduce structured delivery windows and traveler package-category preferences before making those factors mandatory.
- Move ranking and public evidence to a trusted service when scale or privacy policy requires it.
- Add explicit refresh/focus policy if discovery needs continuous background updates rather than filter-triggered one-shot reads.
