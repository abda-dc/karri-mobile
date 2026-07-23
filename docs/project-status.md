# Project Status

## Snapshot

| Item | Verified state |
| --- | --- |
| Inspection date | July 23, 2026 |
| Baseline | `dab82705d1f363d1d211905e13ec71af2a80a678` |
| Repository | `abda-dc/karri-mobile`, public, default branch `main` |
| Product direction | Mobile-first Expo application with Firebase as the authoritative backend |
| Production readiness | **No-Go** |

This status combines repository inspection and the H1 evidence supplied for this handoff. It does not claim that a deployment, device test, backup, rollback, submission, or account transfer occurred during H1A.

## Current stack and architecture

- **Complete:** Expo SDK 56, React Native, TypeScript, Expo Router, Firebase Authentication, Cloud Firestore, Cloud Functions, Cloud Storage rules, Expo Notifications, EAS Build/Update configuration, and MkDocs Material.
- **Complete:** Layered mobile architecture: Domain and Application remain provider-neutral; Infrastructure owns Firebase/Expo adapters; Presentation consumes composed services.
- **Complete:** Firebase is the current authoritative backend. The previous Turborepo/Azure/PostgreSQL architecture is not the target architecture.
- **Partially configured:** Azure Static Web Apps hosts an Expo web validation surface. Legacy Azure App Services and PostgreSQL remain owner-review candidates, not mobile runtime targets.

## Completed implementation areas

- Shipment and trip creation, corridor matching, booking decisions, custody/status tracking, in-app notifications, trust summaries, identity-verification metadata, reviews, and offline/reconnect behavior.
- Mobile unit/public tests and TypeScript validation.
- Firestore authorization rules tests and Firebase Functions tests.
- Callable safety review and administrative hold source.
- Trusted push registration/unregistration source, bounded `booking.accepted` notification delivery source, registration-generation binding, and default-off delivery control.
- N4B bounded sign-out cleanup: cleanup runs before Firebase sign-out, is fenced by a three-second timeout, invalidates abandoned push operations, serializes auth and push operations, binds sign-out to the expected user, coalesces duplicate sign-outs, and prevents stale operations from persisting after sign-out. This is source/test evidence, not device-test evidence.

## CI evidence for the baseline

| Workflow | Run | Result |
| --- | --- | --- |
| Mobile Validate | `29967908163` | **Complete — Success** |
| Azure Static Web Apps CI/CD | `29967908186` | **Complete — Success** |
| Publish Docs | `29967908216` | **Complete — Success** |
| Firebase Validate | Not triggered | No Firebase backend paths changed in N4B |
| Android Build | Not triggered | Manual-only workflow |

## Environment inventory

### Expo/EAS

Project `@abda.dc/mobile`, ID `b73a2031-8f5f-4f59-8222-e999d115b6cb`, uses app name `Karri Mobile`, slug `mobile`, version `1.0.1`, runtime policy `appVersion`, Android package `com.karrimobile.app`, and iOS bundle ID `com.karrimobile.app`.

Development, preview, and production channels/branches exist. Development has `FIREBASE_APP_CHECK_DEBUG_TOKEN`, `GOOGLE_SERVICE_INFO_PLIST`, and `GOOGLE_SERVICES_JSON`. Preview and production have no project-scoped EAS variables and are **Partially configured**.

### Firebase

Development project: `karri-mobile-dev`. A personal Google account was observed in the authenticated Firebase CLI session during H1 inspection. The exact identity belongs in the private transfer evidence record, not the public repository. Registered development apps exist for Android, iOS, and web. App Check enforcement is disabled in callable runtime options.

Source exports:

| Function | Source | Deployed development state |
| --- | --- | --- |
| `submitSafetyReview` | **Complete** | **Complete — deployed** |
| `placeAdministrativeHold` | **Complete** | **Complete — deployed** |
| `releaseAdministrativeHold` | **Complete** | **Complete — deployed** |
| `registerPushToken` | **Complete** | **Implemented, not deployed** |
| `unregisterPushToken` | **Complete** | **Implemented, not deployed** |
| `onBookingAccepted` | **Complete** | **Implemented, not deployed** |

The last three entries are a deployment gap, not an implementation gap.

### Azure

`swa-karri-mobile-web-test` is connected to `abda-dc/karri-mobile` on `main`, reports `Ready`, and uses `nice-ground-08f721010.7.azurestaticapps.net`.

Active legacy resources in `rg-karri-prod` include `karri-pg-22107`, `asp-karri-prod`, `app-karri-api-prod`, `app-karri-web-prod`, `app-karri-mobile-web-test`, and `swa-karri-mobile-web-test`. `app-karri-mobile-web-test` was stopped and had `HttpsOnly=False` during inspection. One inherited subscription Owner was observed; no separate Contributor, resource lock, or ownership/lifecycle tags were observed. These resources require evidence-backed owner review; H1A does not authorize modification or deletion.

## Release evidence

| Surface | State |
| --- | --- |
| Android development build | **Complete:** internal build from `592a68925cead24d707fd80434189c1d53b12bc3` |
| iOS development build | **Complete:** internal build from `87c467d9d1ef371a56a2ee9bb1bac84877a467db` |
| Android manual release workflow | **Complete as historical operational evidence:** run `29647700047`, SHA `e3ed68155b04a342031c813382d46b9e51227eb2`, signed APK/AAB and Google Play testing upload |
| Current H1 SHA native builds | **Not validated:** none |
| iOS store build/submission | **Not validated:** no App Store/TestFlight evidence |
| EAS Updates | **Not validated:** no updates published |

The Android workflow is manual-only, defaults to `alpha` and `draft`, permits `completed`, and has no GitHub environment approval, conditional release guard, or explicit workflow permission block. Historical success is not current-SHA release approval.

## Security and governance

- **Partially configured:** GitHub Actions are enabled; default workflow token permission is read.
- **No-Go:** no branch protection, repository rulesets, or deployment environment other than `github-pages`.
- **Partially configured:** initial CODEOWNERS coverage and the SECURITY policy are included in H1A. Governance remains incomplete until branch protection or rulesets, required reviewers/checks, protected release environments, and verified secondary ownership are configured.
- **No-Go:** only direct collaborator observed was `abda-dc`; receiving-owner access is not verified.
- **No-Go:** final `PRIVACY.md`, `TERMS.md`, and `LICENSE` decisions are unresolved.

## Push and App Check verdicts

- `KARRI_PUSH_DELIVERY_ENABLED === "true"` is the only source-confirmed push delivery switch. Default/off remains required.
- Push registration/delivery functions are implemented but not deployed in development.
- Production notification delivery is **No-Go**.
- App Check enforcement remains disabled. H1A does not change enforcement.

## Prioritized backlog

### P0 — blocks production or external beta

- Verify receiving-owner access across every platform before removing existing access.
- Create and validate preview/production environment configuration; EAS project variables are currently missing.
- Compare deployed Firebase functions to the reviewed source and obtain approval before any development deployment.
- Produce current-SHA Android and iOS builds plus physical-device acceptance evidence.
- Keep push delivery off until the production readiness checklist has named approvals and evidence.
- Make and document the App Check rollout decision; do not enable enforcement without staged validation.
- Establish GitHub branch protection or a ruleset, required reviews/checks, and protected release environments.
- Approve incident, monitoring, recovery, data-retention, and signing-recovery ownership.

### P1 — required owner/legal/operational closure

- Owner/legal decision for `PRIVACY.md`, `TERMS.md`, and `LICENSE`; do not create final text without approval.
- Confirm Apple Developer and Google Play receiving-owner roles, signing custody, and recovery path.
- Add least-privilege platform roles, resource ownership/lifecycle tags, and recovery dependencies.
- Perform and record backup/restore and rollback exercises.
- Resolve push receipts, retries, monitoring, lifecycle retention, account deletion cleanup, and provider credential controls.
- Review legacy Azure resources and collect dependency, data-retention, backup, traffic, cost, and rollback evidence before any decommission decision.

### P2 — hardening

- Add repository issue/PR operating templates and a dedicated private security-reporting route.
- Add dependency, secret, and code scanning with reviewed alert ownership.
- Add observability dashboards and redacted operational metrics.
- Review pagination, retention, accessibility, localization, and performance at expected corridor volume.

## Approved next milestone

After H1A review and owner approval, the next milestone is **owner-access verification and controlled development readiness closure**: verify receiving-owner access, fill non-production environment gaps, compare deployed Firebase state with source, and collect current-SHA native/device evidence. It is not a production launch, push enablement, App Check enforcement change, Azure migration, or legacy-resource deletion milestone.
