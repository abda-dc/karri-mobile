# Discovery Experience

## Purpose

Milestone 9B brings explainable matching into the existing Send and Travel workflows without changing booking creation or adding a new route.

## Send discovery

After owned shipments load, Send selects active shipment IDs and calls `MatchingService.findMatchesForShipments`. Every active shipment receives its own recommendation section and per-shipment result cap. Cards describe the traveler trip, score, eligibility, freshness, and factor reasons.

## Travel discovery

After owned trips load, Travel selects active trip IDs and calls `MatchingService.findMatchesForTrips`. Every active trip receives its own recommended-shipment section with the same reusable card and explanation pattern.

## Filters

Both screens use `MatchFiltersCard`:

| Filter | Behavior |
| --- | --- |
| Minimum score | Removes results below 0-100 threshold in `MatchingService` |
| Verified only | Requires identity verification when visible; private other-user identity remains unavailable and therefore cannot pass |
| Eligible only | Hides results with blocking domain reasons |
| Maximum results | Applies 1-10 result cap independently to each owned listing |
| Package category | Supplies an exact normalized category allow-list and makes compatibility required |

Filters are applied explicitly. Reset restores the conservative defaults: score 0, eligible only, three results, no identity requirement, and no category restriction.

## Freshness and offline behavior

Each `MatchResult` carries `live`, `cached`, or `unknown` freshness from the existing `OfflineService` snapshot. Match cards show both a status chip and plain-language explanation. Cached results may be stale; unknown results require review. Inventory read failures remain visible errors.

No discovery component creates a cache, watches Expo Network, reads Firestore, or claims native persistence. Reapplying filters reruns the one-shot recommendation query. Continuous background refresh remains deferred.

## Safety and authority

- Scores support comparison; they do not guarantee safety.
- Identity privacy is not weakened for discovery.
- Eligibility and points come only from `MatchingService` and domain factors.
- Booking actions and authorization are unchanged.
- No payments, maps, GPS, AI/ML, persisted match records, or admin tooling are introduced.
