import { createHash } from "node:crypto";
import admin from "firebase-admin";
import type { DocumentData, DocumentReference } from "firebase-admin/firestore";
import {
  BOOKING_ACCEPTED_NOTIFICATION,
  EXPO_VISIBLE_NOTIFICATION,
  type BookingUpdateResult,
  type ExpoPushMessage,
  type PushDeliveryResult,
  type PushProvider,
} from "./NotificationContracts.js";
import { MAX_EXPO_PUSH_BATCH_SIZE } from "../providers/ExpoPushProvider.js";

const MAX_N3A_DEVICE_REGISTRATIONS = MAX_EXPO_PUSH_BATCH_SIZE;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const DEVICE_ID_PATTERN = /^karri-[a-z0-9-]{16,100}$/;
const EXPO_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]\s\u0000-\u001f\u007f]+\]$/;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PREFERENCE_FIELDS = ["userId", "channels", "categories", "quietHours", "createdAt", "updatedAt"] as const;
const CHANNEL_FIELDS = ["push", "email", "sms"] as const;
const CATEGORY_FIELDS = [
  "booking_requests",
  "booking_updates",
  "custody_updates",
  "delivery_updates",
  "general_announcements",
  "review_reminders",
  "trust_profile_alerts",
] as const;
const QUIET_HOURS_FIELDS = ["startLocalTime", "endLocalTime", "timeZone"] as const;
const IMMUTABLE_BOOKING_FIELDS = [
  "bookingRequestId",
  "shipmentId",
  "tripId",
  "senderId",
  "travelerId",
  "createdAt",
] as const;

interface SelectedRegistration {
  readonly ref: DocumentReference;
  readonly deviceId: string;
  readonly token: string;
  readonly platform: "android" | "ios";
  readonly registrationVersion: number;
}

interface ClaimedRegistration extends SelectedRegistration {
  readonly effectId: string;
  readonly effectRef: DocumentReference;
}

function digestId(prefix: string, input: string): string {
  return `${prefix}_${createHash("sha256").update(input, "utf8").digest("hex")}`;
}

export function deriveBookingAcceptedNotificationId(bookingId: string, senderId: string): string {
  return digestId("notification", `booking.accepted:v1:${bookingId}:${senderId}`);
}

export function derivePushDeliveryEffectId(notificationId: string, deviceId: string): string {
  return digestId("delivery", `push:v1:${notificationId}:${deviceId}`);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value) && value.trim() === value;
}

function isTimestamp(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { toMillis?: () => number };
  if (typeof candidate.toMillis !== "function") {
    return false;
  }
  try {
    return Number.isFinite(candidate.toMillis());
  } catch {
    return false;
  }
}

function isFirestoreTimestamp(value: unknown): value is admin.firestore.Timestamp {
  return value instanceof admin.firestore.Timestamp;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (isTimestamp(left) && isTimestamp(right)) {
    return (left as { toMillis: () => number }).toMillis() ===
      (right as { toMillis: () => number }).toMillis();
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length && left.every((value, index) => valuesEqual(value, right[index]));
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    return valuesEqual(leftKeys, rightKeys) &&
      leftKeys.every((key) => valuesEqual(leftRecord[key], rightRecord[key]));
  }
  return false;
}

function validateAcceptedTransition(bookingId: string, before: DocumentData, after: DocumentData): void {
  if (!isIdentifier(bookingId) || !isIdentifier(after.senderId) || !isIdentifier(after.travelerId)) {
    throw new Error("Invalid booking acceptance transition.");
  }
  if (after.senderId === after.travelerId) {
    throw new Error("Invalid booking acceptance transition.");
  }
  for (const field of IMMUTABLE_BOOKING_FIELDS) {
    if (!valuesEqual(before[field], after[field])) {
      throw new Error("Invalid booking acceptance transition.");
    }
  }

  const beforeHistory = before.statusHistory;
  const afterHistory = after.statusHistory;
  if (!Array.isArray(beforeHistory) || !Array.isArray(afterHistory) ||
      afterHistory.length !== beforeHistory.length + 1) {
    throw new Error("Invalid booking acceptance transition.");
  }
  for (let index = 0; index < beforeHistory.length; index += 1) {
    if (!valuesEqual(beforeHistory[index], afterHistory[index])) {
      throw new Error("Invalid booking acceptance transition.");
    }
  }
  const appended = afterHistory[afterHistory.length - 1];
  if (!appended || typeof appended !== "object" || Array.isArray(appended) ||
      appended.status !== "accepted" || appended.changedBy !== after.travelerId ||
      !isTimestamp(appended.changedAt)) {
    throw new Error("Invalid booking acceptance transition.");
  }
}

function localMinutes(now: Date, timeZone: string): number | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
      return null;
    }
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

function parseLocalTime(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function evaluateQuietHours(quietHours: unknown, now: Date): "allowed" | "quiet" | "invalid" {
  if (quietHours === undefined || quietHours === null) {
    return "allowed";
  }
  if (!quietHours || typeof quietHours !== "object" || Array.isArray(quietHours)) {
    return "invalid";
  }
  const value = quietHours as Record<string, unknown>;
  if (typeof value.startLocalTime !== "string" || !LOCAL_TIME_PATTERN.test(value.startLocalTime) ||
      typeof value.endLocalTime !== "string" || !LOCAL_TIME_PATTERN.test(value.endLocalTime) ||
      typeof value.timeZone !== "string" || value.timeZone.length === 0 || value.timeZone.length > 100 ||
      value.startLocalTime === value.endLocalTime) {
    return "invalid";
  }
  const current = localMinutes(now, value.timeZone);
  if (current === null) {
    return "invalid";
  }
  const start = parseLocalTime(value.startLocalTime);
  const end = parseLocalTime(value.endLocalTime);
  const inside = start < end
    ? current >= start && current < end
    : current >= start || current < end;
  return inside ? "quiet" : "allowed";
}

function hasExactFields(value: unknown, fields: ReadonlyArray<string>): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actualFields = Object.keys(value);
  return actualFields.length === fields.length && fields.every((field) => actualFields.includes(field));
}

function validPreferences(data: DocumentData | undefined, senderId: string): boolean {
  if (!hasExactFields(data, PREFERENCE_FIELDS) ||
      data.userId !== senderId ||
      !isFirestoreTimestamp(data.createdAt) ||
      !isFirestoreTimestamp(data.updatedAt) ||
      !hasExactFields(data.channels, CHANNEL_FIELDS) ||
      !hasExactFields(data.categories, CATEGORY_FIELDS) ||
      (data.quietHours !== null && !hasExactFields(data.quietHours, QUIET_HOURS_FIELDS))) {
    return false;
  }

  const channels = data.channels;
  const categories = data.categories;
  return CHANNEL_FIELDS.every((field) => typeof channels[field] === "boolean") &&
    channels.push === true &&
    channels.email === false &&
    channels.sms === false &&
    CATEGORY_FIELDS.every((field) => typeof categories[field] === "boolean") &&
    categories.booking_updates === true;
}

function validRegistration(data: DocumentData, documentId: string, senderId: string): boolean {
  return data.active === true &&
    data.provider === "expo" &&
    (data.platform === "android" || data.platform === "ios") &&
    data.userId === senderId &&
    typeof data.deviceId === "string" && data.deviceId === documentId && DEVICE_ID_PATTERN.test(data.deviceId) &&
    typeof data.token === "string" && data.token.length <= 512 && EXPO_TOKEN_PATTERN.test(data.token) &&
    typeof data.registrationVersion === "number" &&
    Number.isSafeInteger(data.registrationVersion) &&
    data.registrationVersion >= 1;
}

function canonicalIdentityMatches(data: DocumentData, bookingId: string, senderId: string): boolean {
  return data.userId === senderId &&
    data.title === BOOKING_ACCEPTED_NOTIFICATION.title &&
    data.body === BOOKING_ACCEPTED_NOTIFICATION.body &&
    data.type === BOOKING_ACCEPTED_NOTIFICATION.type &&
    data.relatedEntityType === BOOKING_ACCEPTED_NOTIFICATION.relatedEntityType &&
    data.relatedId === bookingId;
}

export class BookingAcceptedNotificationService {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly provider: PushProvider,
    private readonly deliveryEnabled: () => boolean = () => process.env.KARRI_PUSH_DELIVERY_ENABLED === "true",
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async handleBookingUpdate(
    bookingId: string,
    before: DocumentData,
    after: DocumentData,
  ): Promise<BookingUpdateResult> {
    if (before.status !== "pending" || after.status !== "accepted") {
      return this.result(false, null, false, "not_applicable", 0);
    }

    validateAcceptedTransition(bookingId, before, after);
    const senderId = after.senderId as string;
    const notificationId = deriveBookingAcceptedNotificationId(bookingId, senderId);
    const notificationRef = this.db.collection("notifications").doc(notificationId);
    const canonicalCreated = await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(notificationRef);
      if (existing.exists) {
        if (!canonicalIdentityMatches(existing.data() ?? {}, bookingId, senderId)) {
          throw new Error("Conflicting canonical notification.");
        }
        return false;
      }
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      transaction.create(notificationRef, {
        userId: senderId,
        title: BOOKING_ACCEPTED_NOTIFICATION.title,
        body: BOOKING_ACCEPTED_NOTIFICATION.body,
        type: BOOKING_ACCEPTED_NOTIFICATION.type,
        relatedEntityType: BOOKING_ACCEPTED_NOTIFICATION.relatedEntityType,
        relatedId: bookingId,
        status: "unread",
        readAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return true;
    });

    if (!canonicalCreated) {
      return this.result(true, notificationId, false, "event_replay", 0);
    }

    if (!this.deliveryEnabled()) {
      return this.result(true, notificationId, canonicalCreated, "delivery_disabled", 0);
    }

    let preferences: DocumentData | undefined;
    try {
      const snapshot = await this.db.collection("notificationPreferences").doc(senderId).get();
      preferences = snapshot.exists ? snapshot.data() : undefined;
    } catch {
      return this.result(true, notificationId, canonicalCreated, "preferences", 0);
    }
    if (!validPreferences(preferences, senderId)) {
      return this.result(true, notificationId, canonicalCreated, "preferences", 0);
    }

    const quietHours = evaluateQuietHours(preferences?.quietHours, this.clock());
    if (quietHours !== "allowed") {
      return this.result(true, notificationId, canonicalCreated, "quiet_hours", 0);
    }

    let registrations: ReadonlyArray<SelectedRegistration>;
    try {
      const snapshot = await this.db.collection("pushTokenRegistrations").doc(senderId)
        .collection("devices")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(MAX_N3A_DEVICE_REGISTRATIONS)
        .get();
      const seenTokens = new Set<string>();
      registrations = snapshot.docs.flatMap((document) => {
        const data = document.data();
        if (!validRegistration(data, document.id, senderId) || seenTokens.has(data.token)) {
          return [];
        }
        seenTokens.add(data.token);
        return [{
          ref: document.ref,
          deviceId: data.deviceId as string,
          token: data.token as string,
          platform: data.platform as "android" | "ios",
          registrationVersion: data.registrationVersion as number,
        }];
      });
    } catch {
      return this.result(true, notificationId, canonicalCreated, "no_tokens", 0);
    }
    if (registrations.length === 0) {
      return this.result(true, notificationId, canonicalCreated, "no_tokens", 0);
    }

    const claims = (await Promise.all(registrations.map((registration) =>
      this.claimDelivery(notificationId, bookingId, senderId, registration)
    ))).filter((claim): claim is ClaimedRegistration => claim !== null);
    if (claims.length === 0) {
      return this.result(true, notificationId, canonicalCreated, null, 0);
    }

    const messages = claims.map((claim): ExpoPushMessage => ({
      to: claim.token,
      title: EXPO_VISIBLE_NOTIFICATION.title,
      body: EXPO_VISIBLE_NOTIFICATION.body,
      data: { schemaVersion: 1, notificationId, action: "open_notifications" },
      channelId: EXPO_VISIBLE_NOTIFICATION.channelId,
    }));
    let results: ReadonlyArray<PushDeliveryResult>;
    try {
      results = await this.provider.send(messages);
    } catch {
      results = claims.map(() => ({
        status: "temporary_failure",
        outcomeCode: "provider_boundary_failure",
        providerTicketId: null,
      }));
    }
    if (results.length !== claims.length) {
      results = claims.map(() => ({
        status: "permanent_failure",
        outcomeCode: "provider_result_mismatch",
        providerTicketId: null,
      }));
    }

    const resultPersistence: Array<Promise<unknown>> = [];
    claims.forEach((claim, index) => {
      const deliveryResult = results[index];
      resultPersistence.push(claim.effectRef.update({
        status: deliveryResult.status,
        outcomeCode: deliveryResult.outcomeCode,
        providerTicketId: deliveryResult.providerTicketId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }));
      if (deliveryResult.status === "invalid_registration") {
        resultPersistence.push(this.deactivateRegistration(claim));
      }
    });
    await Promise.allSettled(resultPersistence);

    return this.result(true, notificationId, canonicalCreated, null, claims.length);
  }

  private async claimDelivery(
    notificationId: string,
    bookingId: string,
    senderId: string,
    registration: SelectedRegistration,
  ): Promise<ClaimedRegistration | null> {
    const effectId = derivePushDeliveryEffectId(notificationId, registration.deviceId);
    const effectRef = this.db.collection("notificationDeliveries").doc(effectId);
    const claimed = await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(effectRef);
      if (existing.exists) {
        return false;
      }
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      transaction.create(effectRef, {
        notificationId,
        bookingId,
        recipientId: senderId,
        registrationId: registration.deviceId,
        registrationVersion: registration.registrationVersion,
        provider: "expo",
        platform: registration.platform,
        status: "claimed",
        outcomeCode: null,
        providerTicketId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return true;
    });
    return claimed ? { ...registration, effectId, effectRef } : null;
  }

  private async deactivateRegistration(registration: SelectedRegistration): Promise<void> {
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(registration.ref);
      const data = snapshot.data();
      if (
        !snapshot.exists ||
        !data ||
        data.active !== true ||
        data.token !== registration.token ||
        data.registrationVersion !== registration.registrationVersion
      ) {
        return;
      }
      transaction.update(registration.ref, {
        active: false,
        token: admin.firestore.FieldValue.delete(),
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }

  private result(
    processed: boolean,
    notificationId: string | null,
    canonicalCreated: boolean,
    pushSuppressionReason: BookingUpdateResult["pushSuppressionReason"],
    claimedDeliveries: number,
  ): BookingUpdateResult {
    return { processed, notificationId, canonicalCreated, pushSuppressionReason, claimedDeliveries };
  }
}
