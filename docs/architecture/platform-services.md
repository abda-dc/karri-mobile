# Platform Services

Karri Mobile uses a lean, mobile-first service stack. This document tracks external services, why they exist, when they should be added, and whether they are replaceable.

## Core principle

Use as few services as possible during MVP.

A service should only be added when it clearly improves reliability, trust, safety, delivery speed, or user communication.

## Current foundation

| Service | Purpose | Status | Replaceable? | Notes |
|---|---|---:|---:|---|
| Expo | Mobile app runtime and development | Active | No | Core mobile framework |
| Expo Router | App navigation | Active | Yes | Standard Expo routing layer |
| EAS Build | Android/iOS builds | Planned | No | Needed for release builds |
| EAS Update | Safe app updates | Planned | No | Use after MVP stabilizes |
| Supabase | Backend, database, auth, storage | Planned | No | Primary backend platform |
| GitHub | Source control | Active | No | Repository and collaboration |
| GitHub Actions | CI checks | Planned | Yes | Typecheck, lint, test, docs validation |

## Recommended MVP additions

| Service | Purpose | Priority | When to add | Notes |
|---|---|---:|---|---|
| Sentry | Crash and exception reporting | High | Before real user testing | Helps identify device-specific crashes |
| PostHog | Product analytics and funnels | High | Before beta | Track onboarding, listings, trips, bookings |
| Expo Push Notifications | Mobile alerts | High | MVP alerts phase | Booking and custody status updates |
| Resend | Transactional email | Medium | When Karri sends its own email | Supabase auth email may be enough at first |
| Better Stack | Uptime monitoring | Medium | Before public beta | Useful for backend and public status checks |

## Future services

| Service | Purpose | Phase | Notes |
|---|---|---|---|
| MapLibre + OpenStreetMap | Maps and route display | Later | Avoid paid map dependency early |
| Cloudinary or ImageKit | Image optimization and media processing | Later | Useful for IDs, package photos, delivery proof |
| Stripe | Payments | Future | Delay until booking flow is proven |
| Twilio or MessageBird | SMS/phone verification | Future | Delay until phone trust becomes required |
| Translation service | Multilingual support | Future | Useful for diaspora growth |

## Services to avoid during MVP

Avoid adding these early unless there is a clear product need:

- Extra backend platforms besides Supabase
- Multiple analytics tools
- Separate auth providers
- Dedicated CMS
- Separate logging stack
- Complex feature flag service
- Payment provider
- SMS verification provider
- Admin dashboard platform

## Decision checklist

Before adding a service, answer:

1. What MVP problem does it solve?
2. Can Supabase, Expo, or GitHub already solve it?
3. Does it introduce user data or compliance risk?
4. Can it be removed later without rewriting the app?
5. Is the free tier enough for beta usage?
6. Does it improve trust, safety, reliability, or delivery speed?

## Current recommended stack

For the first serious beta, Karri Mobile should use:

- Expo
- Expo Router
- TypeScript
- Supabase
- EAS Build
- EAS Update
- GitHub Actions
- Sentry
- PostHog
- Expo Push Notifications
- Resend
- Better Stack

This keeps Karri simple while still giving the project professional visibility into crashes, user behavior, alerts, and production health.
