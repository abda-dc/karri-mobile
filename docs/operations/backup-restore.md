# Backup and Restore

## Status

This is a documented recovery procedure, not evidence of a completed backup or restore test. No verified recovery exercise was identified during H1A. Before production, each service needs a named owner, schedule, retention, encryption/access policy, cost approval, and dated restore evidence.

## Firebase-managed services

| Service | Planning requirement | Restore expectation |
| --- | --- | --- |
| Firestore | Scheduled/export-on-demand strategy, retention, export bucket ownership, index/rules/source capture, point-in-time recovery decision | Restore into an isolated project/database first where supported; validate counts, authorization, references, and indexes before any cutover |
| Cloud Storage | Object versioning/soft-delete and retention decision, inventory, evidence privacy, deletion obligations | Recover only approved objects to an isolated prefix/project and verify metadata/authorization; current repository rules deny all access |
| Firebase Auth | Account recovery/export strategy, provider configuration inventory, custom-claim restoration ownership | Treat identity recovery separately from Firestore; never store password hashes or tokens in documentation |
| Cloud Functions | Source, lockfiles, runtime configuration names, IAM, region, and deployed inventory | Rebuild and redeploy reviewed source; secret values come from approved stores, not backup docs |
| App Check | App registrations, provider settings, token/monitoring policy | Restore configuration deliberately; do not enable enforcement merely because a prior config used it |
| Firestore indexes/rules | Versioned repository files plus deployed-state record | Validate locally and deploy narrowly with security approval |

## Firestore export prerequisites

- Billing and an approved Google Cloud Storage bucket in a supported location.
- Least-privilege identity with Firestore export/import and bucket permissions.
- Retention, encryption, lifecycle, cost, privacy, and regional-transfer approval.
- A recorded project/database, export prefix, UTC time, source SHA, schema/version, and responsible operator.
- Sufficient quota and an isolated restore target.

Example commands must be adapted to the approved project and bucket; do not paste live bucket names or credentials into this repository:

```powershell
$ProjectId = "<approved-project-id>"
$RestoreProjectId = "<isolated-restore-project-id>"
$BackupBucket = "<approved-backup-bucket>"
$BackupPrefix = "<approved-prefix>"

gcloud firestore export `
    "gs://$BackupBucket/$BackupPrefix" `
    --project $ProjectId

gcloud firestore import `
    "gs://$BackupBucket/$BackupPrefix" `
    --project $RestoreProjectId
```

Import can overwrite/merge data and incur cost. It requires separate human approval and must not be run during H1A.

## Configuration backup

Version control already protects source, rules, indexes, `app.json`, `eas.json`, workflows, and documentation. Separately inventory, without values:

- EAS environment-variable names and visibility/scope;
- Firebase app registrations, Auth providers, App Check mode, IAM, budgets, and deployed functions;
- GitHub rulesets/protection, environments, Actions permissions, secret names, and release settings;
- Apple/Google application identifiers, signing owners, store roles, and metadata;
- Azure resource inventory, source link, app settings names, access assignments, tags, and locks.

Privileged values and signing material require platform-native protected backup/recovery, not Git.

## Source and documentation recovery

1. Verify the authoritative GitHub repository and known-good commit/tag.
2. Clone to an isolated location and validate signatures/provenance where available.
3. Run documentation, mobile, and Firebase validation.
4. Compare workflow, CODEOWNERS, security, and operations files to the approved release record.
5. Restore branch protections and access separately; cloning source does not restore platform governance.

## EAS and store metadata

Record build IDs, update group IDs, channels/branches, runtime versions, native identifiers, release notes, screenshots, privacy declarations, tester groups, track/status, signing owner, and source SHA. EAS and store history are platform-managed; periodically export permissible metadata without downloading private keys. Recovery must prove control of the same application identities: `com.karrimobile.app`.

## Azure legacy-resource review

Inventory `karri-pg-22107`, `asp-karri-prod`, `app-karri-api-prod`, `app-karri-web-prod`, `app-karri-mobile-web-test`, and `swa-karri-mobile-web-test`. Before any decommission decision, collect dependency, traffic, data classification, database backup/restore, retention, cost, DNS, credential, and rollback evidence. Legacy resources are review candidates only; this document does not authorize deletion or modification.

## Restore exercise acceptance

A restore test is complete only when an isolated target is used, source/export identifiers and checksums/counts are recorded, authorization tests pass, sensitive data is handled under approved policy, application compatibility is verified, recovery time/data loss are measured, and named owners sign the result. A successful export alone is not a restore test.
