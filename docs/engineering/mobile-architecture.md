# Mobile Architecture

## Stack

- Expo React Native and TypeScript.
- Expo Router for file-based navigation.
- Firebase modular JavaScript SDK.
- React state and effects; no external state-management library in the current slice.
- Shared visual tokens and small presentational components.

## Source layout

```text
apps/mobile/
  app/                  Expo Router screens and layouts
    (tabs)/             Signed-in product tabs
  src/
    components/         Reusable mobile UI primitives
    lib/                Firebase, Auth, and Firestore helpers
    theme/              Color, spacing, and typography tokens
    types/              Firestore-facing domain models
```

## Screen responsibilities

Screens own form state, lightweight client validation, loading/error/empty presentation, and subscription lifecycle. Firebase configuration and data access are kept out of JSX through `src/lib` helpers. Models provide a shared vocabulary without creating a general repository framework before it is needed.

## Navigation

The root stack contains the landing, login, verification, profile setup, and tab group. Tabs contain Home, Send, Travel, Tracking, and Profile. Production route guards are not yet implemented; data helpers still require Auth so direct navigation cannot create ownerless data.

## State approach

- Auth state is observed with a small hook around Firebase Auth.
- Firestore records arrive through `onSnapshot` subscriptions.
- Each screen owns `loading`, `error`, and records for its listener.
- Forms disable submission while a write is pending.
- Matching is derived with `useMemo`; it is not persisted.

This keeps the first slice legible. A global state library should be added only when several screens genuinely coordinate the same client state beyond Firebase listeners.

## Mobile quality rules

- Forms scroll on small devices and identify keyboard types.
- Numeric and date input remain strings until validation succeeds.
- Errors use plain language and do not expose configuration values.
- Buttons expose disabled/loading state.
- Device testing remains required even when TypeScript and Expo Doctor pass.
