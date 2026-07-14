import type { Transaction } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { AuditLogService } from "./AuditLogService.js";
import {
  ValidationError,
  ConflictError,
  FailedPreconditionError,
  NotFoundError,
} from "../errors/DomainErrors.js";
import { deriveOperationId, deriveRequestFingerprint } from "../utils/crypto.js";
import {
  AdministrativeHoldPlacementReasonCode,
  AdministrativeHoldReleaseReasonCode,
} from "../utils/reasonCodes.js";

export interface PlaceHoldInput {
  shipmentId: string;
  reasonCode: string;
  note?: string;
  idempotencyKey: string;
}

export interface ReleaseHoldInput {
  holdId: string;
  reasonCode: string;
  note?: string;
  idempotencyKey: string;
}

export class AdministrativeHoldService {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly auditLogService: AuditLogService
  ) {}

  public async placeHold(
    transaction: Transaction,
    input: PlaceHoldInput,
    actorUid: string,
    actorRole: string
  ): Promise<{ success: boolean; holdId: string; alreadyExisted: boolean }> {
    // 1. Input Validation
    if (!input.shipmentId || typeof input.shipmentId !== "string" || input.shipmentId.length > 128) {
      throw new ValidationError("Invalid shipmentId.");
    }

    const allowedPlacementReasons = Object.values(AdministrativeHoldPlacementReasonCode) as string[];
    if (!input.reasonCode || typeof input.reasonCode !== "string" || !allowedPlacementReasons.includes(input.reasonCode)) {
      throw new ValidationError(`Invalid reasonCode. Allowed placement reason codes are: ${allowedPlacementReasons.join(", ")}`);
    }

    if (input.note !== undefined && (typeof input.note !== "string" || input.note.length > 500)) {
      throw new ValidationError("Invalid note. Note must be a string and under 500 characters.");
    }
    if (!input.idempotencyKey || typeof input.idempotencyKey !== "string" || input.idempotencyKey.length > 256) {
      throw new ValidationError("Invalid idempotencyKey.");
    }

    const normalizedNote = input.note || null;

    // 2. Retrieve Shipment and Verify Existence
    const shipmentRef = this.db.collection("shipments").doc(input.shipmentId);
    const shipmentSnap = await transaction.get(shipmentRef);
    if (!shipmentSnap.exists) {
      throw new NotFoundError("Shipment not found.");
    }

    // 3. Deterministic Hold Document ID (Operation ID)
    const holdId = deriveOperationId(
      actorUid,
      "hold.place",
      "shipment",
      input.shipmentId,
      input.idempotencyKey
    );

    const fingerprintInput = {
      shipmentId: input.shipmentId,
      reasonCode: input.reasonCode,
      note: normalizedNote,
    };
    const requestFingerprint = deriveRequestFingerprint(fingerprintInput);

    const holdRef = this.db.collection("administrativeHolds").doc(holdId);
    const holdSnap = await transaction.get(holdRef);

    // 4. Idempotency Check for the exact same placement operation
    if (holdSnap.exists) {
      const existingData = holdSnap.data();
      if (existingData?.requestFingerprint === requestFingerprint) {
        return { success: true, holdId, alreadyExisted: true };
      }
      throw new ConflictError("Conflict: An operation with this identity already exists with different request fingerprint.");
    }

    // 5. Active shipment holds check
    // Query for any other active hold on the shipment
    const activeHoldsQuery = await transaction.get(
      this.db.collection("administrativeHolds")
        .where("shipmentId", "==", input.shipmentId)
        .where("status", "==", "active")
        .limit(1)
    );

    if (!activeHoldsQuery.empty) {
      throw new FailedPreconditionError("Failed Precondition: Another active administrative hold already exists for this shipment.");
    }

    // 6. Create Hold Record
    const holdRecord = {
      shipmentId: input.shipmentId,
      status: "active",
      reasonCode: input.reasonCode,
      note: normalizedNote,
      placedByUid: actorUid,
      placedByRole: actorRole,
      placedAt: admin.firestore.FieldValue.serverTimestamp(),
      releasedByUid: null,
      releasedByRole: null,
      releasedAt: null,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    transaction.set(holdRef, holdRecord);

    // 7. Record Audit Log (Ensure distinct ID derived from hold.place action)
    this.auditLogService.recordAuditLog(transaction, {
      action: "hold.place",
      actorUid,
      actorRole,
      targetType: "shipment",
      targetId: input.shipmentId,
      reasonCode: input.reasonCode,
      idempotencyKey: input.idempotencyKey,
      metadata: {
        holdId,
      },
    });

    return { success: true, holdId, alreadyExisted: false };
  }

  public async releaseHold(
    transaction: Transaction,
    input: ReleaseHoldInput,
    actorUid: string,
    actorRole: string
  ): Promise<{ success: boolean; holdId: string; alreadyExisted: boolean }> {
    // 1. Input Validation
    if (!input.holdId || typeof input.holdId !== "string" || input.holdId.length > 128) {
      throw new ValidationError("Invalid holdId.");
    }

    const allowedReleaseReasons = Object.values(AdministrativeHoldReleaseReasonCode) as string[];
    if (!input.reasonCode || typeof input.reasonCode !== "string" || !allowedReleaseReasons.includes(input.reasonCode)) {
      throw new ValidationError(`Invalid reasonCode. Allowed release reason codes are: ${allowedReleaseReasons.join(", ")}`);
    }

    if (input.note !== undefined && (typeof input.note !== "string" || input.note.length > 500)) {
      throw new ValidationError("Invalid note. Note must be a string and under 500 characters.");
    }
    if (!input.idempotencyKey || typeof input.idempotencyKey !== "string" || input.idempotencyKey.length > 256) {
      throw new ValidationError("Invalid idempotencyKey.");
    }

    const normalizedNote = input.note || null;

    // 2. Separate derived release operation ID for release idempotency
    const releaseOpId = deriveOperationId(
      actorUid,
      "hold.release",
      "hold",
      input.holdId,
      input.idempotencyKey
    );

    const releaseFingerprint = deriveRequestFingerprint({
      holdId: input.holdId,
      reasonCode: input.reasonCode,
      note: normalizedNote,
    });

    // Check if the audit record for this release operation already exists
    const releaseAuditRef = this.db.collection("auditLogs").doc(releaseOpId);
    const releaseAuditSnap = await transaction.get(releaseAuditRef);

    if (releaseAuditSnap.exists) {
      const existingAudit = releaseAuditSnap.data();
      if (existingAudit?.metadata?.releaseFingerprint === releaseFingerprint) {
        return { success: true, holdId: input.holdId, alreadyExisted: true };
      }
      throw new ConflictError("Conflict: A release operation with this identity already exists with different request fingerprint.");
    }

    // 3. Retrieve Hold and Verify Existence
    const holdRef = this.db.collection("administrativeHolds").doc(input.holdId);
    const holdSnap = await transaction.get(holdRef);
    if (!holdSnap.exists) {
      throw new NotFoundError("Failed Precondition: Target hold does not exist.");
    }

    const holdData = holdSnap.data();
    if (!holdData) {
      throw new ValidationError("Hold record has no data.");
    }

    // 4. If already released, return success and do not write duplicate status logs/audits
    if (holdData.status === "released") {
      return { success: true, holdId: input.holdId, alreadyExisted: true };
    }

    // 5. Update Hold Record
    const updatedFields = {
      status: "released",
      releasedByUid: actorUid,
      releasedByRole: actorRole,
      releasedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    transaction.update(holdRef, updatedFields);

    // 6. Record Audit Log for the release (using the separate derived release operation ID and its audit record)
    this.auditLogService.recordAuditLog(transaction, {
      action: "hold.release",
      actorUid,
      actorRole,
      targetType: "hold",
      targetId: input.holdId,
      reasonCode: input.reasonCode,
      idempotencyKey: input.idempotencyKey,
      metadata: {
        holdId: input.holdId,
        releaseReason: input.reasonCode,
        releaseFingerprint,
      },
    });

    return { success: true, holdId: input.holdId, alreadyExisted: false };
  }
}
