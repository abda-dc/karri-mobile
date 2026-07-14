# Production Deployment Transition

## Purpose

Milestone 12.5 prepares Karri Mobile for production and beta deployment readiness before Milestone 13 device validation.

This is not a Supabase migration, not a rebuild of the old Karri monorepo, and not a production cutover approval.

## Deployment recommendation

Karri Mobile should use a native-first deployment path:

1. Android and iOS builds through EAS Build.
2. Safe app updates through EAS Update channels.
3. Firebase Auth, Firestore, Storage rules, and indexes as the mobile backend.
4. Azure only for a landing page, documentation, redirect page, or optional Expo Web deployment.

Azure should not be placed in the runtime path for the native app unless a future backend/API is introduced.

## Current EAS project

- Expo owner: abda.dc
- EAS project: @abda.dc/mobile
- EAS project ID: b73a2031-8f5f-4f59-8222-e999d115b6cb
- App display name: Karri Mobile
- Current Expo slug: mobile
- Android package: com.karri.mobile
- iOS bundle identifier: com.karri.mobile

The Expo slug remains mobile because EAS was originally linked with that slug. The display name and native identifiers carry the production-facing identity.

## EAS build profiles

The mobile app uses apps/mobile/eas.json with three profiles:

| Profile | Purpose | Distribution | Channel |
| --- | --- | --- | --- |
| development | Native development client | Internal | development |
| preview | Device validation candidate | Internal | preview |
| production | Store-ready build later | Store/default | production |

First Android validation build command:

    cd apps/mobile
    npx eas-cli build --platform android --profile preview

Do not run the build until Firebase beta readiness is confirmed.

## Firebase environment strategy

Use separate Firebase projects:

| Environment | Firebase project | Purpose |
| --- | --- | --- |
| Development | karri-mobile-dev | Local and developer testing |
| Beta / Preview | Not created | Internal device validation |
| Production | Not created | Future public production |

Required per environment:

- Firebase Auth configured.
- Anonymous Auth enabled only while the MVP bridge remains in use.
- Firestore database created.
- Firestore rules deployed.
- Firestore indexes deployed.
- Storage rules deployed.
- Storage access remains denied until evidence upload workflow is approved.
- Firebase CLI aliases configured locally.
- Callable Functions deployed only after validation, with explicit region/runtime settings.
- No service-account keys committed.
- No private credentials in EXPO_PUBLIC values.

The only checked-in Firebase alias is `development`, mapped to `karri-mobile-dev` in `backend/firebase/.firebaserc`. Do not add preview or production aliases until those projects exist.

Development Firebase deploy commands:

    npm run firebase:deploy:development:firestore:rules
    npm run firebase:deploy:development:firestore:indexes
    npm run firebase:deploy:development:storage
    npm run firebase:deploy:development:functions
    npm run firebase:deploy:development

These commands invoke `npx firebase-tools`, pass `--project development`, and run predeploy validation/build hooks from `backend/firebase/firebase.json`.

Development rollback uses the previous reviewed source revision:

    git switch <previous-reviewed-branch-or-tag>
    npm run firebase:validate
    npm run firebase:deploy:development

Use the narrow deploy command when only one Firebase surface needs rollback.

## Azure production assessment

Read-only Azure inspection was performed for the current Karri production environment.

### Subscription

| Item | Value |
| --- | --- |
| Subscription name | Visual Studio Enterprise Subscription |
| Tenant ID | 0c8b0fc8-d676-4481-8a82-971b0778bc27 |
| State | Enabled |

### Karri Azure inventory

| Resource | Name | Resource group | Region | State / Notes |
| --- | --- | --- | --- | --- |
| App Service Plan | asp-karri-prod | rg-karri-prod | Central US | Linux plan, hosts 2 apps |
| Web App | app-karri-web-prod | rg-karri-prod | Central US | Running, Node 22 LTS |
| API App | app-karri-api-prod | rg-karri-prod | Central US | Running, Node 22 LTS |
| Static Web App | None found for Karri | n/a | n/a | Karri does not use Azure Static Web Apps today |
| Key Vault | None found for Karri | n/a | n/a | No Karri Key Vault discovered |
| Storage Account | None found for Karri | n/a | n/a | No Karri storage account discovered |

### Current production topology

User browser -> app-karri-web-prod.azurewebsites.net -> app-karri-api-prod.azurewebsites.net -> production database

### Web app configuration

| Item | Value |
| --- | --- |
| App Service | app-karri-web-prod |
| Default hostname | app-karri-web-prod.azurewebsites.net |
| Runtime | NODE\|22-lts |
| Startup command | node apps/web/server.js |
| HTTPS only | true |
| Deployment Center repo | None configured |
| Deployment slots | None found |

### API app configuration

| Item | Value |
| --- | --- |
| App Service | app-karri-api-prod |
| Default hostname | app-karri-api-prod.azurewebsites.net |
| Runtime | NODE\|22-lts |
| Startup command | node dist/main.js |
| HTTPS only | true |
| Deployment Center repo | None configured |
| Deployment slots | None found |

### Domain mapping

| Surface | Current hostname | Custom domain | SSL binding |
| --- | --- | --- | --- |
| Karri Web | app-karri-web-prod.azurewebsites.net | None found | Azure default HTTPS |
| Karri API | app-karri-api-prod.azurewebsites.net | None found | Azure default HTTPS |

### Current deployment source

Azure Deployment Center does not show a GitHub, Azure DevOps, or branch-based deployment source for either Karri App Service.

The App Services expose MSDeploy, FTP/FTPS, and ZipDeploy publishing profiles. The current production deployment was likely published manually, by ZipDeploy, or by an external workflow.

Publishing profile credentials were exposed during local inspection output and should be rotated after this assessment.

## Azure transition decision

Keep Azure resources as-is for now.

- Keep app-karri-api-prod unchanged.
- Keep current production API hostname: app-karri-api-prod.azurewebsites.net.
- Only transition or swap the web-facing deployment source/repo when ready.
- Do not modify DNS, custom domains, SSL, App Service settings, or API resources during Milestone 12.5.

Karri Mobile native runtime should use Firebase directly:

Karri Mobile native app -> Firebase Auth + Firestore + Firebase Storage rules

## Cutover strategy

No production cutover should occur during Milestone 12.5.

Future cutover sequence:

1. Keep app-karri-api-prod unchanged.
2. Decide whether app-karri-web-prod becomes a landing page, redirect page, Expo Web deployment, or remains unchanged.
3. Validate replacement web deployment in staging or a temporary App Service.
4. Preserve the current web artifact for rollback.
5. Swap only the web deployment/repo after approval.
6. Verify app-karri-web-prod.azurewebsites.net after deployment.

## Rollback strategy

Current production has no deployment slots, no Azure Deployment Center rollback enabled, and no GitHub source configured.

Rollback must rely on redeploying the previous known-good Karri web artifact or restoring the previous deployment workflow.

## Remaining Azure blockers

- Current production web artifact source is not identified.
- No staging slot exists.
- No custom domain is attached.
- No formal rollback artifact is documented.
- Publishing profile credentials should be rotated.
- Final web replacement target is not selected yet.

## Azure inspection checklist

Suggested read-only commands:

    az account show --output table
    az group list --output table
    az webapp list --output table
    az staticwebapp list --output table

Record:

- Subscription
- Resource group
- App Service or Static Web App name
- Current hostname
- Custom domains
- Deployment source
- App settings
- DNS records
- Rollback path

## Device validation prerequisites

Milestone 13 should not begin until:

- EAS preview profile exists.
- Android preview APK build succeeds.
- Firebase beta project exists and matches app config.
- Auth provider required by the MVP works.
- Firestore rules and indexes are deployed to beta.
- Callable Functions are deployed to the same reviewed Firebase environment, or the client paths that depend on them remain disabled.
- npm run test:rules passes.
- npm run test:functions passes.
- npx expo-doctor passes.
- npx tsc --noEmit passes.
- No Azure production cutover is mixed into device validation.

## Known risks

- Anonymous authentication bridge blocks external validation unless enabled or replaced.
- App Check is not enforced yet.
- Storage access is intentionally denied.
- Callable Functions use `us-east1`, bounded instances, and App Check enforcement disabled temporarily for development.
- Push delivery is not production-complete.
- Multi-party booking and custody writes remain client-orchestrated.
- No payments, disputes, admin console, mobile money, GPS, or carrier integrations are included.

## Verification commands

Run before committing:

    cd C:\Users\Kiya\Documents\karri-mobile
    npm run firebase:validate
    npm run test:rules
    npm run test:functions

    cd apps/mobile
    npx expo-doctor
    npx tsc --noEmit
    npx expo config --type public

    cd ..\..
    .\.venv\Scripts\mkdocs.exe build
    git diff --check
    git status --short

## Decision

Milestone 12.5 prepares deployment readiness. It does not perform production replacement.

Recommended next sequence:

1. Finish this documentation/config commit.
2. Create or confirm karri-mobile-beta.
3. Deploy Firestore rules and indexes to beta.
4. Confirm Auth works in beta.
5. Build Android preview APK through EAS.
6. Start Milestone 13 real-device validation.
7. Inspect Azure production resources separately before any public cutover.

## Milestone 12.5 Static Web Apps validation update

Temporary Azure Linux App Service validation was abandoned because Kudu/ZipDeploy extraction produced invalid mixed Linux and Windows paths during deployment. The issue was infrastructure-related, not application-related.

A new temporary Azure Static Web Apps validation environment was created instead:

| Item | Value |
| --- | --- |
| Static Web App | swa-karri-mobile-web-test |
| Resource group | rg-karri-prod |
| Region | Central US |
| Validation hostname | https://nice-ground-08f721010.7.azurestaticapps.net |
| Repository | https://github.com/abda-dc/karri-mobile |
| Branch | main |
| App location | apps/mobile |
| Output location | dist |
| Build command | npx expo export --platform web |

GitHub Actions now deploys the Expo static web export through:

    .github/workflows/azure-static-web-apps-nice-ground-08f721010.yml

Firebase public web configuration is provided through GitHub Actions secrets. Do not commit `.env.local`, `.env`, Firebase values, or deployment tokens.

Required GitHub Actions secrets:

- EXPO_PUBLIC_FIREBASE_API_KEY
- EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- EXPO_PUBLIC_FIREBASE_PROJECT_ID
- EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
- EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- EXPO_PUBLIC_FIREBASE_APP_ID
- AZURE_STATIC_WEB_APPS_API_TOKEN_NICE_GROUND_08F721010

Validation result:

- Static Web Apps deployment succeeded.
- Firebase configuration loaded in the deployed Expo web build.
- The previous "Karri is not configured for this environment" blocker was resolved.
- Production resources remained untouched.

The old temporary App Service remains non-production and should not be used for further web validation:

    https://app-karri-mobile-web-test.azurewebsites.net

Recommended cleanup after Milestone 12.5 is safely committed:

1. Stop the old temporary App Service.
2. Keep it briefly as a safety reference.
3. Delete it later after the Static Web Apps validation path is accepted.
