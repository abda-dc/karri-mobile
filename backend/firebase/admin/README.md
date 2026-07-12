# Firebase Custom Claims Role Provisioning & Revocation Tool

This isolated package provides secure, server-authoritative command-line utilities to inspect and manage user custom claim authorization roles (`user`, `support`, `moderator`, `operations_admin`, `safety_admin`, `super_admin`) for the **Karri Mobile** application.

---

## Setup & Installation

From the `backend/firebase/admin/` directory:

1. Install local dependencies:
   ```bash
   npm install
   ```

---

## Authentication & Credentials Strategy

To run the commands, the Firebase Admin SDK requires credentials loaded securely based on the environment:

### 1. Local Emulator Mode
If the Firebase Auth Emulator is running, set the environment variable:
```bash
# Windows PowerShell
$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
# Linux / macOS
export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
```
In emulator mode, `firebase-admin` automatically bypasses production checks and operates without requiring a local service-account file.

### 2. Local Operator Mode
Ensure your terminal has authenticated Application Default Credentials (ADC):
```bash
gcloud auth application-default login
```
Alternatively, set the path to a downloaded service-account JSON key (never commit this key file to Git):
```bash
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\service-account.json"
```

### 3. Production Operator Mode
For production usage, the environment should load credentials via Google Cloud Application Default Credentials (ADC) or Workload Identity Federation in CI/CD pipelines.

---

## Commands

All commands are run from the `backend/firebase/admin/` directory.

### 1. View Custom Claims
Retrieve the current custom claims dictionary for a target user:
```bash
npm run auth:claims:get -- --uid "<firebase-uid>"
```

### 2. Provision Authorization Role
Set one of the supported authorization roles (`support`, `moderator`, `operations_admin`, `safety_admin`, `super_admin`). Unrelated custom claims are preserved:
```bash
npm run auth:role:set -- --uid "<firebase-uid>" --role "operations_admin"
```

### 3. Remove Authorization Role
Clear the administrative role claim from the target user. Unrelated custom claims are preserved:
```bash
npm run auth:role:remove -- --uid "<firebase-uid>"
```

### 4. Explicitly Revoke Refresh Tokens
Force-revoke active sessions/refresh tokens for a user, requiring them to re-authenticate next time their ID token expires:
```bash
npm run auth:tokens:revoke -- --uid "<firebase-uid>"
```

### 5. Bootstrap First Super Admin
One-time procedure to provision the first `super_admin` role. Requires an explicit confirmation flag to prevent accidental execution:
```bash
npm run auth:bootstrap:super-admin -- --uid "<firebase-uid>" --confirm-super-admin-bootstrap
```

---

## Post-Execution Token Revocation & No-Op Skip Optimization
*   **Idempotency & Skip**: Whenever the requested role matches the user's current role, the tool reports `No Change: ...` and skips calling both `setCustomUserClaims` and `revokeRefreshTokens` to optimize performance and prevent unnecessary re-authentication.
*   **Token Revocation**: When the role actually changes, the tool automatically revokes the target user's refresh tokens (`revokeRefreshTokens`). This forces active client sessions to re-authenticate and fetch a fresh ID token result on their next authorization check.

---

## Troubleshooting, Rollbacks, & Safety Boundaries

### 1. Removing a Mistaken Role (Rollback)
If you provisioned a role to a user in error, roll it back by removing the administrative role:
```bash
npm run auth:role:remove -- --uid "<firebase-uid>"
```
This strips the administrative role and immediately revokes all active refresh tokens, forcing them back to standard `"user"` permissions.

### 2. Recovering from a Failed Bootstrap
If a bootstrap operation failed or was assigned to the wrong UID:
1. Revoke the administrative access from the incorrect user:
   ```bash
   npm run auth:role:remove -- --uid "<incorrect-uid>"
   ```
2. Re-run bootstrap on the correct UID:
   ```bash
   npm run auth:bootstrap:super-admin -- --uid "<correct-uid>" --confirm-super-admin-bootstrap
   ```

### 3. Verifying Current Claims
Verify that the role change was correctly committed:
```bash
npm run auth:claims:get -- --uid "<firebase-uid>"
```
Ensure the output JSON shows the correct `role` in the claims object.

### 4. Verifying Token Refresh (Client App)
If the mobile client still shows the old role status, force a claims refresh on the client device by calling the hook's `refreshAuthorization()` method, or have the user sign out and sign back in.

### 5. Troubleshooting Application Default Credentials (ADC) Failures
If you receive a `Could not load the default credentials` error:
*   Ensure Google Cloud SDK is installed, and run `gcloud auth application-default login` in your terminal.
*   If using a service account JSON file, confirm that `$env:GOOGLE_APPLICATION_CREDENTIALS` (or `export GOOGLE_APPLICATION_CREDENTIALS="..."`) points to a valid file path and that the key has not been deleted or disabled in the Google Cloud Console.
