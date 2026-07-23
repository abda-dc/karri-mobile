# Security Policy

## Supported project status

Karri Mobile is an internal beta candidate, not a production-approved release. Security fixes should target the current `main` branch. No production push authorization, App Check enforcement, current-SHA native release approval, or external-beta approval exists as of July 23, 2026.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, exposed credential, personal data, or reproducible abuse path.

No dedicated security mailbox is documented. Contact the repository owner, `@abda-dc`, through a private, authenticated channel and request a secure reporting route. Share only the minimum information needed to establish contact until the owner confirms that route. If repository-owner access is suspected to be compromised, use a separately verified platform-owner channel.

Include affected version or SHA, impact, safe reproduction steps, and suggested containment. Do not include live secrets, access tokens, private keys, personal data, or production exploit output.

## Secret handling

- Never commit passwords, API tokens, service-account JSON, signing keys, certificates, provisioning profiles, recovery codes, provider credentials, or private Firebase/Expo/Azure/GitHub values.
- Treat push tokens as authentication-adjacent data. Do not place them in logs, screenshots, analytics, notification records, delivery effects, or support exports.
- Firebase mobile configuration is public application metadata, not privileged authorization. Still keep environment-specific files out of Git and do not mistake public configuration for permission to access backend data.
- Store privileged credentials only in an approved platform credential store or secret manager with least privilege, named ownership, rotation, and auditability.
- Redact sensitive output before attaching diagnostics to issues, pull requests, or documentation.
- Rotate or revoke exposed privileged credentials; changing only repository history is not containment.

## Access review

Review GitHub, Expo/EAS, Firebase, Google Cloud, Azure, Apple Developer, Google Play, and Azure Static Web Apps access at each owner handoff and at least quarterly once a release environment exists. Record named owners, least-privilege roles, recovery dependencies, inactive accounts, and the review date without recording personal recovery details.

Existing access must not be removed until the receiving owner has logged in and independently verified the required access.

## Account compromise

1. Use a separately trusted owner account to contain the affected identity and revoke active sessions or credentials.
2. Preserve audit logs, timestamps, affected resource identifiers, and source SHAs without copying secrets into the incident record.
3. Disable risky release or push paths when abuse is possible.
4. Rotate affected privileged credentials and verify old credentials no longer work.
5. Compare repository, workflow, Firebase, EAS, store, and Azure state against a known-good SHA and inventory.
6. Notify the receiving owner and follow [Incident Response](docs/operations/incident-response.md).

## Security-sensitive areas

- `.github/workflows/` and release configuration
- `apps/mobile/src/infrastructure/firebase/` and authentication/session boundaries
- `apps/mobile/src/application/services/AuthSessionService.ts`
- `apps/mobile/src/application/services/PushRegistrationService.ts`
- `backend/firebase/functions/`
- `backend/firebase/firestore.rules`, `backend/firebase/storage.rules`, and indexes
- Firebase aliases, EAS configuration, native identifiers, and notification credentials
- Owner-handoff, deployment, rollback, incident, and backup procedures

## Production security blockers

Production remains **No-Go** while any required release evidence is absent. Current blockers include disabled App Check enforcement without an approved rollout decision, default-off push delivery without production authorization, missing preview/production EAS project variables, no current-SHA Android or iOS build evidence, no iOS store/TestFlight evidence, incomplete physical-device acceptance, incomplete monitoring and recovery exercises, missing branch protection/rulesets, and unresolved privacy, terms, and license decisions.
