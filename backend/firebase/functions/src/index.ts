import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import { assertPermission } from "./guards/PermissionGuard.js";
import { AuditLogService } from "./services/AuditLogService.js";
import { ShipmentSafetyReviewService } from "./services/ShipmentSafetyReviewService.js";
import { AdministrativeHoldService } from "./services/AdministrativeHoldService.js";
import { PushTokenPersistenceService } from "./services/PushTokenPersistenceService.js";
import {
  ValidationError,
  PermissionDeniedError,
  ConflictError,
  FailedPreconditionError,
  NotFoundError,
} from "./errors/DomainErrors.js";
import {
  SafetyReviewReasonCode,
  AdministrativeHoldPlacementReasonCode,
  AdministrativeHoldReleaseReasonCode,
} from "./utils/reasonCodes.js";

// Initialize Firebase Admin SDK if not already done
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const auditLogService = new AuditLogService(db);
const shipmentSafetyReviewService = new ShipmentSafetyReviewService(db, auditLogService);
const administrativeHoldService = new AdministrativeHoldService(db, auditLogService);
const pushTokenPersistenceService = new PushTokenPersistenceService(db);

const callableRuntimeOptions = {
  region: "us-east1",
  minInstances: 0,
  maxInstances: 10,
  memory: "256MiB",
  timeoutSeconds: 60,
  enforceAppCheck: false,
} as const;

function mapError(error: any): HttpsError {
  if (error instanceof HttpsError) {
    return error;
  }
  if (error instanceof ValidationError) {
    return new HttpsError("invalid-argument", error.message);
  }
  if (error instanceof PermissionDeniedError) {
    return new HttpsError("permission-denied", error.message);
  }
  if (error instanceof ConflictError) {
    return new HttpsError("already-exists", error.message);
  }
  if (error instanceof FailedPreconditionError) {
    return new HttpsError("failed-precondition", error.message);
  }
  if (error instanceof NotFoundError) {
    return new HttpsError("not-found", error.message);
  }

  // Safe fallback to prevent leaking stack traces or sensitive details
  return new HttpsError("internal", "An internal error occurred.");
}

export const submitSafetyReview = onCall(callableRuntimeOptions, async (request) => {
  try {
    const actor = assertPermission(request.auth, "manage_safety_reviews");

    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }

    const {
      shipmentId,
      decision,
      reasonCode,
      note,
      declarationVersionReviewed,
      packageContentVersionReviewed,
      idempotencyKey,
    } = data;

    // Strict types/bounds validation
    if (typeof shipmentId !== "string" || shipmentId.trim().length === 0 || shipmentId.length > 128) {
      throw new ValidationError("Invalid shipmentId.");
    }
    if (typeof decision !== "string" || !["approved", "rejected", "needs_more_information"].includes(decision)) {
      throw new ValidationError("Invalid decision.");
    }

    const allowedReasonCodes = Object.values(SafetyReviewReasonCode) as string[];
    if (typeof reasonCode !== "string" || !allowedReasonCodes.includes(reasonCode)) {
      throw new ValidationError(`Invalid reasonCode. Allowed safety review reason codes are: ${allowedReasonCodes.join(", ")}`);
    }

    if (note !== undefined && (typeof note !== "string" || note.length > 500)) {
      throw new ValidationError("Note must be under 500 characters.");
    }
    if (
      typeof declarationVersionReviewed !== "string" ||
      declarationVersionReviewed.trim().length === 0 ||
      declarationVersionReviewed.length > 50
    ) {
      throw new ValidationError("Invalid declarationVersionReviewed.");
    }
    if (typeof packageContentVersionReviewed !== "number" || packageContentVersionReviewed < 1) {
      throw new ValidationError("Invalid packageContentVersionReviewed.");
    }
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0 || idempotencyKey.length > 256) {
      throw new ValidationError("Invalid idempotencyKey.");
    }

    const result = await db.runTransaction(async (transaction) => {
      return await shipmentSafetyReviewService.submitSafetyReview(
        transaction,
        {
          shipmentId,
          decision: decision as any,
          reasonCode,
          note,
          declarationVersionReviewed,
          packageContentVersionReviewed,
          idempotencyKey,
        },
        actor.uid,
        actor.role
      );
    });

    return {
      success: result.success,
      reviewId: result.reviewId,
      alreadyExisted: result.alreadyExisted,
    };
  } catch (error) {
    throw mapError(error);
  }
});

export const placeAdministrativeHold = onCall(callableRuntimeOptions, async (request) => {
  try {
    const actor = assertPermission(request.auth, "place_administrative_holds");

    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }

    const { shipmentId, reasonCode, note, idempotencyKey } = data;

    if (typeof shipmentId !== "string" || shipmentId.trim().length === 0 || shipmentId.length > 128) {
      throw new ValidationError("Invalid shipmentId.");
    }

    const allowedPlacementReasons = Object.values(AdministrativeHoldPlacementReasonCode) as string[];
    if (typeof reasonCode !== "string" || !allowedPlacementReasons.includes(reasonCode)) {
      throw new ValidationError(`Invalid reasonCode. Allowed placement reason codes are: ${allowedPlacementReasons.join(", ")}`);
    }

    if (note !== undefined && (typeof note !== "string" || note.length > 500)) {
      throw new ValidationError("Note must be under 500 characters.");
    }
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0 || idempotencyKey.length > 256) {
      throw new ValidationError("Invalid idempotencyKey.");
    }

    const result = await db.runTransaction(async (transaction) => {
      return await administrativeHoldService.placeHold(
        transaction,
        { shipmentId, reasonCode, note, idempotencyKey },
        actor.uid,
        actor.role
      );
    });

    return {
      success: result.success,
      holdId: result.holdId,
      alreadyExisted: result.alreadyExisted,
    };
  } catch (error) {
    throw mapError(error);
  }
});

export const releaseAdministrativeHold = onCall(callableRuntimeOptions, async (request) => {
  try {
    const actor = assertPermission(request.auth, "place_administrative_holds");

    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }

    const { holdId, reasonCode, note, idempotencyKey } = data;

    if (typeof holdId !== "string" || holdId.trim().length === 0 || holdId.length > 128) {
      throw new ValidationError("Invalid holdId.");
    }

    const allowedReleaseReasons = Object.values(AdministrativeHoldReleaseReasonCode) as string[];
    if (typeof reasonCode !== "string" || !allowedReleaseReasons.includes(reasonCode)) {
      throw new ValidationError(`Invalid reasonCode. Allowed release reason codes are: ${allowedReleaseReasons.join(", ")}`);
    }

    if (note !== undefined && (typeof note !== "string" || note.length > 500)) {
      throw new ValidationError("Note must be under 500 characters.");
    }
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0 || idempotencyKey.length > 256) {
      throw new ValidationError("Invalid idempotencyKey.");
    }

    const result = await db.runTransaction(async (transaction) => {
      return await administrativeHoldService.releaseHold(
        transaction,
        { holdId, reasonCode, note, idempotencyKey },
        actor.uid,
        actor.role
      );
    });

    return {
      success: result.success,
      holdId: result.holdId,
      alreadyExisted: result.alreadyExisted,
    };
  } catch (error) {
    throw mapError(error);
  }
});

export const registerPushToken = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const uid = request.auth.uid;

    const result = await db.runTransaction(async (transaction) => {
      return await pushTokenPersistenceService.registerPushToken(transaction, uid, request.data);
    });

    return {
      success: result.success,
      deviceId: result.deviceId,
      status: result.status,
      alreadyExisted: result.alreadyExisted,
    };
  } catch (error) {
    throw mapError(error);
  }
});

export const unregisterPushToken = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const uid = request.auth.uid;

    const result = await db.runTransaction(async (transaction) => {
      return await pushTokenPersistenceService.unregisterPushToken(transaction, uid, request.data);
    });

    return {
      success: result.success,
      deviceId: result.deviceId,
      status: result.status,
      alreadyInactive: result.alreadyInactive,
    };
  } catch (error) {
    throw mapError(error);
  }
});
