# CI/CD

## Current automation

GitHub Actions publishes the MkDocs Material site from `main`. The workflow installs `requirements-docs.txt`, runs `mkdocs build --strict`, and deploys GitHub Pages.

Mobile and Firebase deployment are not automated in the current repository.

## Required pull-request checks

The next CI increment should run from a clean checkout:

```text
cd apps/mobile
npm ci
npx tsc --noEmit
npx expo-doctor

cd ../..
python -m pip install -r requirements-docs.txt
mkdocs build --strict
```

When emulator tests exist, CI should also compile Firebase rules and run allowed/denied authorization cases.

## Mobile delivery direction

- EAS Build creates signed iOS and Android artifacts from reviewed commits.
- Separate development, preview, and production Firebase projects prevent test data from reaching production.
- Environment-specific public Firebase configuration is injected by the build environment.
- EAS Update is used only for compatible JavaScript/assets and follows a rollback policy.
- Store submission remains an explicit, approved release action.

## Firebase delivery direction

Deploy rules, indexes, functions, and configuration from version-controlled source with project aliases. Production deployment requires passing emulator tests, a reviewed diff, and a rollback/incident plan. Client release and rule tightening must be sequenced so supported app versions continue to function.

## Supply-chain hygiene

Use `npm ci` in automation, review lockfile changes, pin action major versions, run dependency and secret scanning, and avoid long-lived Firebase service-account keys where workload identity is available.
