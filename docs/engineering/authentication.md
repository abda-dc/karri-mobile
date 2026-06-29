# Authentication

## Current foundation

Karri uses Firebase Authentication as the identity source. The client initializes Auth with Expo-compatible React Native AsyncStorage persistence on iOS/Android and browser local persistence on web when all required Firebase environment values exist. Auth state is observed rather than copied into a separate global store.

## MVP bridge

The pre-existing UI was an email one-time-code placeholder. Production code delivery is not part of this slice. To make listing ownership testable without pretending an email was verified, the verification action creates or reuses an **anonymous Firebase Auth session**. The UI labels this behavior explicitly.

The Firebase project must enable Anonymous authentication for this bridge to work. Anonymous accounts are not verified identities and must not receive trust credit. Before a production pilot, Karri must replace or link the session with an approved provider and define account recovery and collision handling.

## Session behavior

- The SDK restores the session from AsyncStorage.
- `onAuthStateChanged` drives loading, signed-out, and signed-in UI.
- Data helpers take the authenticated UID rather than accepting owner input from forms.
- Signing out clears the Firebase session; private local caches must also be considered before production.

## Production direction

Provider selection needs a product and abuse review. Email link, email/password, phone, and federated providers have different delivery, cost, recovery, and account-linking consequences. The UI must never describe an account as email-verified when it is anonymous.

## Error handling

Configuration and provider errors are converted to concise messages. Raw Firebase error details may be logged during local development, but secrets, tokens, and personally identifying values must not be included in production logs.
