# ADR-0001: Why Expo

## Status

Accepted — 2026-06-29

## Context

Karri needs a mobile-first experience on iOS and Android with a small team and a shared TypeScript codebase. The first product questions concern listing, route matching, booking, and custody rather than custom native infrastructure. The app also needs routing, over-the-air update options, predictable builds, and access to common device APIs.

## Decision

Build the Karri mobile app with Expo React Native, TypeScript, and Expo Router. Prefer Expo-compatible libraries and managed configuration. Introduce custom native code only when a validated product or security requirement cannot be met otherwise.

## Consequences

- One codebase can serve iOS, Android, and limited web validation.
- Expo Router gives file-based navigation and deep-link structure.
- EAS can provide reproducible build and update workflows later.
- The team must track Expo SDK compatibility and use `expo install` when native version alignment matters.
- Some advanced native vendor integrations may require development builds or prebuild in the future.
- Expo does not remove the need for device testing, store compliance, or careful permission design.
