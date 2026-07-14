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
import { SafetyReviewReasonCode } from "../utils/reasonCodes.js";

export interface SafetyReviewInput {
  shipmentId: string;
  decision: "approved" | "rejected" | "needs_more_information";
  reasonCode: string;
  note?: string;
  declarationVersionReviewed: string;
  packageContentVersionReviewed: number;
  idempotencyKey: string;
}

export class ShipmentSafetyReviewService {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly auditLogService: AuditLogService
  ) {}

  public async submitSafetyReview(
    transaction: Transaction,
    input: SafetyReviewInput,
    actorUid: string,
    actorRole: string
  ): Promise<{ success: boolean; reviewId: string; alreadyExisted: boolean }> {
    // 1. Strict Input Validations
    if (!input.shipmentId || typeof input.shipmentId !== "string" || input.shipmentId.length > 128) {
      throw new ValidationError("Invalid shipmentId.");
    }
    if (
      !input.decision ||
      !["approved", "rejected", "needs_more_information"].includes(input.decision)
    ) {
      throw new ValidationError("Invalid decision. Must be approved, rejected, or needs_more_information.");
    }

    const allowedReasonCodes = Object.values(SafetyReviewReasonCode) as string[];
    if (!input.reasonCode || typeof input.reasonCode !== "string" || !allowedReasonCodes.includes(input.reasonCode)) {
      throw new ValidationError(`Invalid reasonCode. Allowed safety review reason codes are: ${allowedReasonCodes.join(", ")}`);
    }

    if (input.note !== undefined && (typeof input.note !== "string" || input.note.length > 500)) {
      throw new ValidationError("Invalid note. Note must be a string and under 500 characters.");
    }
    if (
      !input.declarationVersionReviewed ||
      typeof input.declarationVersionReviewed !== "string" ||
      input.declarationVersionReviewed.length > 50
    ) {
      throw new ValidationError("Invalid declarationVersionReviewed.");
    }
    if (
      typeof input.packageContentVersionReviewed !== "number" ||
      input.packageContentVersionReviewed < 1
    ) {
      throw new ValidationError("Invalid packageContentVersionReviewed.");
    }
    if (!input.idempotencyKey || typeof input.idempotencyKey !== "string" || input.idempotencyKey.length > 256) {
      throw new ValidationError("Invalid idempotencyKey.");
    }

    const normalizedNote = input.note || null;

    // 2. Deterministic Review Document ID (Operation ID)
    const reviewId = deriveOperationId(
      actorUid,
      "safety_review.submit",
      "shipment",
      input.shipmentId,
      input.idempotencyKey
    );

    const fingerprintInput = {
      shipmentId: input.shipmentId,
      decision: input.decision,
      reasonCode: input.reasonCode,
      note: normalizedNote,
      declarationVersionReviewed: input.declarationVersionReviewed,
      packageContentVersionReviewed: input.packageContentVersionReviewed,
    };
    const requestFingerprint = deriveRequestFingerprint(fingerprintInput);

    const reviewRef = this.db.collection("shipmentSafetyReviews").doc(reviewId);
    const reviewSnap = await transaction.get(reviewRef);

    // 3. Idempotency Check
    if (reviewSnap.exists) {
      const existingData = reviewSnap.data();
      if (existingData?.requestFingerprint === requestFingerprint) {
        return { success: true, reviewId, alreadyExisted: true };
      }
      throw new ConflictError("Conflict: An operation with this identity already exists with different request fingerprint.");
    }

    // 4. Final Review Check: Prevent submitting any review if a final decision already exists
    const finalReviewsQuery = await transaction.get(
      this.db.collection("shipmentSafetyReviews")
        .where("shipmentId", "==", input.shipmentId)
        .where("decision", "in", ["approved", "rejected"])
        .limit(1)
    );

    if (!finalReviewsQuery.empty) {
      throw new FailedPreconditionError("Failed Precondition: A final safety review already exists for this shipment.");
    }

    // 5. Retrieve and Validate Shipment
    const shipmentRef = this.db.collection("shipments").doc(input.shipmentId);
    const shipmentSnap = await transaction.get(shipmentRef);
    if (!shipmentSnap.exists) {
      throw new NotFoundError("Shipment not found.");
    }

    const shipmentData = shipmentSnap.data();
    if (!shipmentData) {
      throw new ValidationError("Shipment has no data.");
    }

    // 6. Version Verification
    if (shipmentData.packageContentVersion !== input.packageContentVersionReviewed) {
      throw new FailedPreconditionError(
        `Failed Precondition: Reviewed package content version (${input.packageContentVersionReviewed}) does not match current shipment version (${shipmentData.packageContentVersion}).`
      );
    }

    const currentDeclVersion = shipmentData.safetyDeclaration?.declarationVersion || "v1";
    if (currentDeclVersion !== input.declarationVersionReviewed) {
      throw new FailedPreconditionError(
        `Failed Precondition: Reviewed declaration version (${input.declarationVersionReviewed}) does not match current shipment safety declaration version (${currentDeclVersion}).`
      );
    }

    // 7. Write Immutable Review Record (Original Shipment Safety Declaration remains UNMUTATED)
    const reviewRecord = {
      shipmentId: input.shipmentId,
      actorUid,
      reviewerRole: actorRole,
      decision: input.decision,
      reasonCode: input.reasonCode,
      note: normalizedNote,
      declarationVersionReviewed: input.declarationVersionReviewed,
      packageContentVersionReviewed: input.packageContentVersionReviewed,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    transaction.set(reviewRef, reviewRecord);

    // 8. Write Atomic Audit Log
    this.auditLogService.recordAuditLog(transaction, {
      action: "safety_review.submit",
      actorUid,
      actorRole,
      targetType: "shipment",
      targetId: input.shipmentId,
      reasonCode: input.reasonCode,
      idempotencyKey: input.idempotencyKey,
      metadata: {
        decision: input.decision,
        packageContentVersionReviewed: input.packageContentVersionReviewed,
        declarationVersionReviewed: input.declarationVersionReviewed,
      },
    });

    return { success: true, reviewId, alreadyExisted: false };
  }
}
