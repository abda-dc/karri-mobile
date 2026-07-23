# Incident Response

## Severity

| Level | Definition | Initial response target |
| --- | --- | --- |
| SEV-1 | Active privileged-account compromise, unauthorized release/send, confirmed sensitive user-data exposure, or loss of production control | Immediate owner escalation and containment |
| SEV-2 | Credible credential exposure, broken release affecting many testers/users, failed deployment with security or data risk, or signing-access loss near release | Same business day |
| SEV-3 | Contained development incident, unsuccessful attack, non-sensitive configuration exposure, or limited operational failure | Next business day |
| SEV-4 | Process weakness or near miss with no demonstrated impact | Track and review |

Targets are operational goals, not service-level guarantees. Production support coverage has not been established.

## Common procedure

1. **Contain:** stop unsafe release, deployment, push, or credential use through the owning platform.
2. **Preserve evidence:** record UTC timestamps, source SHA, build/update/run IDs, affected resource names, audit-log references, and observed behavior. Never copy secret values or unnecessary personal data.
3. **Notify:** contact the named platform owner, security owner, product owner, privacy/legal owner when user data may be involved, and receiving owner during handoff.
4. **Recover:** rotate/revoke privileged credentials, restore known-good configuration/artifacts, verify access and behavior independently, and keep optional push off.
5. **Review:** within five business days for SEV-1/2, document cause, control failures, impact, corrective owners/dates, and whether user/regulator notice requires legal determination.

## Scenario playbooks

### Compromised GitHub account

Use a separately verified administrator to suspend/restrict the identity, revoke sessions/tokens/SSH keys as appropriate, protect branches and Actions, and preserve audit logs. Compare commits, tags, workflow files, secrets configuration, releases, and Pages/Static Web Apps runs to a known-good SHA. Rotate downstream credentials that GitHub could access and verify old credentials fail.

### Compromised Expo/EAS account

Restrict the account/project, revoke sessions/tokens, stop build/update activity, preserve build/update/credential audit evidence, and verify channels/branches. Review native credentials and connected Apple/Google access. Republish or rebuild only from a verified SHA after receiving-owner access is confirmed.

### Compromised Firebase or Google Cloud account

Use an unaffected organization/project administrator to contain IAM, revoke sessions/keys, disable abused service accounts or functions where safe, and preserve Cloud Audit Logs. Compare rules, indexes, functions, App Check, Auth providers, and billing changes. Keep push off. Restore reviewed rules/functions only after validation.

### Compromised Azure account

Use an unaffected Entra/subscription owner to contain the identity and privileged assignments. Preserve activity logs, deployments, resource configuration, and billing evidence. Review `rg-karri-prod`, Static Web Apps linkage, App Services, PostgreSQL, publishing credentials, and access changes. Do not delete legacy resources during response unless separately required for containment and approved.

### Leaked Firebase mobile configuration

Firebase mobile API keys/configuration identify the app/project and are not privileged credentials by themselves. Confirm no privileged credential was included, inspect Auth/rules/App Check/billing abuse, restrict API keys appropriately without breaking the app, and fix authorization controls. Do not rotate public configuration as if it were a service-account key.

### Leaked privileged credential

Treat service-account JSON, Firebase CLI tokens, Expo access tokens, Azure deployment tokens/publishing profiles, Apple/APNs private keys, Android keystores/passwords, and store API credentials as SEV-1/2 depending on reach. Revoke/rotate at the owning platform, verify old access fails, inspect audit/release activity, and replace dependent configuration without committing the new value.

### Push notification abuse

Set `KARRI_PUSH_DELIVERY_ENABLED` to anything other than exact `true`, contain provider credentials, preserve notification/delivery IDs and provider outcome metadata, and identify affected cohort/content without exporting raw tokens. Keep canonical in-app records. Production push is currently No-Go and the delivery functions are not deployed in development.

### Broken release

Stop rollout/distribution, record exact SHA/build/update/track, preserve crash/support evidence, and follow [Rollback](rollback.md). Do not use EAS Update for a native incompatibility. Communicate scope and recovery to named testers/users.

### Failed Firebase deployment

Stop repeated deployments, capture CLI error without credentials, compare partial deployed inventory to the pre-deployment record, and determine which surfaces changed. Validate and redeploy the prior reviewed revision with Firebase/security approval. Do not classify a CLI failure as “no change” without inventory evidence.

### Lost device-signing access

Stop release attempts. Contact the verified Apple Account Holder, Google Play owner/app-signing recovery path, or EAS credential owner. Preserve certificate/profile/key identifiers but not private material. Do not create an untracked replacement identity or bypass store ownership.

### User-data incident

Contain access and affected processing, preserve minimum necessary audit evidence, identify data types/users/time window/regions, and involve privacy/legal ownership immediately. Do not notify publicly or promise deletion/impact conclusions before legal and technical review. Validate Firestore, Storage, Auth, logs, backups/exports, and support artifacts.
