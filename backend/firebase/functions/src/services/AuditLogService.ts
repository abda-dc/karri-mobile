import type { Transaction } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { ValidationError } from "../errors/DomainErrors.js";
import { deriveOperationId } from "../utils/crypto.js";

export type AuditMetadataValue = string | number | boolean | null;
export type AuditMetadata = Record<string, AuditMetadataValue>;

export interface AuditLogData {
  action: string;
  actorUid: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  reasonCode: string;
  metadata: AuditMetadata;
  idempotencyKey: string;
}

export class AuditLogService {
  constructor(private readonly db: admin.firestore.Firestore) {}

  public recordAuditLog(
    transaction: Transaction,
    data: AuditLogData
  ): string {
    // Basic validations
    if (!data.action || typeof data.action !== "string" || data.action.length > 100) {
      throw new ValidationError("Invalid audit action.");
    }
    if (!data.actorUid || typeof data.actorUid !== "string" || data.actorUid.length > 128) {
      throw new ValidationError("Invalid audit actorUid.");
    }
    if (!data.actorRole || typeof data.actorRole !== "string" || data.actorRole.length > 50) {
      throw new ValidationError("Invalid audit actorRole.");
    }
    if (!data.targetType || typeof data.targetType !== "string" || data.targetType.length > 50) {
      throw new ValidationError("Invalid audit targetType.");
    }
    if (!data.targetId || typeof data.targetId !== "string" || data.targetId.length > 128) {
      throw new ValidationError("Invalid audit targetId.");
    }
    if (!data.reasonCode || typeof data.reasonCode !== "string" || data.reasonCode.length > 100) {
      throw new ValidationError("Invalid audit reasonCode.");
    }
    if (!data.idempotencyKey || typeof data.idempotencyKey !== "string" || data.idempotencyKey.length > 256) {
      throw new ValidationError("Invalid audit idempotencyKey.");
    }

    // Validate metadata at runtime and reject arrays, objects, undefined values, and unsupported types
    if (data.metadata) {
      if (typeof data.metadata !== "object" || data.metadata === null || Array.isArray(data.metadata)) {
        throw new ValidationError("Metadata must be a non-null object.");
      }
      for (const [key, value] of Object.entries(data.metadata)) {
        if (value === undefined) {
          throw new ValidationError(`Metadata key '${key}' cannot be undefined.`);
        }
        const valType = typeof value;
        if (
          value !== null &&
          valType !== "string" &&
          valType !== "number" &&
          valType !== "boolean"
        ) {
          throw new ValidationError(`Invalid metadata value type for key '${key}'. Only string, number, boolean, or null are permitted.`);
        }
      }
    }

    const auditId = deriveOperationId(
      data.actorUid,
      data.action,
      data.targetType,
      data.targetId,
      data.idempotencyKey
    );

    const auditRef = this.db.collection("auditLogs").doc(auditId);
    const auditRecord = {
      action: data.action,
      actorUid: data.actorUid,
      actorRole: data.actorRole,
      targetType: data.targetType,
      targetId: data.targetId,
      reasonCode: data.reasonCode,
      metadata: data.metadata || {},
      idempotencyKey: data.idempotencyKey,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    transaction.set(auditRef, auditRecord);
    return auditId;
  }
}
