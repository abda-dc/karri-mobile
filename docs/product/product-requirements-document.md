# Product Requirements Document

## Product slice

This document defines the listing and exact-corridor discovery slice of Karri Platform v2. It is intentionally smaller than the full booking and custody vision.

## Problem

Diaspora senders do not have a structured way to publish cross-border package needs, while willing travelers do not have a structured way to publish compatible travel capacity. Both sides need immediate evidence of whether a route match exists before Karri invests in deeper coordination features.

## Users

- A sender with a described, non-prohibited package and desired delivery window.
- A traveler with a known route, travel dates, and available luggage capacity.
- A user may act in both roles under one authenticated account.

## Functional requirements

### Authentication foundation

- The app initializes Firebase only from `EXPO_PUBLIC_FIREBASE_*` configuration.
- The repository contains no real Firebase credentials or private service-account material.
- Data operations require a Firebase authenticated user and fail clearly when one is unavailable.
- Existing auth/profile routes continue to render while production email authentication remains a documented follow-up.

### Shipment create/list

- Collect origin country/city, destination country/city, category, description, weight estimate, desired delivery window, and reward offer.
- Validate all required fields and positive numeric weight/reward values on the client.
- Create an `active` shipment owned by the authenticated user.
- List the user's shipments newest first, with loading, empty, and error states.
- Reset the form after a successful save.

### Trip create/list

- Collect origin country/city, destination country/city, departure date, arrival date, available capacity, and optional notes.
- Validate required fields, positive capacity, and arrival not earlier than departure using `YYYY-MM-DD` input.
- Create an `active` trip owned by the authenticated user.
- List the user's trips newest first, with loading, empty, and error states.
- Reset the form after a successful save.

### Match view

- Read active shipments and active trips visible under Firestore rules.
- Normalize leading/trailing whitespace and letter case in each corridor field.
- Match only when origin country, origin city, destination country, and destination city all agree.
- Display the shipment, trip, dates, capacity, and reward clearly.
- Do not rank, score, create a booking, or infer nearby locations.

## Non-functional requirements

- Mobile-first, keyboard-friendly scrolling forms.
- Strict TypeScript and readable, feature-local state.
- Listener cleanup when screens unmount.
- Owner identity is assigned from Firebase Auth, never from form input.
- Firestore server timestamps are used for authoritative created/updated times.
- Errors shown to users avoid secrets and implementation stack traces.

## Data and authorization

Shipment and trip owners may create and update their records. Signed-in users may read active shipment/trip inventory for matching; owners may still read their own inactive records. Client queries must follow the same constraints as rules. Bookings, custody events, reviews, and notifications are typed/drafted only and are not writable through this slice.

## Acceptance criteria

The slice is code-complete when TypeScript and Expo Doctor pass, MkDocs builds, environment placeholders are documented, rules compile as a coherent first draft, and each implemented screen contains explicit loading, empty, and error behavior. End-to-end Firebase behavior still requires a configured Firebase project, enabled Auth provider, deployed rules/indexes, and device testing.

## Explicit exclusions

No payments, dispute resolution, admin portal, SMS, chat, AI matching, complex trust scoring, or booking request is included.
