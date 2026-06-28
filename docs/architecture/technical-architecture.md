# Technical Architecture

Karri Mobile uses a mobile-first, managed-service architecture.

## Current target stack

- Expo React Native
- TypeScript
- Expo Router
- Firebase Authentication
- Cloud Firestore
- Cloud Functions
- Cloud Storage
- Firebase Cloud Messaging
- Firebase App Check
- EAS Build
- EAS Update

## Architecture principles

- Mobile-first
- Offline-friendly
- API-first
- Event-driven
- Secure by default
- Documentation-first
- AI-friendly

## Service boundaries

The mobile app handles presentation and user input.

Cloud Functions handle business operations such as:

- Booking creation
- Booking acceptance
- Custody transitions
- Notification dispatch
- Trust score updates
- Review submission
- Dispute creation

Firestore stores platform state.

Cloud Storage stores package images, identity documents, and other user-uploaded files.

Firebase Cloud Messaging delivers push notifications.

## Important rule

The mobile client must not directly perform final business operations.

It requests actions.

The backend validates, records, emits events, and updates state.
