# Deployment Guide

## Approval boundary

This guide documents commands; H1A does not execute them. Every deployment requires a named human approver, exact source SHA, clean repository, validated rollback path, target-environment confirmation, and a completed [Release Checklist](../release-checklist.md). Never substitute a production target for the explicit development commands.

Preview and production EAS environments currently have no project-scoped variables. Do not build or publish for those environments until the required non-secret/native configuration and secret material are provisioned and independently verified.

## Firebase Functions — development

**Preconditions:** approver names `karri-mobile-dev`; CLI identity and alias are verified; source/deployed function comparison is recorded; push remains off; rollback SHA is selected.

**Validation:**

```powershell
npm run firebase:validate:functions
npx firebase-tools functions:list --project development --config backend/firebase/firebase.json
```

**Deployment:**

```powershell
npm run firebase:deploy:development:functions
```

**Post-deployment verification:** rerun `functions:list`; confirm region/runtime names; inspect redacted logs; run only a separately approved development smoke test. Verify `registerPushToken`, `unregisterPushToken`, and `onBookingAccepted` only if their deployment was approved. A deployed name is not proof of device behavior.

**Rollback:** [Firebase Functions rollback](rollback.md#firebase-functions).

**Human approval:** Firebase/backend owner and release owner; security owner if callable surface or runtime configuration changed.

## Firestore rules and indexes — development

**Preconditions:** exact rules/index diff reviewed; Emulator Suite coverage passes; query/index impact reviewed; previous reviewed revision available.

**Validation:**

```powershell
npm run firebase:validate:firestore
```

**Deployment:**

```powershell
npm run firebase:deploy:development:firestore:rules
npm run firebase:deploy:development:firestore:indexes
```

**Post-deployment verification:** inspect Firebase console deployment state; run approved allow/deny smoke checks with test identities; confirm required indexes reach ready state.

**Rollback:** [Firestore and Storage rules rollback](rollback.md#firestore-and-storage-rules).

**Human approval:** Firebase/backend owner and security owner.

## Storage rules — development

**Preconditions:** Storage remains deny-all unless an approved evidence workflow, privacy/retention decision, and authorization tests exist.

**Validation:**

```powershell
npm run firebase:validate:storage
```

**Deployment:**

```powershell
npm run firebase:deploy:development:storage
```

**Post-deployment verification:** confirm deployed rules match the approved file and unauthorized reads/writes remain denied.

**Rollback:** [Firestore and Storage rules rollback](rollback.md#firestore-and-storage-rules).

**Human approval:** Firebase/backend, security, and privacy owners.

## EAS development build

**Preconditions:** development EAS variables are present; Firebase native files match `karri-mobile-dev`; credentials and device registration are owned; source SHA is clean. Never print variable values.

**Validation:**

```powershell
Push-Location apps/mobile
npx expo-doctor .
npm run typecheck
npx eas-cli env:list --environment development
Pop-Location
```

**Deployment/build command:**

```powershell
Push-Location apps/mobile
npx eas-cli build --platform all --profile development
Pop-Location
```

Use `--platform android` or `--platform ios` when approval is platform-specific.

**Post-deployment verification:** record build IDs, source SHA, profile, platform, status, native identifiers, and internal distribution controls; perform the approved physical-device matrix.

**Rollback:** stop distributing the build, revoke its internal access where supported, and return testers to the prior approved build. Native capability changes require a new build.

**Human approval:** mobile release owner and platform credential owner.

## EAS preview build

**Preconditions:** **blocked today** because preview has no project-scoped EAS variables. Provision and verify a matching preview Firebase environment and credentials before approval.

**Validation:**

```powershell
Push-Location apps/mobile
npx expo-doctor .
npm run typecheck
npx eas-cli env:list --environment preview
Pop-Location
```

**Deployment/build command:**

```powershell
Push-Location apps/mobile
npx eas-cli build --platform all --profile preview
Pop-Location
```

**Post-deployment verification:** record exact build/SHA/environment linkage and complete real-device acceptance without mixing development or production credentials.

**Rollback:** withdraw the candidate and restore the prior approved internal build.

**Human approval:** mobile, Firebase environment, security, and release owners.

## EAS production build

**Preconditions:** **No-Go today.** Production has no project-scoped EAS variables; legal decisions, current-SHA device evidence, App Check decision, signing ownership, store metadata, rollback, and production approvals are incomplete.

**Validation:**

```powershell
Push-Location apps/mobile
npx expo-doctor .
npm run typecheck
npx eas-cli env:list --environment production
Pop-Location
```

**Deployment/build command:**

```powershell
Push-Location apps/mobile
npx eas-cli build --platform all --profile production
Pop-Location
```

**Post-deployment verification:** record build IDs/source SHA, signing identity, runtime version, native identifiers, environment completeness, artifact checks, and store eligibility. Building does not authorize submission.

**Rollback:** contain distribution and restore the last approved native binary; use EAS Update only when runtime compatibility and update policy permit.

**Human approval:** named product, mobile release, security, privacy/legal, Firebase, and store owners.

## Android GitHub workflow dispatch

**Preconditions:** exact SHA is selected; required GitHub secrets and Play role are verified without disclosure; track/status are explicitly chosen; current workflow risk is accepted. The workflow has no GitHub environment approval, conditional release guard, or explicit permissions block, and `completed` is selectable.

**Validation:**

```powershell
gh workflow view android-build.yml
gh run list --workflow android-build.yml --limit 10
```

**Deployment/dispatch command:**

```powershell
$ApprovedRef = "<approved-ref>"

gh workflow run android-build.yml `
    --ref $ApprovedRef `
    -f play_track=alpha `
    -f release_status=draft
```

Do not use `completed` without explicit store-release approval.

**Post-deployment verification:** verify run `headSha`, signed APK/AAB checks, artifact hashes, package `com.karrimobile.app`, Play track, and release status. Historical run `29647700047` is not current-SHA approval.

**Rollback:** [Android testing release containment](rollback.md#android-testing-release-containment).

**Human approval:** GitHub release owner, Android signing owner, and Google Play release owner.

## iOS store build prerequisites

**Preconditions:** paid Apple Developer team; verified Account Holder/Admin access; bundle ID `com.karrimobile.app`; APNs capability, certificates/profiles, registered test devices, App Store Connect record, privacy/legal metadata, production EAS variables, and signing recovery. No current store/TestFlight evidence exists.

**Validation:**

```powershell
Push-Location apps/mobile
npx expo-doctor .
npx eas-cli credentials --platform ios
npx eas-cli env:list --environment production
Pop-Location
```

Do not copy credential output into documentation.

**Deployment/build command:**

```powershell
Push-Location apps/mobile
npx eas-cli build --platform ios --profile production
Pop-Location
```

Submission, if separately approved, is a distinct action: `npx eas-cli submit --platform ios --profile production`.

**Post-deployment verification:** record build ID/SHA, signing team, bundle ID, App Store Connect build state, TestFlight review state, and submission evidence.

**Rollback:** stop distribution/submission, expire the affected build where supported, and prepare a corrected build; App Store binaries cannot be remotely replaced.

**Human approval:** Apple Account Holder or delegated release owner, mobile owner, privacy/legal owner, and final release approver.

## EAS Update publishing prerequisites

**Preconditions:** no EAS Updates exist today; update owner, runtime compatibility, channel/branch mapping, environment variables, rollback update, and device acceptance are approved. EAS Update cannot add native notification capability or credentials.

**Validation:**

```powershell
Push-Location apps/mobile
npm run typecheck
npx eas-cli channel:list
npx eas-cli branch:list
$TargetBranch = "development"
npx eas-cli update:list --branch $TargetBranch
Pop-Location
```

**Deployment/publish command:**

```powershell
Push-Location apps/mobile
$TargetBranch = "development"
$UpdateMessage = "<approved change and source SHA>"
npx eas-cli update --branch $TargetBranch --message $UpdateMessage
Pop-Location
```

**Post-deployment verification:** record update group ID, source SHA, runtime version, branch/channel, rollout audience, and device acceptance.

**Rollback:** [EAS Update rollback](rollback.md#eas-update).

**Human approval:** mobile release owner and environment owner; production also requires final product/security approval.
