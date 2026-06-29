# Technology Roadmap

Karri Mobile is built as a mobile-first platform using simple, stable technologies that support fast MVP delivery and long-term growth.

## Purpose

This document explains:

- which technologies Karri uses
- why each technology was selected
- what alternatives were considered
- where vendor lock-in exists
- how Karri can evolve without a rewrite

## Technology principles

Karri should prefer technologies that are:

- simple to deploy
- mobile-first
- well documented
- widely adopted
- affordable during MVP
- secure by default
- easy for future contributors to understand

Avoid technologies that add complexity before the product needs them.

## Current stack

| Layer | Technology | Status | Reason |
|---|---|---:|---|
| Mobile app | Expo React Native | Active | Fast Android/iOS development from one codebase |
| Language | TypeScript | Active | Safer code and better maintainability |
| Navigation | Expo Router | Active | File-based routing for simple app structure |
| Backend | Supabase | Planned | Auth, database, storage, realtime, and edge functions in one platform |
| Database | PostgreSQL via Supabase | Planned | Reliable relational data model for marketplace workflows |
| Auth | Supabase Auth | Planned | Email OTP/magic link support with secure session handling |
| Storage | Supabase Storage | Planned | Package photos, profile images, and future verification files |
| Builds | EAS Build | Planned | Reliable Android/iOS release builds |
| Updates | EAS Update | Planned | Safer app updates after store release |
| Source control | GitHub | Active | Repository, history, collaboration, and issues |
| CI | GitHub Actions | Planned | Typecheck, lint, tests, and documentation validation |

## Why Expo React Native

Expo gives Karri a practical mobile foundation without requiring separate native Android and iOS teams.

Benefits:

- one shared TypeScript codebase
- faster testing on real devices
- simpler build process through EAS
- strong support for notifications, assets, routing, and updates
- lower maintenance burden during MVP

Alternative considered:

| Alternative | Reason not selected |
|---|---|
| Native Android/iOS | Too slow and expensive for MVP |
| Flutter | Strong option, but Expo fits the current TypeScript direction better |
| Web-first app | Karri needs mobile trust, alerts, and handoff flows first |

## Why Supabase

Supabase gives Karri a full backend foundation while keeping the system simple.

Benefits:

- PostgreSQL database
- built-in authentication
- Row Level Security
- file storage
- realtime support
- edge functions if needed
- fewer moving parts than a custom backend

Alternative considered:

| Alternative | Reason not selected |
|---|---|
| Firebase | Less relational by default; Karri needs structured marketplace workflows |
| Custom API from day one | More control, but much more maintenance |
| Appwrite | Good platform, but Supabase/PostgreSQL is stronger for relational data |
| Azure backend | Powerful, but heavier than needed for this fresh mobile-first version |

## Why PostgreSQL

Karri's domain is relational.

Core objects connect naturally:

- users
- profiles
- listings
- trips
- matches
- bookings
- custody events
- delivery status
- notifications

PostgreSQL makes these relationships easier to model safely.

## Why EAS Build and EAS Update

EAS keeps mobile release management simple.

EAS Build is used for:

- Android builds
- iOS builds
- app store release artifacts
- reproducible cloud builds

EAS Update is used for:

- safe JavaScript updates
- small UI fixes
- non-native bug fixes
- faster post-launch iteration

Important limit:

EAS Update should not be used for changes that require new native permissions, native modules, or app store review.

## Future additions

| Capability | Preferred technology | When |
|---|---|---|
| Crash reporting | Sentry | Before beta |
| Product analytics | PostHog | Before beta |
| Push notifications | Expo Push Notifications | MVP alerts phase |
| Transactional email | Resend | When Karri sends its own emails |
| Uptime monitoring | Better Stack | Before public beta |
| Maps | MapLibre + OpenStreetMap | Tracking phase |
| Payments | Stripe | After booking flow is proven |
| SMS verification | Twilio or MessageBird | Later trust phase |

## Vendor lock-in review

| Service | Lock-in level | Mitigation |
|---|---:|---|
| Expo | Medium | Keep business logic outside Expo-specific APIs where practical |
| EAS | Medium | Useful but replaceable with native build pipelines later |
| Supabase | Medium | PostgreSQL reduces lock-in; avoid overusing platform-specific features early |
| GitHub | Low | Git can move to another provider |
| Sentry | Low | Error reporting can be swapped |
| PostHog | Low | Analytics events can be routed elsewhere |
| Resend | Low | Transactional email providers are replaceable |
| Better Stack | Low | Monitoring providers are replaceable |

## Architecture evolution path

Karri should evolve in stages:

### Stage 1: Mobile MVP

- Expo app
- Supabase Auth
- Supabase database
- profile setup
- listings
- trips
- matching
- booking request
- booking status

### Stage 2: Trust and custody

- custody events
- QR handoff
- package photos
- sealed custody status
- stronger notifications
- crash reporting
- analytics

### Stage 3: Operational maturity

- monitoring
- alerts
- admin workflows
- support tooling
- audit logs
- better release controls

### Stage 4: Marketplace expansion

- payments
- disputes
- trust signals
- multilingual support
- route intelligence
- partner integrations

### Stage 5: Platform scale

- dedicated services if needed
- web admin portal
- advanced matching
- compliance workflows
- regional expansion

## Decision rule

Do not add technology because it is interesting.

Add technology only when it helps Karri become more:

- trustworthy
- safer
- easier to operate
- easier to ship
- easier to scale
- easier for users to understand
