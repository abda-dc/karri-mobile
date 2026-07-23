# Owner Handoff

## Transfer rule

Existing access must not be removed until the receiving owner has logged in and independently verified the required access. Use least privilege, two separately controlled recovery methods where the platform supports them, and a dated evidence record. Never place passwords, tokens, private keys, certificates, service-account JSON, signing material, or personal recovery details in this repository.

The current observations below are from July 23, 2026. “Not observed” means no evidence was available during H1 inspection; it is not proof that access or an account does not exist.

## Ownership matrix

| Platform | Current observed owner/account | Required receiving-owner access | Verification procedure | Transfer sequence | Recovery dependency | Known gap |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub | Organization/user owner `abda-dc`; only direct collaborator observed was `abda-dc` | Repository administration, Actions/settings review, branch/ruleset management, secrets governance | Receiving owner signs in, opens `abda-dc/karri-mobile`, confirms admin settings access, reviews audit/security pages, and reads Actions without exposing secrets | Invite receiving owner; verify; add branch/ruleset controls; record approval; only then review old access | Verified GitHub identity, MFA/passkey, organization recovery owner | No branch protection/rulesets; no verified second owner; public repository |
| Expo/EAS | Account `abda.dc`; project `@abda.dc/mobile`; project ID `b73a2031-8f5f-4f59-8222-e999d115b6cb` | Project administration, build/update inventory, credentials oversight, environment-variable management | Run `npx eas-cli whoami`, `npx eas-cli project:info`, read build/update/environment inventory, and confirm identifiers without printing values | Add member at least privilege; verify project and credentials visibility; document release roles; only then consider access changes | Expo account recovery, MFA, Apple/Google credential owners | Preview/production project variables absent; recovery and credential-owner evidence incomplete |
| Firebase | Development project `karri-mobile-dev`; a personal Google account was observed in the authenticated CLI session, with the exact identity retained only in private transfer evidence | Firebase project administration appropriate to duties, Auth/Firestore/Functions/App Check visibility | Receiving owner selects the project in Firebase console, confirms registered apps, rules/indexes, function inventory, and App Check state; CLI inventory must use a non-secret authenticated session | Add through Google Cloud/Firebase IAM; verify console and CLI; assign narrower roles where practical; review old access later | Google identity recovery and Google Cloud IAM owner | Current long-term platform ownership is not publicly documented; only the development project is documented; three source functions are not deployed |
| Google Cloud | Project backing `karri-mobile-dev`; specific organization/owner not established by H1 | IAM, billing visibility as required, Functions/Firestore/Storage/log access, credential rotation authority | Confirm project number/name in console, inspect IAM and billing link, and verify least-privilege access without exporting credentials | Establish receiving admin; add service-specific operators; verify audit access; review legacy principals | Google Cloud organization/billing owner and separately controlled super-admin recovery | Ownership hierarchy, billing owner, service-account policy, and break-glass path not fully evidenced |
| Azure | One inherited subscription-level Owner observed; no separate Contributor | Read inventory, Static Web App administration, cost/activity-log access; legacy resources only as approved | Run read-only `az account show`, list `rg-karri-prod`, inspect `swa-karri-mobile-web-test`, and confirm activity/cost visibility | Add receiving owner/operator with least privilege; verify; tag ownership/lifecycle after approval; conduct legacy review separately | Microsoft Entra/subscription owner and billing recovery | No separate Contributor, locks, or lifecycle tags; legacy dependencies and decommission evidence unresolved |
| Apple Developer | No receiving-owner or store submission evidence observed | Account Holder/Admin as appropriate, certificates/identifiers/profiles, App Store Connect release and recovery roles | Receiving owner signs in, confirms team, bundle ID `com.karrimobile.app`, signing assets, registered devices, and App Store Connect application state | Identify Account Holder; invite role; verify both Developer portal and App Store Connect; document signing recovery before reducing access | Apple Account Holder and protected recovery/signing custody | No iOS store build or TestFlight/App Store submission evidence |
| Google Play | Historical testing upload in workflow run `29647700047`; account owner not observed | Play Console application/release access, testing-track management, app signing and service-account governance | Receiving owner signs in, confirms package `com.karrimobile.app`, testing release state, app-signing status, and API access without exporting keys | Invite role; verify application and track access; rotate/re-scope automation credentials if ownership changes; review prior access | Play account owner, Google identity recovery, app-signing recovery | Current-SHA release absent; workflow lacks approval guard/environment |
| Azure Static Web Apps | `swa-karri-mobile-web-test` in `rg-karri-prod`, connected to `abda-dc/karri-mobile` `main` | Resource read/operate access plus GitHub workflow/settings coordination | Confirm Azure status `Ready`, source repo/branch, hostname, activity log, and corresponding GitHub workflow | Verify Azure access first; verify GitHub access; document deployment token rotation owner; test only under a separately approved change | Azure subscription owner plus GitHub repository admin | No resource lock/ownership tags; rollback exercise not evidenced |

## Transfer evidence record

For each platform, record outside this repository if it contains private identity details:

- receiving owner and business role;
- date/time and verifier;
- role granted;
- independent login and read/administration checks completed;
- MFA/recovery ownership confirmed without recording recovery secrets;
- old-access review date;
- unresolved least-privilege or billing dependency.

## Safe sequence

1. Name the receiving owner and backup owner.
2. Add receiving access without altering existing access.
3. Have the receiving owner independently log in and perform the matrix verification.
4. Confirm release, billing, audit, credential-rotation, and recovery responsibilities.
5. Establish repository protections and platform-specific least privilege.
6. Record a dated acceptance decision.
7. Only after all prior steps succeed, separately approve any removal or reduction of existing access.

## Handoff gaps

- Production remains **No-Go**; owner transfer does not authorize deployment.
- Preview and production EAS variables are missing.
- Firebase source and deployed function inventories differ.
- No current-SHA Android/iOS native builds or physical-device acceptance evidence exists.
- No iOS store/TestFlight evidence exists.
- Push delivery remains default-off and not production approved.
- App Check enforcement remains disabled.
- GitHub governance controls and verified secondary ownership are absent.
- Azure legacy resources require evidence-backed owner review, not automatic deletion.
- Final `PRIVACY.md`, `TERMS.md`, and `LICENSE` decisions require owner/legal approval.

Use [Project Status](project-status.md), [Operations Runbook](operations/runbook.md), and [Release Checklist](release-checklist.md) to close these gaps.
