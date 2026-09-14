import { randomBytes, randomInt, createHash, timingSafeEqual } from "crypto";
import admin from "firebase-admin";
import type { Transaction } from "firebase-admin/firestore";
import {
  ValidationError,
  PermissionDeniedError,
  NotFoundError,
  FailedPreconditionError,
} from "../errors/DomainErrors.js";
import type {
  BookingHandoffAgreement,
  BookingHandoffSecrets,
} from "../types/HandoffTypes.js";

const MAX_VERIFICATION_ATTEMPTS = 5;

export function generateSecureCode(): string {
  return randomInt(100000, 1000000).toString();
}

export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function verifyCodeTimingSafe(inputCode: string, salt: string, storedHashHex: string): boolean {
  const inputHashHex = hashCode(inputCode, salt);
  const inputBuf = Buffer.from(inputHashHex, "hex");
  const storedBuf = Buffer.from(storedHashHex, "hex");
  if (inputBuf.length !== storedBuf.length) {
    return false;
  }
  return timingSafeEqual(inputBuf, storedBuf);
}

export class HandoffCoordinationService {
  constructor(private readonly db: admin.firestore.Firestore) {}

  public createInitialHandoffRecords(
    bookingId: string,
    senderId: string,
    travelerId: string,
    senderName = "",
    travelerName = "",
  ): { agreement: BookingHandoffAgreement; secrets: BookingHandoffSecrets } {
    const now = admin.firestore.Timestamp.now();

    const agreement: BookingHandoffAgreement = {
      bookingId,
      senderContact: {
        name: senderName || "",
        phone: null,
        email: null,
        notes: null,
      },
      travelerContact: {
        name: travelerName || "",
        phone: null,
        email: null,
        notes: null,
      },
      receiver: {
        name: senderName || "Receiver",
        phone: "",
        email: null,
        label: "Self",
        isSenderReceiver: true,
      },
      pickup: {
        meetingPoint: "",
        scheduledAt: null,
        notes: null,
      },
      dropoff: {
        meetingPoint: "",
        scheduledAt: null,
        notes: null,
      },
      confirmation: {
        status: "needs_confirmation",
        proposedBy: null,
        confirmedBy: null,
        confirmedAt: null,
      },
      pickupVerification: {
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        failedAttempts: 0,
      },
      deliveryVerification: {
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        failedAttempts: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    const secrets: BookingHandoffSecrets = {
      bookingId,
      senderId,
      travelerId,
      pickupCodeHash: null,
      pickupSalt: null,
      pickupIssued: false,
      pickupAttempts: 0,
      pickupMaxAttempts: MAX_VERIFICATION_ATTEMPTS,
      pickupVerified: false,
      pickupGeneratedAt: null,
      deliveryCodeHash: null,
      deliverySalt: null,
      deliveryIssued: false,
      deliveryAttempts: 0,
      deliveryMaxAttempts: MAX_VERIFICATION_ATTEMPTS,
      deliveryVerified: false,
      deliveryGeneratedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return { agreement, secrets };
  }

  public async issueHandoffCode(
    callerUid: string,
    bookingId: string,
    codeType: "pickup" | "delivery",
  ): Promise<{
    success: boolean;
    bookingId: string;
    codeType: "pickup" | "delivery";
    code: string;
  }> {
    if (!bookingId || typeof bookingId !== "string" || bookingId.length > 128) {
      throw new ValidationError("Invalid bookingId.");
    }
    if (codeType !== "pickup" && codeType !== "delivery") {
      throw new ValidationError("codeType must be 'pickup' or 'delivery'.");
    }

    return await this.db.runTransaction(async (transaction: Transaction) => {
      const bookingRef = this.db.collection("bookings").doc(bookingId);
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists) {
        throw new NotFoundError("Booking not found.");
      }

      const booking = bookingDoc.data()!;
      if (booking.senderId !== callerUid) {
        throw new PermissionDeniedError("Only the booking sender can generate handoff verification codes.");
      }

      // Explicit lifecycle allowlist
      if (codeType === "pickup" && booking.status !== "accepted") {
        throw new FailedPreconditionError(
          `Pickup verification code can only be generated when booking status is 'accepted' (current status: '${booking.status}').`
        );
      }
      if (codeType === "delivery" && !["accepted", "in_transit"].includes(booking.status)) {
        throw new FailedPreconditionError(
          `Delivery verification code can only be generated when booking status is 'accepted' or 'in_transit' (current status: '${booking.status}').`
        );
      }

      const secretsRef = this.db.collection("bookingHandoffSecrets").doc(bookingId);
      const secretsDoc = await transaction.get(secretsRef);
      if (!secretsDoc.exists) {
        throw new NotFoundError("Handoff secrets not found for this booking.");
      }

      const secrets = secretsDoc.data() as BookingHandoffSecrets;
      if (codeType === "pickup" && secrets.pickupVerified) {
        throw new FailedPreconditionError("Pickup handoff has already been verified and code cannot be regenerated.");
      }
      if (codeType === "delivery" && secrets.deliveryVerified) {
        throw new FailedPreconditionError("Delivery handoff has already been verified and code cannot be regenerated.");
      }

      const newCode = generateSecureCode();
      const newSalt = generateSalt();
      const newHash = hashCode(newCode, newSalt);
      const now = admin.firestore.Timestamp.now();
      const agreementRef = this.db.collection("bookingHandoffAgreements").doc(bookingId);

      if (codeType === "pickup") {
        transaction.update(secretsRef, {
          pickupCodeHash: newHash,
          pickupSalt: newSalt,
          pickupIssued: true,
          pickupAttempts: 0,
          pickupGeneratedAt: now,
          updatedAt: now,
        });
        transaction.set(
          agreementRef,
          {
            pickupVerification: {
              failedAttempts: 0,
            },
            updatedAt: now,
          },
          { merge: true },
        );
      } else {
        transaction.update(secretsRef, {
          deliveryCodeHash: newHash,
          deliverySalt: newSalt,
          deliveryIssued: true,
          deliveryAttempts: 0,
          deliveryGeneratedAt: now,
          updatedAt: now,
        });
        transaction.set(
          agreementRef,
          {
            deliveryVerification: {
              failedAttempts: 0,
            },
            updatedAt: now,
          },
          { merge: true },
        );
      }

      return { success: true, bookingId, codeType, code: newCode };
    });
  }

  public async verifyPickupHandoff(
    callerUid: string,
    bookingId: string,
    code: string,
  ): Promise<{
    success: boolean;
    verified: boolean;
    remainingAttempts?: number;
  }> {
    if (!bookingId || typeof bookingId !== "string" || bookingId.length > 128) {
      throw new ValidationError("Invalid bookingId.");
    }
    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      throw new ValidationError("Verification code must be 6 numeric digits.");
    }
    const cleanCode = code.trim();

    const result = await this.db.runTransaction(async (transaction: Transaction) => {
      const bookingRef = this.db.collection("bookings").doc(bookingId);
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists) {
        throw new NotFoundError("Booking not found.");
      }

      const booking = bookingDoc.data()!;
      if (booking.travelerId !== callerUid) {
        throw new PermissionDeniedError("Only the assigned traveler can verify physical pickup.");
      }

      // Explicit lifecycle allowlist: pickup verification is only allowed in 'accepted' status
      if (booking.status !== "accepted") {
        throw new FailedPreconditionError(
          `Pickup verification is only permitted when booking is in 'accepted' status (current status: '${booking.status}').`
        );
      }

      const secretsRef = this.db.collection("bookingHandoffSecrets").doc(bookingId);
      const secretsDoc = await transaction.get(secretsRef);
      if (!secretsDoc.exists) {
        throw new NotFoundError("Handoff secrets not initialized for this booking.");
      }

      const secrets = secretsDoc.data() as BookingHandoffSecrets;
      // Anti-replay check: already verified
      if (secrets.pickupVerified) {
        throw new FailedPreconditionError("Pickup handoff has already been verified.");
      }

      // Check if code was issued
      if (!secrets.pickupIssued || !secrets.pickupCodeHash || !secrets.pickupSalt) {
        throw new FailedPreconditionError("No pickup verification code has been generated by the sender.");
      }

      const maxAttempts = secrets.pickupMaxAttempts ?? MAX_VERIFICATION_ATTEMPTS;
      if (secrets.pickupAttempts >= maxAttempts) {
        throw new FailedPreconditionError(
          "Maximum pickup verification attempts exceeded. Code is locked. Please request the sender to generate a new code."
        );
      }

      const isMatch = verifyCodeTimingSafe(cleanCode, secrets.pickupSalt, secrets.pickupCodeHash);
      const now = admin.firestore.Timestamp.now();
      const agreementRef = this.db.collection("bookingHandoffAgreements").doc(bookingId);

      if (!isMatch) {
        const newAttempts = secrets.pickupAttempts + 1;
        const remaining = Math.max(0, maxAttempts - newAttempts);

        transaction.update(secretsRef, {
          pickupAttempts: newAttempts,
          updatedAt: now,
        });

        transaction.set(
          agreementRef,
          {
            pickupVerification: {
              verified: false,
              failedAttempts: newAttempts,
            },
            updatedAt: now,
          },
          { merge: true },
        );

        return { isMatch: false, remaining, locked: remaining === 0 };
      }

      // Valid code: mark verified, clear codeHash and salt to invalidate secret against replay
      transaction.update(secretsRef, {
        pickupVerified: true,
        pickupCodeHash: null,
        pickupSalt: null,
        updatedAt: now,
      });

      transaction.set(
        agreementRef,
        {
          pickupVerification: {
            verified: true,
            verifiedAt: now,
            verifiedBy: callerUid,
            failedAttempts: 0,
          },
          updatedAt: now,
        },
        { merge: true },
      );

      return { isMatch: true };
    });

    if (!result.isMatch) {
      if (result.locked) {
        throw new FailedPreconditionError(
          "Incorrect verification code. Maximum attempts exceeded. Code is now locked."
        );
      }
      throw new ValidationError(`Incorrect verification code. ${result.remaining} attempt(s) remaining.`);
    }

    return { success: true, verified: true };
  }

  public async verifyDeliveryHandoff(
    callerUid: string,
    bookingId: string,
    code: string,
  ): Promise<{
    success: boolean;
    verified: boolean;
    remainingAttempts?: number;
  }> {
    if (!bookingId || typeof bookingId !== "string" || bookingId.length > 128) {
      throw new ValidationError("Invalid bookingId.");
    }
    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      throw new ValidationError("Verification code must be 6 numeric digits.");
    }
    const cleanCode = code.trim();

    const result = await this.db.runTransaction(async (transaction: Transaction) => {
      const bookingRef = this.db.collection("bookings").doc(bookingId);
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists) {
        throw new NotFoundError("Booking not found.");
      }

      const booking = bookingDoc.data()!;
      if (booking.travelerId !== callerUid) {
        throw new PermissionDeniedError("Only the assigned traveler can verify delivery.");
      }

      // Explicit lifecycle allowlist: delivery verification is only allowed in 'in_transit' status
      if (booking.status !== "in_transit") {
        throw new FailedPreconditionError(
          `Delivery verification is only permitted when booking is in 'in_transit' status (current status: '${booking.status}').`
        );
      }

      const secretsRef = this.db.collection("bookingHandoffSecrets").doc(bookingId);
      const secretsDoc = await transaction.get(secretsRef);
      if (!secretsDoc.exists) {
        throw new NotFoundError("Handoff secrets not initialized for this booking.");
      }

      const secrets = secretsDoc.data() as BookingHandoffSecrets;
      // Anti-replay check: already verified
      if (secrets.deliveryVerified) {
        throw new FailedPreconditionError("Delivery handoff has already been verified.");
      }

      // Check if code was issued
      if (!secrets.deliveryIssued || !secrets.deliveryCodeHash || !secrets.deliverySalt) {
        throw new FailedPreconditionError("No delivery verification code has been generated by the sender.");
      }

      const maxAttempts = secrets.deliveryMaxAttempts ?? MAX_VERIFICATION_ATTEMPTS;
      if (secrets.deliveryAttempts >= maxAttempts) {
        throw new FailedPreconditionError(
          "Maximum delivery verification attempts exceeded. Code is locked. Please request the sender to generate a new code."
        );
      }

      const isMatch = verifyCodeTimingSafe(cleanCode, secrets.deliverySalt, secrets.deliveryCodeHash);
      const now = admin.firestore.Timestamp.now();
      const agreementRef = this.db.collection("bookingHandoffAgreements").doc(bookingId);

      if (!isMatch) {
        const newAttempts = secrets.deliveryAttempts + 1;
        const remaining = Math.max(0, maxAttempts - newAttempts);

        transaction.update(secretsRef, {
          deliveryAttempts: newAttempts,
          updatedAt: now,
        });

        transaction.set(
          agreementRef,
          {
            deliveryVerification: {
              verified: false,
              failedAttempts: newAttempts,
            },
            updatedAt: now,
          },
          { merge: true },
        );

        return { isMatch: false, remaining, locked: remaining === 0 };
      }

      // Valid code: mark verified, clear codeHash and salt to invalidate secret against replay
      transaction.update(secretsRef, {
        deliveryVerified: true,
        deliveryCodeHash: null,
        deliverySalt: null,
        updatedAt: now,
      });

      transaction.set(
        agreementRef,
        {
          deliveryVerification: {
            verified: true,
            verifiedAt: now,
            verifiedBy: callerUid,
            failedAttempts: 0,
          },
          updatedAt: now,
        },
        { merge: true },
      );

      return { isMatch: true };
    });

    if (!result.isMatch) {
      if (result.locked) {
        throw new FailedPreconditionError(
          "Incorrect verification code. Maximum attempts exceeded. Code is now locked."
        );
      }
      throw new ValidationError(`Incorrect verification code. ${result.remaining} attempt(s) remaining.`);
    }

    return { success: true, verified: true };
  }

  public async regenerateHandoffCode(
    callerUid: string,
    bookingId: string,
    codeType: "pickup" | "delivery",
  ): Promise<{
    success: boolean;
    bookingId: string;
    codeType: "pickup" | "delivery";
    newCode: string;
  }> {
    const res = await this.issueHandoffCode(callerUid, bookingId, codeType);
    return {
      success: res.success,
      bookingId: res.bookingId,
      codeType: res.codeType,
      newCode: res.code,
    };
  }
}
