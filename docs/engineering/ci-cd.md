# CI/CD

## Current automation

GitHub Actions publishes the MkDocs Material site from `main`. The workflow installs `requirements-docs.txt`, runs `mkdocs build --strict`, and deploys GitHub Pages.

The Android release workflow is manual and builds signed APK/AAB artifacts. The Azure Static Web Apps workflow deploys the Expo web export for the current validation environment.

Firebase deployment is not automated. A Firebase validation workflow runs for changes under `backend/firebase/**` and checks rules, Storage rule loading, Functions build, and emulator-backed Functions tests without live Firebase credentials.

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

Current Firebase validation from a clean checkout:

```text
npm ci
npm ci --prefix backend/firebase/functions
npm run firebase:validate
```

## Mobile delivery direction

- EAS Build creates signed iOS and Android artifacts from reviewed commits.
- Separate development, preview, and production Firebase projects prevent test data from reaching production.
- Environment-specific public Firebase configuration is injected by the build environment.
- EAS Update is used only for compatible JavaScript/assets and follows a rollback policy.
- Store submission remains an explicit, approved release action.

## Firebase delivery direction

Deploy rules, indexes, Storage rules, Functions, and configuration from version-controlled source with project aliases. The current checked-in alias is `development -> karri-mobile-dev`; no preview or production aliases exist yet.

Development deployment is manual and must use the root scripts that pass `--project development`:

```text
npm run firebase:deploy:development:firestore:rules
npm run firebase:deploy:development:firestore:indexes
npm run firebase:deploy:development:storage
npm run firebase:deploy:development:functions
npm run firebase:deploy:development
```

Production deployment requires separate Firebase projects, GitHub Environment approvals, workload identity or approved secret handling, passing emulator tests, a reviewed diff, and a rollback/incident plan. Client release and rule tightening must be sequenced so supported app versions continue to function.

## Supply-chain hygiene

Use `npm ci` in automation, review lockfile changes, pin action major versions, run dependency and secret scanning, and avoid long-lived Firebase service-account keys where workload identity is available.
