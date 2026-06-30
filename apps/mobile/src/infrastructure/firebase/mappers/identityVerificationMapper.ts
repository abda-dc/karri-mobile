import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import {
  IdentityDocumentType,
  type IdentityDocument,
} from "../../../domain/identity/IdentityDocument";
import {
  VerificationLevel,
  VerificationStatus,
  type IdentityVerification,
} from "../../../domain/identity/IdentityVerification";
import {
  VerificationActorType,
  type VerificationEvent,
} from "../../../domain/identity/VerificationEvent";
import {
  recordValue,
  snapshotData,
  stringValue,
  toDomainTimestamp,
  toFirestoreTimestamp,
} from "./firestoreValues";

const documentTypes = Object.values(IdentityDocumentType);
const verificationStatuses = Object.values(VerificationStatus);
const verificationLevels = Object.values(VerificationLevel);
const actorTypes = Object.values(VerificationActorType);

function requiredTimestamp(value: unknown, field: string): string {
  const timestamp = toDomainTimestamp(value);
  if (!timestamp) {
    throw new Error(`Identity verification field ${field} must be a timestamp.`);
  }
  return timestamp;
}

function nullableTimestamp(value: unknown): string | null {
  return value === null || value === undefined ? null : toDomainTimestamp(value);
}

function enumValue<T extends string>(
  value: unknown,
  supported: ReadonlyArray<T>,
  field: string,
): T {
  if (typeof value !== "string" || !supported.includes(value as T)) {
    throw new Error(`Identity verification field ${field} is invalid.`);
  }
  return value as T;
}

function mapDocument(value: unknown): IdentityDocument {
  const data = recordValue(value);
  return {
    id: stringValue(data.id),
    type: enumValue(data.type, documentTypes, "documents.type"),
    label: stringValue(data.label),
    issuingCountryCode: data.issuingCountryCode
      ? stringValue(data.issuingCountryCode)
      : null,
    expiresAt: nullableTimestamp(data.expiresAt),
    storagePath: data.storagePath
      ? stringValue(data.storagePath)
      : null,
    uploadedAt: nullableTimestamp(data.uploadedAt),
  };
}

function mapEvent(value: unknown): VerificationEvent {
  const data = recordValue(value);
  return {
    id: stringValue(data.id),
    verificationId: stringValue(data.verificationId),
    actorId: data.actorId ? stringValue(data.actorId) : null,
    actorType: enumValue(data.actorType, actorTypes, "events.actorType"),
    fromStatus: enumValue(
      data.fromStatus,
      verificationStatuses,
      "events.fromStatus",
    ),
    toStatus: enumValue(data.toStatus, verificationStatuses, "events.toStatus"),
    status: enumValue(data.status, verificationStatuses, "events.status"),
    reason: data.reason ? stringValue(data.reason) : null,
    createdAt: requiredTimestamp(data.createdAt, "events.createdAt"),
  };
}

export function mapIdentityVerification(
  snapshot: DocumentSnapshot<DocumentData>,
): IdentityVerification {
  const data = snapshotData(snapshot);
  return {
    id: snapshot.id,
    userId: stringValue(data.userId, snapshot.id),
    status: enumValue(data.status, verificationStatuses, "status"),
    level: enumValue(data.level, verificationLevels, "level"),
    documents: Array.isArray(data.documents) ? data.documents.map(mapDocument) : [],
    events: Array.isArray(data.events) ? data.events.map(mapEvent) : [],
    submittedAt: nullableTimestamp(data.submittedAt),
    reviewedAt: nullableTimestamp(data.reviewedAt),
    expiresAt: nullableTimestamp(data.expiresAt),
    rejectionReason: data.rejectionReason
      ? stringValue(data.rejectionReason)
      : null,
    revokedReason: data.revokedReason
      ? stringValue(data.revokedReason)
      : null,
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreIdentityVerification(
  verification: IdentityVerification,
): DocumentData {
  return {
    userId: verification.userId,
    status: verification.status,
    level: verification.level,
    documents: verification.documents.map((document) => ({
      id: document.id,
      type: document.type,
      label: document.label,
      issuingCountryCode: document.issuingCountryCode,
      expiresAt: toFirestoreTimestamp(document.expiresAt),
      storagePath: document.storagePath,
      uploadedAt: toFirestoreTimestamp(document.uploadedAt),
    })),
    events: verification.events.map((event) => ({
      id: event.id,
      verificationId: event.verificationId,
      actorId: event.actorId,
      actorType: event.actorType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      status: event.status,
      reason: event.reason,
      createdAt: Timestamp.fromDate(new Date(event.createdAt)),
    })),
    submittedAt: toFirestoreTimestamp(verification.submittedAt),
    reviewedAt: toFirestoreTimestamp(verification.reviewedAt),
    expiresAt: toFirestoreTimestamp(verification.expiresAt),
    rejectionReason: verification.rejectionReason,
    revokedReason: verification.revokedReason,
  };
}
