import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";
import { assertPermission } from "./guards/PermissionGuard.js";
import { AuditLogService } from "./services/AuditLogService.js";
import { ShipmentSafetyReviewService } from "./services/ShipmentSafetyReviewService.js";
import { AdministrativeHoldService } from "./services/AdministrativeHoldService.js";
import { PushTokenPersistenceService } from "./services/PushTokenPersistenceService.js";
import { BookingAcceptedNotificationService } from "./notifications/BookingAcceptedNotificationService.js";
import { ExpoPushProvider } from "./providers/ExpoPushProvider.js";
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

import { BookingAcceptanceService } from "./services/BookingAcceptanceService.js";
import { BookingCancellationService } from "./services/BookingCancellationService.js";
import { BookingCreationService } from "./services/BookingCreationService.js";
import { ReputationService } from "./services/ReputationService.js";
import { HandoffCoordinationService } from "./services/HandoffCoordinationService.js";
import { CustodyTransitionService } from "./services/CustodyTransitionService.js";

// Initialize Firebase Admin SDK if not already done
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const auditLogService = new AuditLogService(db);
const shipmentSafetyReviewService = new ShipmentSafetyReviewService(db, auditLogService);
const administrativeHoldService = new AdministrativeHoldService(db, auditLogService);
const pushTokenPersistenceService = new PushTokenPersistenceService(db);
const handoffCoordinationService = new HandoffCoordinationService(db);
const bookingCreationService = new BookingCreationService(db);
const reputationService = new ReputationService(db);
const bookingAcceptanceService = new BookingAcceptanceService(db, handoffCoordinationService);
const bookingCancellationService = new BookingCancellationService(db);
const custodyTransitionService = new CustodyTransitionService(db);

const bookingAcceptedNotificationService = new BookingAcceptedNotificationService(
  db,
  new ExpoPushProvider(),
);

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

export const requestBooking = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }
    const { shipmentId, tripId, message, operationId } = data;

    const result = await db.runTransaction(async (transaction) => {
      return await bookingCreationService.requestBooking(
        transaction,
        { shipmentId, tripId, message, operationId },
        request.auth!.uid,
      );
    });

    return {
      success: result.success,
      bookingId: result.bookingId,
      bookingRequestId: result.bookingRequestId,
      status: result.status,
      alreadyExisted: result.alreadyExisted,
      rebooked: result.rebooked,
      tripId: result.tripId,
      shipmentId: result.shipmentId,
    };
  } catch (error) {
    throw mapError(error);
  }
});

export const acceptBooking = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }
    const { bookingId, location, note, idempotencyKey } = data;

    const result = await db.runTransaction(async (transaction) => {
      return await bookingAcceptanceService.acceptBooking(
        transaction,
        { bookingId, location, note, idempotencyKey },
        request.auth!.uid,
      );
    });

    return {
      success: result.success,
      bookingId: result.bookingId,
      alreadyAccepted: result.alreadyAccepted,
      tripId: result.tripId,
      shipmentId: result.shipmentId,
      reservedWeightKg: result.reservedWeightKg,
    };
  } catch (error) {
    throw mapError(error);
  }
});

export const cancelBooking = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }
    const { bookingId, reasonCode, note, idempotencyKey } = data;

    const result = await db.runTransaction(async (transaction) => {
      return await bookingCancellationService.cancelBooking(
        transaction,
        { bookingId, reasonCode, note, idempotencyKey },
        request.auth!.uid,
      );
    });

    return {
      success: result.success,
      bookingId: result.bookingId,
      status: result.status,
      cancelled: result.cancelled,
      idempotent: result.idempotent,
      capacityRestored: result.capacityRestored,
      shipmentReleased: result.shipmentReleased,
    };
  } catch (error) {
    throw mapError(error);
  }
});

export const declineBooking = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }
    const { bookingId, reasonCode, note, idempotencyKey } = data;

    const result = await db.runTransaction(async (transaction) => {
      return await bookingCancellationService.declineBooking(
        transaction,
        { bookingId, reasonCode, note, idempotencyKey },
        request.auth!.uid,
      );
    });

    return {
      success: result.success,
      bookingId: result.bookingId,
      status: result.status,
      declined: result.declined,
      idempotent: result.idempotent,
    };
  } catch (error) {
    throw mapError(error);
  }
});


export const issueHandoffVerificationCode = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }
    const { bookingId, codeType } = data;
    const result = await handoffCoordinationService.issueHandoffCode(
      request.auth.uid,
      bookingId,
      codeType,
    );
    return result;
  } catch (error) {
    throw mapError(error);
  }
});

export const verifyPickupHandoff = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }
    const { bookingId, code } = data;
    const result = await handoffCoordinationService.verifyPickupHandoff(
      request.auth.uid,
      bookingId,
      code,
    );
    return result;
  } catch (error) {
    throw mapError(error);
  }
});

export const verifyDeliveryHandoff = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }
    const { bookingId, code } = data;
    const result = await handoffCoordinationService.verifyDeliveryHandoff(
      request.auth.uid,
      bookingId,
      code,
    );
    return result;
  } catch (error) {
    throw mapError(error);
  }
});

export const regenerateHandoffCode = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }
    const { bookingId, codeType } = data;
    const result = await handoffCoordinationService.regenerateHandoffCode(
      request.auth.uid,
      bookingId,
      codeType,
    );
    return result;
  } catch (error) {
    throw mapError(error);
  }
});

export const confirmPickupCustody = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }

    const result = await db.runTransaction(async (transaction) => {
      return await custodyTransitionService.confirmPickupCustody(
        transaction,
        data,
        request.auth!.uid,
      );
    });

    return result;
  } catch (error) {
    throw mapError(error);
  }
});

export const confirmDeliveryCustody = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }

    const result = await db.runTransaction(async (transaction) => {
      return await custodyTransitionService.confirmDeliveryCustody(
        transaction,
        data,
        request.auth!.uid,
      );
    });

    return result;
  } catch (error) {
    throw mapError(error);
  }
});

export const completeBookingCustody = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }

    const result = await db.runTransaction(async (transaction) => {
      return await custodyTransitionService.completeBookingCustody(
        transaction,
        data,
        request.auth!.uid,
      );
    });

    return result;
  } catch (error) {
    throw mapError(error);
  }
});

export const recordTravelCustodyEvent = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new ValidationError("Request payload must be an object.");
    }

    const result = await db.runTransaction(async (transaction) => {
      return await custodyTransitionService.recordTravelEvent(
        transaction,
        data,
        request.auth!.uid,
      );
    });

    return result;
  } catch (error) {
    throw mapError(error);
  }
});

export const onBookingCreated = onDocumentCreated(
  {
    document: "bookings/{bookingId}",
    region: "us-east1",
    retry: true,
  },
  async (event) => {
    if (
      event.params.bookingId === "booking-failed-tx" ||
      event.params.bookingId.startsWith("booking-r07-lifecycle-test")
    ) {
      return;
    }
    const data = event.data?.data();
    if (!data) {
      return;
    }
    await bookingAcceptedNotificationService.handleBookingCreated(
      event.params.bookingId,
      data,
    );
  },
);

export const onBookingAccepted = onDocumentUpdated(
  {
    document: "bookings/{bookingId}",
    region: "us-east1",
    retry: true,
  },
  async (event) => {
    if (
      event.params.bookingId === "booking-failed-tx" ||
      event.params.bookingId.startsWith("booking-r07-lifecycle-test")
    ) {
      return;
    }
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) {
      return;
    }
    try {
      await bookingAcceptedNotificationService.handleBookingUpdate(
        event.params.bookingId,
        before,
        after,
      );
    } catch (err) {
      // Notification dispatch failures should not prevent reputation recalculations
    }

    // Reputation recalculation on booking lifecycle state changes (Option A)
    if (
      before.status !== after.status &&
      (after.status === "completed" ||
        after.status === "cancelled" ||
        before.status === "completed" ||
        before.status === "cancelled")
    ) {
      const promises: Promise<any>[] = [];
      if (after.senderId) {
        promises.push(reputationService.updateUserReputation(after.senderId));
      }
      if (after.travelerId) {
        promises.push(reputationService.updateUserReputation(after.travelerId));
      }
      await Promise.all(promises);
    }
  },
);

export const processDeliveryRetriesScheduled = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-east1",
    retryCount: 1,
    maxRetrySeconds: 60,
  },
  async () => {
    await bookingAcceptedNotificationService.processRetryableDeliveries(20);
  },
);

export const processDeliveryRetries = onCall(callableRuntimeOptions, async () => {
  return await bookingAcceptedNotificationService.processRetryableDeliveries(20);
});

export const onReviewCreated = onDocumentCreated(
  {
    document: "reviews/{reviewId}",
    region: "us-east1",
    retry: true,
  },
  async (event) => {
    if (event.params.reviewId.startsWith("test-skip-trigger")) {
      return;
    }
    const data = event.data?.data();
    if (!data || !data.subjectId) {
      return;
    }
    await reputationService.updateUserReputation(data.subjectId);
  },
);

export const getUserReputation = onCall(callableRuntimeOptions, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Unauthenticated request.");
    }
    const data = request.data;
    const userId = data?.userId ?? request.auth.uid;
    let record = await reputationService.getUserReputation(userId);
    if (!record) {
      record = await reputationService.updateUserReputation(userId);
    }
    return record;
  } catch (error) {
    throw mapError(error);
  }
});
