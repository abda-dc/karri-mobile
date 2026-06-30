# Identity Verification Foundation

## Scope

Milestone 7 begins with a provider-neutral identity verification aggregate and a conservative persistence boundary. This foundation records workflow state and document metadata only. It does not perform identity proofing, upload files, extract OCR text, contact a KYC provider, or grant marketplace privileges.

The canonical record is `identityVerifications/{userId}`. Using the authenticated user ID as the document ID enforces one current verification aggregate per account and makes ownership checks explicit.

## Domain model

`IdentityVerification` contains:

- a finite `VerificationStatus` and derived `VerificationLevel`;
- metadata-only `IdentityDocument` entries;
- an append-only `VerificationEvent` timeline;
- submission, review, expiry, rejection, and revocation metadata;
- provider-neutral ISO timestamps.

`basic` means an account is actively progressing through draft, submitted, or review. It does not mean that identity has been proven. Only `verified` maps to `identity_verified`; unverified, rejected, expired, and revoked records map to `none`.

Document metadata is deliberately narrow: opaque document ID, user-facing label, document type, two-letter issuing-country code, expiry time, private Storage object path, and upload time. Raw images, base64 data, public URLs, OCR output, addresses, and document numbers are prohibited from the Firestore aggregate.

## State machine

The only permitted transitions are:

```text
unverified -> draft -> submitted -> under_review -> verified
                                     |                |-> expired -> draft
                                     |                |-> revoked (terminal)
                                     -> rejected -> draft
```

The pure state-machine helpers answer whether a transition is valid, assert a requested transition, and list the possible next states. They do not authorize an actor. Actor authorization belongs at the trusted command boundary and in Firestore rules.

## Application service

`IdentityVerificationService` is Firebase-free. It retrieves the current record, starts an idempotent draft, validates document metadata, submits a complete draft, exposes reviewer/system transition methods, and returns a transparent status summary. Every status change appends an event with the previous state, next state, actor type, actor ID when applicable, reason when applicable, and occurrence time.

Reviewer and system methods define the future trusted use cases; the mobile Firestore client is intentionally unable to persist them. A future server command handler can compose the same service with an administrative repository and verified reviewer identity.

## Firestore and Storage boundary

The Firebase mapper is the only layer that translates Firestore timestamps. Firestore rules allow an authenticated user to:

- read only their own aggregate;
- create their own empty draft;
- edit allowlisted document metadata while it remains a draft; and
- submit that draft with one appended user event.

Clients cannot self-assign `under_review`, `verified`, `rejected`, `expired`, or `revoked`, cannot write review-only fields, cannot rewrite prior events, and cannot delete verification records. The default-deny rule remains in effect.

Storage is still deny-all. Consequently, client-written document metadata must keep `storagePath` and `uploadedAt` null. A future upload flow should use private Firebase Storage objects, short-lived authorized access, file size/type validation, malware scanning where appropriate, and server-side attachment of the object path. It must not add document bytes to Firestore.

## Privacy and retention

Identity evidence is high-sensitivity data. Before real collection begins, Karri must approve purpose limitation, consent copy, regional data location, access logging, reviewer access, retention/deletion schedules, account-deletion handling, incident response, and vendor terms. Logs and analytics must use opaque record IDs and outcome codes rather than identity evidence or document metadata.

The current twelve-event cap bounds the client aggregate and makes append-only rule validation explicit. A production review workflow may move immutable audit events to a server-owned subcollection if longer histories are required.

## Future manual review and trust integration

A trusted server workflow must authenticate and authorize reviewers, perform idempotent transitions, record reviewer decisions, and prevent concurrent stale updates. Manual review UI, queues, escalation, dual control, and operational monitoring are deferred.

Trust-score integration is also deferred. When activated, it must map only a currently valid `identity_verified` result into the trust engine, explain the factor to users, and promptly remove the benefit after expiry or revocation. A client-reported verification level must never be treated as authoritative.

## Explicitly deferred

- Firebase Storage upload/download behavior and Storage rules
- OCR, liveness, biometric comparison, and automated document checks
- third-party KYC/identity providers and credentials
- reviewer dashboards and Cloud Functions
- trust-score mutation, booking privileges, payments, and disputes
- production retention jobs, deletion workflows, and compliance controls

## Related documents

- [Domain Model](domain-model.md)
- [Application Services](application-services.md)
- [Database Design](../engineering/database-design.md)
- [Security](../engineering/security.md)
