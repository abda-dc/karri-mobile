# Production Deployment Transition

## Purpose

This document records the current native-first deployment direction and the remaining transition gates as of July 23, 2026. It is not production approval and does not describe the previous Azure/PostgreSQL web architecture as the target.

## Target architecture

Karri Mobile uses:

1. Expo/React Native for Android and iOS.
2. EAS Build for native binaries.
3. EAS Update only for runtime-compatible JavaScript/assets after approval.
4. Firebase Authentication, Firestore, Cloud Functions, and Storage rules as the authoritative backend.
5. Azure Static Web Apps only for the current Expo web validation surface.

Legacy Azure App Services and PostgreSQL remain review candidates. They must not be modified or deleted without dependency, data, backup, traffic, cost, ownership, and rollback evidence.

## Current Expo/EAS identity

| Item | Value |
| --- | --- |
| Account/project | `@abda.dc/mobile` |
| EAS project ID | `b73a2031-8f5f-4f59-8222-e999d115b6cb` |
| Display name | `Karri Mobile` |
| Slug | `mobile` |
| Version | `1.0.1` |
| Runtime policy | App version |
| Android package | `com.karrimobile.app` |
| iOS bundle identifier | `com.karrimobile.app` |

Development, preview, and production profiles/channels/branches exist. No EAS Update has been published.

## Environment readiness

| Environment | Current evidence | Status |
| --- | --- | --- |
| Development | `FIREBASE_APP_CHECK_DEBUG_TOKEN`, `GOOGLE_SERVICE_INFO_PLIST`, and `GOOGLE_SERVICES_JSON` exist as project-scoped EAS variables | **Partially configured** |
| Preview | No project-scoped EAS variables | **No-Go** |
| Production | No project-scoped EAS variables | **No-Go** |

Never record values in documentation. Preview and production builds must not proceed until matching Firebase projects/apps, native configuration, credential ownership, access, and rollback are verified.

## Firebase development state

The checked-in alias `development` maps to `karri-mobile-dev`. Registered Android, iOS, and web apps exist.

| Function | Source | Deployed |
| --- | --- | --- |
| `submitSafetyReview` | Yes | Yes |
| `placeAdministrativeHold` | Yes | Yes |
| `releaseAdministrativeHold` | Yes | Yes |
| `registerPushToken` | Yes | No |
| `unregisterPushToken` | Yes | No |
| `onBookingAccepted` | Yes | No |

The final three functions have a deployment gap, not an implementation gap. Any deployment requires validation and separate approval. App Check enforcement remains disabled. Push delivery remains default-off unless `KARRI_PUSH_DELIVERY_ENABLED` is exactly `true`; production push is **No-Go**.

Development deployment commands are documented in [Deployment](../operations/deployment.md). Do not run them as part of documentation validation.

## Native release evidence

- iOS internal development build: SHA `87c467d9d1ef371a56a2ee9bb1bac84877a467db`.
- Android internal development build: SHA `592a68925cead24d707fd80434189c1d53b12bc3`.
- Historical Android manual workflow: run `29647700047`, SHA `e3ed68155b04a342031c813382d46b9e51227eb2`, signed APK/AAB and Google Play testing upload.
- No native build exists for H1 baseline `dab82705d1f363d1d211905e13ec71af2a80a678`.
- No iOS store build or App Store/TestFlight submission evidence exists.

The Android workflow is manual-only, defaults to `alpha` and `draft`, permits `completed`, and lacks a GitHub environment approval, conditional release guard, and explicit workflow permission block. It must not be treated as unattended production automation.

## Azure inventory and boundary

Active resources observed in `rg-karri-prod`:

- `karri-pg-22107`
- `asp-karri-prod`
- `app-karri-api-prod`
- `app-karri-web-prod`
- `app-karri-mobile-web-test`
- `swa-karri-mobile-web-test`

`swa-karri-mobile-web-test` is connected to `abda-dc/karri-mobile` on `main`, reports `Ready`, and serves `nice-ground-08f721010.7.azurestaticapps.net`.

`app-karri-mobile-web-test` was stopped and had `HttpsOnly=False` during inspection. One inherited subscription Owner was observed, with no separate Contributor, resource locks, or ownership/lifecycle tags. These are governance findings for owner review, not authorization to change resources.

## Transition gates

Production transition requires:

- verified receiving-owner access for GitHub, Expo/EAS, Firebase/Google Cloud, Apple, Google Play, Azure, and Static Web Apps;
- preview and production environment completeness;
- current-SHA Android and iOS builds;
- physical-device, accessibility, auth/session, offline/reconnect, and notification acceptance evidence;
- deployed-function/source comparison and approved closure;
- App Check rollout decision and rollback;
- push default-off decision and full production push approval;
- signing/store recovery ownership;
- incident, monitoring, backup/restore, and rollback evidence;
- owner/legal approval for privacy, terms, and license.

Until these gates are complete, the decision is **No-Go**.

## Approved next step

After H1A review, proceed only to owner-access verification and controlled development readiness closure. Do not combine that milestone with production deployment, push enablement, App Check enforcement, Azure migration, or legacy-resource decommissioning.

See [Project Status](../project-status.md), [Owner Handoff](../owner-handoff.md), [Deployment](../operations/deployment.md), [Rollback](../operations/rollback.md), and [Release Checklist](../release-checklist.md).
