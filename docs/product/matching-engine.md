# Matching Engine

## Current implementation

The Home tab performs a simple exact corridor match in the client. It subscribes to active shipments and active trips, normalizes each route string by trimming whitespace and converting to lower case, and pairs records when all four fields match:

- Origin country
- Origin city
- Destination country
- Destination city

```text
shipment.originCountry == trip.originCountry
shipment.originCity == trip.originCity
shipment.destinationCountry == trip.destinationCountry
shipment.destinationCity == trip.destinationCity
```

The result is derived in memory and is not stored. A card shows the route, shipment category/weight/reward, and trip dates/capacity. The MVP queries the 100 newest active shipments and 100 newest active trips to keep the client-side comparison bounded.

## Deliberate limits

Current matching does not consider:

- Delivery window versus travel dates.
- Package weight versus available capacity.
- Nearby cities, airports, or geographic distance.
- User trust or reviews.
- Category restrictions or prohibited items.
- Ranking, recommendations, AI, or personalization.
- Existing booking requests or capacity reservations.

For that reason, the UI calls results **possible matches**. Users cannot create a booking from the match card in this slice.

## Data access

Matching reads active inventory available to any authenticated Firebase user. Owner-only inactive records are excluded by the query. This access should be revisited as listing privacy and corridor volume mature.

## Next safe increment

Before adding ranking, add deterministic eligibility filters for date-window overlap, capacity, and supported category. Put authoritative booking eligibility in a Cloud Function so a stale client match cannot create an invalid booking.

## Success measures

Track the share of active listings with at least one possible match, time to first match, and false-positive reasons reported during research. Do not optimize a ranking model before basic corridor liquidity and data quality are understood.
