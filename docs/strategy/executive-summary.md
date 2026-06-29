# Executive Summary

## Opportunity

People in East African diaspora communities regularly need to move small packages across borders. Formal carriers can be expensive or slow, while informal handoffs through friends and travelers often lack clear expectations, status, and accountability. Travelers already making these journeys may have unused luggage capacity but no structured, trusted way to connect with senders.

Karri organizes this existing behavior into a mobile-first marketplace. Senders publish what needs to move, travelers publish where and when they are traveling, and Karri surfaces compatible corridors. The long-term platform adds controlled booking, visible chain of custody, notifications, reviews, and trust signals.

## Initial customer and market

The first users are diaspora senders in North America and Europe sending to East African cities, and East African diaspora travelers already flying those routes. Launch is corridor-led rather than country-wide: Karri should prove liquidity, safety, and repeat use on a small number of origin/destination pairs before expanding.

## MVP

The present MVP foundation includes:

- An Expo React Native app with Expo Router.
- Firebase Authentication and Cloud Firestore client foundations.
- Owner-created shipment and trip listings.
- Exact country-and-city corridor matching.
- Draft data contracts for bookings, custody events, reviews, and notifications.

The MVP deliberately excludes payments, disputes, chat, AI ranking, advanced trust scoring, and automated booking.

## Strategic advantage

Karri's advantage is not simply a list of available travelers. It is the trust system around the transaction: clear identities, explicit agreements, visible custody, reliable updates, and reputation accumulated from completed behavior. That system should become harder to replicate as corridor density and trustworthy history grow.

## Technology direction

Expo keeps one TypeScript mobile codebase practical for iOS, Android, and early web validation. Firebase provides managed authentication, realtime data, storage, messaging, configuration, abuse protection, and serverless functions. Direct client writes are limited to simple owner-controlled records; sensitive lifecycle transitions will move through Cloud Functions and emit durable business events.

## Near-term success

The foundation succeeds when a signed-in sender can publish a shipment, a signed-in traveler can publish a trip, both can revisit their listings, and the app can show a clear exact-corridor match. Product learning should then validate whether users understand the match and are willing to proceed to a booking request.
