# Production administrator console deployment

## Approved architecture

Deploy the Expo web export to a new, isolated Azure Static Web Apps resource and
optionally bind `admin.<approved-domain>` to that resource. Do not reuse
`swa-karri-mobile-web-test` or its
`nice-ground-08f721010.7.azurestaticapps.net` hostname. The existing Azure
workflow, public sitemap, Android configuration, iOS configuration, and Firebase
backend deployment are not deployment targets for this procedure.

The dedicated workflow is manual and protected by the GitHub environment
`production-admin`. It builds the existing Expo app, validates the administrator
routes and the absence of source maps, removes the customer sitemap from the
admin artifact, publishes a `Disallow: /` robots file, adds a no-index response
header, and deploys only `apps/mobile/dist`.

Expected URL:

```text
https://<new-admin-static-web-app>.azurestaticapps.net/admin-login
```

After DNS approval, the preferred URL is:

```text
https://admin.<approved-domain>/admin-login
```

## Owner-controlled Azure and GitHub setup

1. In Azure Portal, create a new Static Web App for the administrator console.
   Select deployment source **Other** so Azure does not replace repository
   workflows. Do not select, modify, or delete the existing Karri web resource.
2. Copy the new resource's deployment token into the GitHub environment
   `production-admin` as `AZURE_STATIC_WEB_APPS_API_TOKEN_ADMIN`.
3. Require an owner/release approver on the `production-admin` GitHub
   environment.
4. Add these Firebase Web App public configuration values as environment
   secrets. They are identifiers embedded into the web bundle, not service
   credentials:

   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY`

5. In Firebase Authentication, enable Email/Password and add the new Azure
   hostname plus the approved custom domain to Authorized domains.
6. Register the same hostnames for the production Firebase Web App's App Check
   reCAPTCHA Enterprise configuration. The workflow fixes
   `EXPO_PUBLIC_ALLOW_LOCAL_APP_CHECK_BYPASS` to `false`.
7. If using `admin.<approved-domain>`, add it as an Azure Static Web Apps custom
   domain and create the exact DNS record Azure requests. Azure supplies and
   renews HTTPS for the validated hostname.
8. Confirm the production project has the reviewed
   `backend/firebase/firestore.rules` policy deployed. UI routing is only a
   usability boundary; Firestore Rules and authenticated callable guards remain
   the authorization boundary for protected data and mutations.

After the reviewed changes are merged to `main`, deploy with:

```powershell
gh workflow run admin-console-deploy.yml --ref main
```

Record the workflow URL, source SHA, Azure resource name, default hostname,
custom hostname if any, and redacted acceptance results. Verify
`/admin-login`, direct refresh of `/(admin)` and any nested protected route,
anonymous denial, non-admin denial, approved-admin access, sign-out, and
post-revocation denial. Do not record passwords or tokens.

## First administrator and claim lifecycle

The console accepts only the existing top-level custom claim:

```json
{ "role": "super_admin" }
```

The other approved console roles are `moderator`, `operations_admin`, and
`safety_admin`. `user`, `support`, missing, malformed, and unknown roles cannot
enter. The owner-run tool preserves every unrelated custom claim, accepts either
an existing UID or email, requires an Email/Password provider, refuses anonymous
users, redacts its output, and revokes refresh tokens after a change. Use
Application Default Credentials or approved workload identity; do not download
or commit a service-account key.

Install the isolated tool once:

```powershell
npm.cmd --prefix backend/firebase/admin ci
```

Read-only verification:

```powershell
npm.cmd --prefix backend/firebase/admin run auth:admin-console -- verify --project-id "<production-project-id>" --email "<existing-admin-email>"
```

First-admin assignment — production mutation requiring explicit Karri owner
authorization:

```powershell
npm.cmd --prefix backend/firebase/admin run auth:admin-console -- grant --project-id "<production-project-id>" --email "<existing-admin-email>" --role "super_admin" --confirm-production
```

Revocation — production mutation requiring explicit Karri owner authorization:

```powershell
npm.cmd --prefix backend/firebase/admin run auth:admin-console -- remove --project-id "<production-project-id>" --email "<existing-admin-email>" --confirm-production
```

The owner creates or resets the Email/Password account through an authorized
Firebase process. This tool never creates a user and never handles a password.
Claim changes are not trusted from cached session state: the protected layout
forces `getIdTokenResult(true)` before rendering. Revocation also revokes refresh
tokens, so the next forced refresh fails closed or requires reauthentication.

## Rollback

Disable or roll back only the new administrator Static Web App deployment.
Revoking administrator access uses the owner-authorized removal command above.
Do not roll back the marketing website, Android/iOS releases, Firestore Rules,
Functions, or Firebase project configuration as part of an admin web rollback.
