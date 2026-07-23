# Rollback Guide

## General rule

No rollback in this guide was verified during H1A. Before any release, name the decision owner, preserve evidence, select a known-good SHA/artifact, validate it locally, and confirm the target environment. Rollback must not expose secrets or erase incident evidence.

## Firebase Functions

1. Disable affected optional behavior first. For push, set `KARRI_PUSH_DELIVERY_ENABLED` to a value other than exact `true` through the approved runtime configuration process.
2. Identify the prior reviewed source SHA and deployed function inventory.
3. In a clean worktree at that revision, run `npm run firebase:validate:functions`.
4. With Firebase/backend and release approval, redeploy using `npm run firebase:deploy:development:functions`.
5. Compare deployed names/regions and run approved redacted smoke checks.

Firebase Functions do not provide a repository-defined one-command revision rollback here; rollback is validated redeployment of reviewed source. Do not delete functions merely to force rollback unless deletion is separately approved.

## Firestore and Storage rules

1. Contain risky client access or release activity.
2. Select the previous reviewed `firestore.rules`, `storage.rules`, and, where applicable, index revision.
3. Run `npm run firebase:validate:firestore` and `npm run firebase:validate:storage`.
4. With security/Firebase approval, deploy the narrow development script for the affected surface.
5. Repeat allow/deny verification against the deployed environment.

Rules rollback can block legitimate clients or reopen access. Review schema/query compatibility and never claim recovery until deployed authorization checks pass. Index deletion is a separate destructive decision; prefer forward-safe additions or reviewed replacement.

## EAS Update

1. Stop further rollout/channel changes.
2. Confirm affected update group, runtime version, branch, channel, and source SHA.
3. Select a compatible prior update or prepare a corrective update from a reviewed SHA.
4. Validate mobile tests and runtime compatibility.
5. With release approval, republish the known-good content to the intended branch/channel using the approved EAS Update procedure.
6. Verify on representative installed binaries.

No update has been published yet, so rollback mechanics are **Not validated**. An over-the-air update cannot remove native capability, change signing, or repair an incompatible native runtime; use a replacement binary for those cases.

## Azure Static Web Apps

1. Preserve the failed workflow/run ID, commit SHA, Azure activity evidence, and current live response metadata.
2. Stop additional workflow reruns until the failure is classified.
3. Select a prior known-good source SHA/artifact and confirm repository/Azure ownership.
4. With Azure and GitHub release approval, rerun or redeploy the known-good Static Web Apps source through the established workflow.
5. Verify environment status, source branch/SHA where available, hostname, HTTP response, and key public routes.

H1 evidence includes a prior transient post-upload incident, but it does not prove a rollback exercise. Do not modify or delete legacy App Services/PostgreSQL as part of Static Web Apps rollback.

## Android testing release containment

1. Record workflow run, SHA, artifact hashes, Play track, release status, version code, and affected testers.
2. Stop or halt rollout in Google Play Console where the selected track/status supports it.
3. Do not promote a draft or testing release.
4. Remove tester eligibility or replace the testing release only with Google Play owner approval.
5. Prepare a higher-version corrected build from a reviewed SHA; Android version codes cannot be reused.
6. Notify named testers and verify the contained track state.

Historical run `29647700047` uploaded an AAB to testing; it is operational evidence, not rollback validation or current approval.

## Push emergency shutdown

The server sends only when:

```text
KARRI_PUSH_DELIVERY_ENABLED === "true"
```

Set the runtime value to anything other than exact `true` using the approved secret/environment configuration mechanism, then verify new valid booking events create canonical in-app records without provider attempts. Preserve existing notification and delivery evidence. Do not delete tokens or canonical records as an emergency shortcut.

Source functions `registerPushToken`, `unregisterPushToken`, and `onBookingAccepted` are currently not deployed in development, and production push is **No-Go**.

## App Check considerations

App Check enforcement is currently disabled. Do not enable it as incident containment without staged client-token evidence; doing so can block all legitimate calls. If a future enforcement change breaks clients:

1. confirm the failure is App Check-related from redacted metrics/logs;
2. retain authentication and authorization controls;
3. with security/Firebase approval, return to the last approved monitoring or enforcement mode;
4. verify legitimate and modified-client behavior;
5. document the temporary exposure and remediation plan.

Disabling App Check is not a complete security rollback. Authentication, authorization, rate limits, rules, and push kill switches remain required.
