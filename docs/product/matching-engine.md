# Matching Engine

## Current foundation

Karri now has a provider-neutral, explainable matching engine in the domain and application layers. It ranks active shipment/trip pairs without storing a second match record or importing Firebase into business logic.

The existing Home screen is intentionally unchanged and still shows its exact-corridor possible matches. A later presentation phase may adopt `MatchingService`; this milestone does not silently change what users see or which bookings they can request.

## Ranked result

Each `MatchResult` contains the shipment and trip, a stable pair ID, eligibility, data freshness, evaluation time, a versioned `MatchScore`, and plain-language `MatchReason` entries. Formula version 1 totals 100 points:

| Factor | Maximum | Current behavior |
| --- | ---: | --- |
| Route similarity | 25 | Compares normalized origin/destination country and city fields; exact route is required by default |
| Departure/arrival timing | 15 | Scores arrival inside the requested window, then interval overlap and bounded gaps |
| Capacity | 15 | Full points when listed capacity covers shipment weight; required by default |
| Package compatibility | 10 | Uses explicit allowed/blocked category filters; missing structured preferences score neutrally |
| Trust score | 15 | Scales the scope-aware visible `TrustService` score |
| Identity verification | 10 | Verified receives full points; private/unavailable state scores neutrally and is never inferred |
| Historical delivery success | 10 | Uses visible eligible completed-delivery counts from the trust summary |

Ranking sorts by total score, then route points, departure date, and stable pair ID. Every factor emits one explanation. Blocking reasons are separate from the numeric score so a high-scoring but ineligible pair cannot slip through a threshold.

## Filters and eligibility

`MatchFilter` supports shipment/trip ID selection, minimum score, result limit, exact-route/capacity/timing/identity/package requirements, same-owner policy, category allow/block lists, and maximum timing gap. Defaults remain conservative:

- active listings only;
- different sender and traveler;
- exact route and enough capacity required;
- timing overlap, verified identity, and explicit category compatibility optional;
- at most 50 results from the repositories' bounded 100-listing reads.

Delivery windows are currently free-form text. The timing factor parses ISO `YYYY-MM-DD` values when present. Unstructured windows receive a neutral explanation rather than fabricated precision; `requireTimingOverlap` makes missing structure blocking.

## Evidence and privacy

`MatchingService` reuses `TrustService` and `IdentityVerificationService`. Other-user trust remains reviews-only under the existing evidence policy. Identity records remain self-readable: `getVisibleStatusSummary` returns no cross-user result and does not query the repository for one. Unknown identity is scored neutrally unless the caller explicitly requires verification.

This is decision support, not a safety claim or authorization rule. Trust, identity, and prior delivery history are independent explanations and must not replace package inspection or participant judgment.

## Data access and offline behavior

`ShipmentService.listActive` and `TripService.listActive` call provider-neutral repository ports. Firebase adapters implement the bounded reads, while `MatchingService` knows nothing about Firestore. `OfflineService.getStatus` labels successful results as live, cached, or unknown; the engine does not claim cache durability or hide a failed inventory read.

## Deliberate limits

- No presentation changes, automatic booking, persisted match collection, or analytics event.
- No geospatial distance, nearby airports, maps, GPS, AI/ML model, or personalization.
- No inference from free-form trip notes or package descriptions.
- No authoritative public identity/trust projection or server-side ranking yet.
- Booking authorization still uses the existing booking/domain/rules boundary; a score never authorizes a request.

See [Matching Engine Architecture](../architecture/matching-engine.md), [Trust Engine](../architecture/trust-engine.md), and [Identity Verification](../architecture/identity-verification.md).
