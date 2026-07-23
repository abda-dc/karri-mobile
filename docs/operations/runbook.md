# Operations Runbook

## Scope and safety

These procedures are read-only or local validation unless explicitly labeled otherwise. Use any trusted Karri Mobile clone and set its path explicitly in PowerShell. Do not run deployment commands from this runbook. Do not print environment-variable values, credentials, Firebase configuration files, or signing material.

## Repository baseline

```powershell
$RepositoryRoot = "<path-to-karri-mobile-clone>"
$ExpectedSha = "<approved-candidate-sha>"

Set-Location -LiteralPath $RepositoryRoot

$Branch = (& git branch --show-current).Trim()
$Head = (& git rev-parse HEAD).Trim()
$OriginMain = (& git rev-parse origin/main).Trim()
$RemoteMain = (
    & git ls-remote origin refs/heads/main
).Split("`t")[0].Trim()

if ($Branch -ne "main") {
    throw "Unexpected branch: $Branch"
}

if ($Head -ne $ExpectedSha) {
    throw "Unexpected HEAD: $Head"
}

if ($OriginMain -ne $ExpectedSha) {
    throw "Unexpected origin/main: $OriginMain"
}

if ($RemoteMain -ne $ExpectedSha) {
    throw "Unexpected remote main: $RemoteMain"
}

& git diff --cached --exit-code
if ($LASTEXITCODE -ne 0) {
    throw "Git index is not clean."
}

& git diff --exit-code
if ($LASTEXITCODE -ne 0) {
    throw "Tracked working tree is not clean."
}

git status --short --untracked-files=normal
```

Replace both quoted placeholders before use. Review every reported untracked path against the approved operation scope. Do not enumerate an unrelated directory merely to confirm its top-level presence.

## Mobile validation

```powershell
Push-Location apps/mobile
npm run typecheck
npm run test:public
npx expo-doctor .
Pop-Location
```

For parity with Mobile Validate, the workflow additionally runs `npx vitest run src`, `npx expo export --platform web`, and `npx expo export --platform android`. Exports create local output and are validation only; review generated files before cleanup.

## Firebase validation

Requires Node dependencies and Java for Firebase emulators.

```powershell
npm run firebase:validate
```

This runs Firestore rules tests, a Storage emulator load check, Functions TypeScript build, and Functions tests against demo project `demo-karri-mobile`. It does not deploy.

Narrow checks:

```powershell
npm run firebase:validate:firestore
npm run firebase:validate:storage
npm run firebase:validate:functions
```

## Documentation build

```powershell
.\.venv\Scripts\mkdocs.exe build --strict
```

If the local virtual environment is absent, create/install it only under an approved dependency-maintenance task. Do not publish with `mkdocs gh-deploy` during local validation.

## Exact-SHA GitHub Actions verification

Use the GitHub UI or authenticated `gh` session. Never assume a green run belongs to the candidate SHA.

```powershell
$CandidateSha = (& git rev-parse HEAD).Trim()
$RunId = 123456789

gh run list --commit $CandidateSha --limit 20
gh run view $RunId --json databaseId,workflowName,headSha,status,conclusion,url,jobs
```

Replace `$RunId` with the selected run. Confirm `headSha` equals `$CandidateSha`, the expected jobs completed, and path-filtered workflows that did not run are recorded as “not triggered,” not “passed.”

### Historical H1 inspection evidence

The following is historical inspection evidence, not the default candidate for a future operation:

- Baseline: `dab82705d1f363d1d211905e13ec71af2a80a678`
- Mobile Validate: `29967908163`
- Azure Static Web Apps CI/CD: `29967908186`
- Publish Docs: `29967908216`

Those three workflows succeeded for the H1 baseline. Firebase Validate did not trigger because N4B changed no backend path. Android Build is manual-only.

## EAS build inventory

```powershell
Push-Location apps/mobile
npx eas-cli whoami
npx eas-cli project:info
npx eas-cli build:list --limit 20
Pop-Location
```

Record build ID, platform, profile, status, source SHA, channel, creation time, and artifact retention. Do not download or expose credentials. Historical development builds are not evidence for the H1 SHA.

## EAS Update inventory

```powershell
Push-Location apps/mobile
npx eas-cli branch:list
npx eas-cli channel:list
npx eas-cli update:list --branch development
npx eas-cli update:list --branch preview
npx eas-cli update:list --branch production
Pop-Location
```

As of July 23, 2026, development/preview/production branches and channels exist and no EAS Updates have been published.

## Firebase function inventory

Source export names:

```powershell
Select-String -Path backend/firebase/functions/src/index.ts -Pattern "export const"
```

Deployed development inventory:

```powershell
npx firebase-tools functions:list --project development --config backend/firebase/firebase.json
```

Compare names exactly. Current evidence shows only `submitSafetyReview`, `placeAdministrativeHold`, and `releaseAdministrativeHold` deployed; `registerPushToken`, `unregisterPushToken`, and `onBookingAccepted` are implemented but not deployed.

## Azure Static Web App status

Read-only commands:

```powershell
az account show --output table
az staticwebapp show --name swa-karri-mobile-web-test --resource-group rg-karri-prod --output table
az staticwebapp environment list --name swa-karri-mobile-web-test --resource-group rg-karri-prod --output table
```

Expected observed resource: source `abda-dc/karri-mobile`, branch `main`, status `Ready`, hostname `nice-ground-08f721010.7.azurestaticapps.net`. Do not change Azure state from this runbook.

## Clean closure

```powershell
git diff --check
git diff --stat
git diff --name-status
git status --short --untracked-files=normal
```

Confirm every changed path is authorized, no generated site/build output is included, the index remains clean, and the two expected untracked directories remain top-level entries only. Do not stage, commit, push, deploy, or delete without separate authorization.
