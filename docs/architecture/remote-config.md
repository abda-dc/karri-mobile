# Remote Configuration

## Purpose

Define typed, non-secret operational configuration and its intended Firebase Remote Config provider.

## Scope

This document covers app configuration, country and corridor configuration, feature flags, package categories, prohibited-item guidance, verification requirements, defaults, and activation safety.

## Current implementation

`apps/mobile/src/domain/configuration/AppConfig.ts` defines `AppConfig`, `CountryConfig`, `CorridorConfig`, `FeatureFlags`, `PackageCategories`, `ProhibitedItems`, and `VerificationRequirements`. Safe defaults disable unfinished features and provide empty operational lists.

`RemoteConfigService` returns those defaults and accepts an optional provider. No Firebase Remote Config provider is connected, no fetch occurs at startup, and the UI does not consume remote values yet.

## Design principles

- Configuration is typed, versioned, non-secret, and validated before activation.
- Local defaults keep the app safe when fetch or parsing fails.
- Feature flags control exposure, never authorization.
- Existing booking terms are persisted and cannot be rewritten remotely.
- Prohibited-item guidance does not replace trusted enforcement or legal review.
- Environment separation and change history are required before production use.

## Future direction

Implement a Firebase Remote Config infrastructure provider, encode values with an explicit schema, validate limits and enum values, and activate at predictable lifecycle points. Add observability for fetch, validation, and activation outcomes. Corridor launches need operational ownership, copy review, and rollback defaults.

## Out of scope

- Secrets, credentials, prices already accepted in a booking, and access-control rules.
- Enabling unfinished features through configuration alone.
- A production Firebase Remote Config connection in this milestone.

## Related documents

- [Platform Services](platform-services.md)
- [Application Services](application-services.md)
- [Technology Roadmap](technology-roadmap.md)
- [Remote Configuration ADR](../adr/adr-0008-why-remote-configuration.md)
- [Feature Flags ADR](../adr/adr-0007-why-feature-flags.md)
