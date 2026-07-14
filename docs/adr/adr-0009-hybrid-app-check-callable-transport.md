# ADR-0009: Use native App Check with the existing Firebase JavaScript data layer

## Status

Accepted — 2026-07-14

## Context

Karri Mobile currently uses the Firebase JavaScript SDK for Authentication, Firestore, and Storage. The three privileged callable commands (`placeAdministrativeHold`, `releaseAdministrativeHold`, and `submitSafetyReview`) need both Firebase Authentication identity and native device attestation before App Check enforcement can be enabled.

Expo Go cannot load React Native Firebase native modules. Adding those modules also requires registered native Firebase apps, platform configuration files, Expo prebuild configuration, and a rebuilt application binary. Adding that native configuration before those external prerequisites exist would make the current build and CI path unsafe.

## Decision

Keep Firebase JavaScript Authentication, Firestore, and Storage unchanged. A later patch will add React Native Firebase App Check only, retrieve its token explicitly, and inject that token through an `AppCheckTokenProvider` boundary.

The privileged callable client uses the documented callable HTTP protocol. It sends the existing JavaScript Auth user's ID token in `Authorization`, the injected native App Check token in `X-Firebase-AppCheck`, and `{ data: payload }` as the request body. The transport owns callable response decoding, safe error normalization, and at most one credential-refresh retry.

Patch 4A1 adds only the typed provider boundary, fail-closed unavailable provider, direct HTTP transport, tests, and rollout documentation. It does not install native dependencies, initialize a native provider, add native Firebase configuration, wire unfinished UI, or enable enforcement.

## Rejected alternatives

- A full React Native Firebase migration would unnecessarily replace the established Auth persistence, Firestore repositories/cache behavior, Storage integration, and their tests.
- A partial native Auth migration would create competing Auth session owners and token lifecycles.
- A Firebase JavaScript `CustomProvider` backed by a native App Check token would couple two App Check caches and require translating the native token result into the JavaScript provider expiration contract. That undocumented composition is broader and harder to operate than explicit token retrieval for three commands.
- A permissive placeholder or fake production token is forbidden. Missing native attestation must fail closed.

## Provider and build policy

- Android development builds and emulators use the Firebase App Check debug provider with a separately registered, secret debug token.
- Android production builds use Play Integrity and the registered production signing certificate.
- iOS development builds and simulators use the Firebase App Check debug provider with a separately registered, secret debug token.
- iOS production builds use App Attest with DeviceCheck fallback.
- Expo Go is unsupported for native App Check. Development, preview, and production binaries must be rebuilt after the native module or provider configuration changes. An OTA update cannot add the native module to an existing binary.

Debug tokens are credentials: they must never be committed, placed in `EXPO_PUBLIC_*` configuration, or logged.

## Rollout, enforcement, and rollback gates

Rollout is metrics-first:

1. Register native apps and providers outside the repository.
2. Ship rebuilt binaries that acquire tokens while callable enforcement remains disabled.
3. Confirm Android and iOS development and production attestation metrics, token-refresh behavior, callable success, and failure telemetry.
4. Confirm supported-version adoption and an enforcement-compatible operational smoke strategy.
5. Enable callable enforcement in a separate reviewed patch and deployment.

Enforcement must remain disabled if attestation metrics are incomplete, supported clients cannot acquire or refresh tokens, the credential-refresh retry is unstable, or the guarded smoke cannot validate the enforced path. Rollback is a narrow Functions deployment restoring `enforceAppCheck: false`; client Auth, Firestore, and Storage remain unaffected.

The current guarded operational live smoke sends a Firebase Auth ID token but has no device capable of producing Play Integrity or App Attest evidence. It cannot validate an enforced callable until a separately approved device-run or securely managed development-token strategy exists. Patch 4A1 does not change that smoke.

## Consequences

- The native migration surface remains limited to App Check.
- The transport maintains a small portion of the callable wire protocol and must retain focused compatibility tests.
- Firestore and Storage App Check enforcement are separate future decisions; this transport protects only the three privileged callables when Functions enforcement is later enabled.
- Current development and production behavior is unchanged until native configuration and enforcement are separately approved.
