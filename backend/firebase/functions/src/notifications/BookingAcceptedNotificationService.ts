import { createHash } from "node:crypto";
import admin from "firebase-admin";
import type { DocumentData, DocumentReference } from "firebase-admin/firestore";
import {
  BOOKING_ACCEPTED_NOTIFICATION,
  EXPO_VISIBLE_NOTIFICATION,
  LIFECYCLE_NOTIFICATIONS,
  type SupportedLifecycleEventType,
  type DeliveryStatus,
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

export function deriveLifecycleNotificationId(
  eventType: string,
  bookingId: string,
  recipientId: string,
): string {
  return digestId("notification", `${eventType}:v1:${bookingId}:${recipientId}`);
}

export function deriveBookingAcceptedNotificationId(bookingId: string, senderId: string): string {
  return deriveLifecycleNotificationId("booking.accepted", bookingId, senderId);
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

export interface TransitionDescriptor {
  readonly eventType: SupportedLifecycleEventType;
  readonly recipientId: string;
  readonly actorId: string;
  readonly template: (typeof LIFECYCLE_NOTIFICATIONS)[SupportedLifecycleEventType];
}

export function resolveBookingLifecycleTransition(
  before: DocumentData,
  after: DocumentData,
): TransitionDescriptor | null {
  if (before.status === "pending" && after.status === "accepted") {
    return {
      eventType: "booking.accepted",
      recipientId: after.senderId,
      actorId: after.travelerId,
      template: LIFECYCLE_NOTIFICATIONS["booking.accepted"],
    };
  }
  if (before.status === "accepted" && after.status === "in_transit") {
    return {
      eventType: "package.picked_up",
      recipientId: after.senderId,
      actorId: after.travelerId,
      template: LIFECYCLE_NOTIFICATIONS["package.picked_up"],
    };
  }
  if (before.status === "in_transit" && after.status === "delivered") {
    return {
      eventType: "package.delivered",
      recipientId: after.senderId,
      actorId: after.travelerId,
      template: LIFECYCLE_NOTIFICATIONS["package.delivered"],
    };
  }
  if (before.status === "delivered" && after.status === "completed") {
    return {
      eventType: "shipment.completed",
      recipientId: after.travelerId,
      actorId: after.senderId,
      template: LIFECYCLE_NOTIFICATIONS["shipment.completed"],
    };
  }
  if (before.status === "pending" && after.status === "declined") {
    return {
      eventType: "booking.declined",
      recipientId: after.senderId,
      actorId: after.travelerId,
      template: LIFECYCLE_NOTIFICATIONS["booking.declined"],
    };
  }
  if (before.status === "pending" && after.status === "cancelled") {
    return {
      eventType: "booking.cancelled",
      recipientId: after.travelerId,
      actorId: after.senderId,
      template: LIFECYCLE_NOTIFICATIONS["booking.cancelled"],
    };
  }
  if (before.status === "accepted" && after.status === "cancelled") {
    const lastHistory = Array.isArray(after.statusHistory) && after.statusHistory.length > 0
      ? after.statusHistory[after.statusHistory.length - 1]
      : null;
    const isTravelerActor = lastHistory?.changedBy === after.travelerId;
    const recipientId = isTravelerActor ? after.senderId : after.travelerId;
    const actorId = isTravelerActor ? after.travelerId : after.senderId;
    return {
      eventType: "booking.cancelled",
      recipientId,
      actorId,
      template: LIFECYCLE_NOTIFICATIONS["booking.cancelled"],
    };
  }
  return null;
}

export function validateLifecycleTransition(
  bookingId: string,
  before: DocumentData,
  after: DocumentData,
  descriptor: TransitionDescriptor,
): void {
  const isAccepted = descriptor.eventType === "booking.accepted";
  const errorMessage = isAccepted
    ? "Invalid booking acceptance transition."
    : "Invalid booking lifecycle transition.";

  if (!isIdentifier(bookingId) || !isIdentifier(after.senderId) || !isIdentifier(after.travelerId)) {
    throw new Error(`${errorMessage} (invalid identifiers)`);
  }
  if (after.senderId === after.travelerId) {
    throw new Error(`${errorMessage} (sender equals traveler)`);
  }
  for (const field of IMMUTABLE_BOOKING_FIELDS) {
    if (!valuesEqual(before[field], after[field])) {
      throw new Error(`${errorMessage} (immutable field mismatch: ${field})`);
    }
  }

  const beforeHistory = before.statusHistory;
  const afterHistory = after.statusHistory;
  if (!Array.isArray(beforeHistory) || !Array.isArray(afterHistory) ||
      afterHistory.length !== beforeHistory.length + 1) {
    throw new Error(`${errorMessage} (history length mismatch: before=${beforeHistory?.length}, after=${afterHistory?.length})`);
  }
  for (let index = 0; index < beforeHistory.length; index += 1) {
    if (!valuesEqual(beforeHistory[index], afterHistory[index])) {
      throw new Error(`${errorMessage} (history element ${index} mismatch)`);
    }
  }
  const appended = afterHistory[afterHistory.length - 1];
  if (!appended || typeof appended !== "object" || Array.isArray(appended) ||
      appended.status !== after.status || appended.changedBy !== descriptor.actorId ||
      !isTimestamp(appended.changedAt)) {
    throw new Error(`${errorMessage} (appended entry mismatch: status=${appended?.status} vs ${after.status}, actor=${appended?.changedBy} vs ${descriptor.actorId})`);
  }
}

function validateAcceptedTransition(bookingId: string, before: DocumentData, after: DocumentData): void {
  const descriptor = resolveBookingLifecycleTransition(before, after);
  if (!descriptor || descriptor.eventType !== "booking.accepted") {
    throw new Error("Invalid booking acceptance transition.");
  }
  validateLifecycleTransition(bookingId, before, after, descriptor);
}

export function validateBookingCreated(bookingId: string, booking: DocumentData): void {
  const errorMessage = "Invalid booking request document.";
  if (!isIdentifier(bookingId) || !isIdentifier(booking.senderId) || !isIdentifier(booking.travelerId)) {
    throw new Error(errorMessage);
  }
  if (booking.senderId === booking.travelerId) {
    throw new Error(errorMessage);
  }
  if (booking.status !== "pending") {
    throw new Error(errorMessage);
  }
  if (!Array.isArray(booking.statusHistory) || booking.statusHistory.length < 1) {
    throw new Error(errorMessage);
  }
  const initial = booking.statusHistory[0];
  if (
    !initial ||
    typeof initial !== "object" ||
    Array.isArray(initial) ||
    initial.status !== "pending" ||
    initial.changedBy !== booking.senderId ||
    !isTimestamp(initial.changedAt)
  ) {
    throw new Error(errorMessage);
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

function validPreferences(
  data: DocumentData | undefined,
  recipientId: string,
  requiredCategory: typeof CATEGORY_FIELDS[number] = "booking_updates",
): boolean {
  if (!hasExactFields(data, PREFERENCE_FIELDS) ||
      data.userId !== recipientId ||
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
    categories[requiredCategory] === true;
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

function canonicalIdentityMatches(
  data: DocumentData,
  bookingId: string,
  recipientId: string,
  template: { title: string; body: string; type: string; relatedEntityType: string } = BOOKING_ACCEPTED_NOTIFICATION,
): boolean {
  return data.userId === recipientId &&
    data.title === template.title &&
    data.body === template.body &&
    data.type === template.type &&
    data.relatedEntityType === template.relatedEntityType &&
    data.relatedId === bookingId;
}

export class BookingAcceptedNotificationService {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly provider: PushProvider,
    private readonly deliveryEnabled: () => boolean = () => process.env.KARRI_PUSH_DELIVERY_ENABLED === "true",
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async handleBookingCreated(
    bookingId: string,
    booking: DocumentData,
  ): Promise<BookingUpdateResult> {
    if (booking.status !== "pending") {
      return this.result(false, null, false, "not_applicable", 0);
    }
    validateBookingCreated(bookingId, booking);

    const descriptor: TransitionDescriptor = {
      eventType: "booking.requested",
      recipientId: booking.travelerId,
      actorId: booking.senderId,
      template: LIFECYCLE_NOTIFICATIONS["booking.requested"],
    };

    return await this.dispatchLifecycleNotification(bookingId, descriptor);
  }

  async handleBookingUpdate(
    bookingId: string,
    before: DocumentData,
    after: DocumentData,
  ): Promise<BookingUpdateResult> {
    const descriptor = resolveBookingLifecycleTransition(before, after);
    if (!descriptor) {
      return this.result(false, null, false, "not_applicable", 0);
    }

    validateLifecycleTransition(bookingId, before, after, descriptor);
    return await this.dispatchLifecycleNotification(bookingId, descriptor);
  }

  public async dispatchLifecycleNotification(
    bookingId: string,
    descriptor: TransitionDescriptor,
  ): Promise<BookingUpdateResult> {
    const recipientId = descriptor.recipientId;
    const notificationId = deriveLifecycleNotificationId(descriptor.eventType, bookingId, recipientId);
    const notificationRef = this.db.collection("notifications").doc(notificationId);
    const canonicalCreated = await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(notificationRef);
      if (existing.exists) {
        if (!canonicalIdentityMatches(existing.data() ?? {}, bookingId, recipientId, descriptor.template)) {
          throw new Error("Conflicting canonical notification.");
        }
        return false;
      }
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      transaction.create(notificationRef, {
        userId: recipientId,
        title: descriptor.template.title,
        body: descriptor.template.body,
        type: descriptor.template.type,
        relatedEntityType: descriptor.template.relatedEntityType,
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
      const snapshot = await this.db.collection("notificationPreferences").doc(recipientId).get();
      preferences = snapshot.exists ? snapshot.data() : undefined;
    } catch {
      return this.result(true, notificationId, canonicalCreated, "preferences", 0);
    }
    if (!validPreferences(preferences, recipientId, descriptor.template.category)) {
      return this.result(true, notificationId, canonicalCreated, "preferences", 0);
    }

    const quietHours = evaluateQuietHours(preferences?.quietHours, this.clock());
    if (quietHours !== "allowed") {
      return this.result(true, notificationId, canonicalCreated, "quiet_hours", 0);
    }

    let registrations: ReadonlyArray<SelectedRegistration>;
    try {
      const snapshot = await this.db.collection("pushTokenRegistrations").doc(recipientId)
        .collection("devices")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(MAX_N3A_DEVICE_REGISTRATIONS)
        .get();
      const seenTokens = new Set<string>();
      registrations = snapshot.docs.flatMap((document) => {
        const data = document.data();
        if (!validRegistration(data, document.id, recipientId) || seenTokens.has(data.token)) {
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
      this.claimDelivery(notificationId, bookingId, recipientId, registration)
    ))).filter((claim): claim is ClaimedRegistration => claim !== null);
    if (claims.length === 0) {
      return this.result(true, notificationId, canonicalCreated, null, 0);
    }

    const messages = claims.map((claim: ClaimedRegistration): ExpoPushMessage => ({
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
    claims.forEach((claim: ClaimedRegistration, index: number) => {
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

  public async claimDelivery(
    notificationId: string,
    bookingId: string,
    recipientId: string,
    registration: SelectedRegistration,
  ): Promise<ClaimedRegistration | null> {
    const effectId = derivePushDeliveryEffectId(notificationId, registration.deviceId);
    const effectRef = this.db.collection("notificationDeliveries").doc(effectId);
    const claimed = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(effectRef);
      if (snapshot.exists) {
        return false;
      }

      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      transaction.create(effectRef, {
        notificationId,
        bookingId,
        recipientId,
        registrationId: registration.deviceId,
        registrationVersion: registration.registrationVersion,
        provider: "expo",
        platform: registration.platform,
        status: "claimed",
        outcomeCode: null,
        providerTicketId: null,
        attemptCount: 1,
        maxAttempts: 3,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return true;
    });
    return claimed ? { ...registration, effectId, effectRef } : null;
  }

  public async retryDelivery(effectId: string): Promise<PushDeliveryResult> {
    const effectRef = this.db.collection("notificationDeliveries").doc(effectId);

    type RetryClaimResult =
      | {
          claimed: false;
          status: DeliveryStatus;
          outcomeCode: string;
          ticketId: string | null;
        }
      | {
          claimed: true;
          notificationId: string;
          recipientId: string;
          registrationId: string;
          registrationVersion: number;
          platform: "android" | "ios";
          attemptCount: number;
          maxAttempts: number;
        };

    const claimResult: RetryClaimResult = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(effectRef);
      if (!snapshot.exists) {
        throw new Error("Delivery effect not found.");
      }
      const data = snapshot.data()!;
      if (data.status === "accepted" || data.status === "invalid_registration") {
        return {
          claimed: false,
          status: data.status as DeliveryStatus,
          outcomeCode: "already_terminal",
          ticketId: (data.providerTicketId as string | null) || null,
        };
      }
      const attemptCount = (typeof data.attemptCount === "number" && data.attemptCount >= 1) ? data.attemptCount : 1;
      const maxAttempts = (typeof data.maxAttempts === "number" && data.maxAttempts >= 1) ? data.maxAttempts : 3;
      if (attemptCount >= maxAttempts) {
        transaction.update(effectRef, {
          status: "permanent_failure",
          outcomeCode: "attempts_exhausted",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
          claimed: false,
          status: "permanent_failure" as DeliveryStatus,
          outcomeCode: "attempts_exhausted",
          ticketId: null,
        };
      }

      if (data.status === "claimed") {
        let isExpired = false;
        const updatedAt = data.updatedAt as admin.firestore.Timestamp | undefined;
        if (updatedAt && typeof updatedAt.toMillis === "function") {
          const elapsedMs = this.clock().getTime() - updatedAt.toMillis();
          if (elapsedMs >= 5 * 60 * 1000) {
            isExpired = true;
          }
        }
        if (!isExpired) {
          return {
            claimed: false,
            status: "claimed" as DeliveryStatus,
            outcomeCode: "in_progress",
            ticketId: null,
          };
        }
      }

      const nextAttempt = attemptCount + 1;
      transaction.update(effectRef, {
        status: "claimed",
        attemptCount: nextAttempt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {
        claimed: true,
        notificationId: String(data.notificationId),
        recipientId: String(data.recipientId),
        registrationId: String(data.registrationId),
        registrationVersion: Number(data.registrationVersion ?? 1),
        platform: (data.platform === "ios" ? "ios" : "android") as "android" | "ios",
        attemptCount: nextAttempt,
        maxAttempts,
      };
    });

    if (!claimResult.claimed) {
      return {
        status: claimResult.status,
        outcomeCode: claimResult.outcomeCode,
        providerTicketId: claimResult.ticketId,
      };
    }

    const deviceRef = this.db.collection("pushTokenRegistrations")
      .doc(claimResult.recipientId)
      .collection("devices")
      .doc(claimResult.registrationId);
    const deviceSnap = await deviceRef.get();
    const devData = deviceSnap.data();
    if (!deviceSnap.exists || !devData || devData.active !== true || !devData.token ||
        devData.registrationVersion !== claimResult.registrationVersion) {
      await effectRef.update({
        status: "permanent_failure",
        outcomeCode: "registration_invalid_or_changed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {
        status: "permanent_failure",
        outcomeCode: "registration_invalid_or_changed",
        providerTicketId: null,
      };
    }

    const message: ExpoPushMessage = {
      to: devData.token,
      title: EXPO_VISIBLE_NOTIFICATION.title,
      body: EXPO_VISIBLE_NOTIFICATION.body,
      data: { schemaVersion: 1, notificationId: claimResult.notificationId, action: "open_notifications" },
      channelId: EXPO_VISIBLE_NOTIFICATION.channelId,
    };

    let sendResult: PushDeliveryResult;
    try {
      const results = await this.provider.send([message]);
      sendResult = results[0] || { status: "temporary_failure", outcomeCode: "provider_empty_response", providerTicketId: null };
    } catch {
      sendResult = { status: "temporary_failure", outcomeCode: "provider_boundary_failure", providerTicketId: null };
    }

    let finalStatus = sendResult.status;
    let finalOutcome = sendResult.outcomeCode;
    if (finalStatus === "temporary_failure" && claimResult.attemptCount >= claimResult.maxAttempts) {
      finalStatus = "permanent_failure";
      finalOutcome = "attempts_exhausted";
    }

    await effectRef.update({
      status: finalStatus,
      outcomeCode: finalOutcome,
      providerTicketId: sendResult.providerTicketId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (sendResult.status === "invalid_registration") {
      await this.deactivateRegistration({
        ref: deviceRef,
        deviceId: claimResult.registrationId,
        token: devData.token,
        platform: claimResult.platform,
        registrationVersion: claimResult.registrationVersion,
      });
    }

    return {
      status: finalStatus,
      outcomeCode: finalOutcome,
      providerTicketId: sendResult.providerTicketId,
    };
  }

  public async processRetryableDeliveries(
    limit = 20,
  ): Promise<{
    processed: number;
    retried: number;
    permanentFailures: number;
    inProgressOrTerminal: number;
  }> {
    const deliveriesRef = this.db.collection("notificationDeliveries");
    const failedSnapshot = await deliveriesRef
      .where("status", "==", "temporary_failure")
      .limit(limit)
      .get();

    const claimedSnapshot = await deliveriesRef
      .where("status", "==", "claimed")
      .limit(limit)
      .get();

    const candidates = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    for (const doc of failedSnapshot.docs) {
      candidates.set(doc.id, doc);
    }
    for (const doc of claimedSnapshot.docs) {
      candidates.set(doc.id, doc);
    }

    let processed = 0;
    let retried = 0;
    let permanentFailures = 0;
    let inProgressOrTerminal = 0;

    for (const [effectId, doc] of candidates.entries()) {
      if (processed >= limit) {
        break;
      }
      const data = doc.data();
      if (data.status === "claimed") {
        const updatedAt = data.updatedAt as admin.firestore.Timestamp | undefined;
        let isExpired = false;
        if (updatedAt && typeof updatedAt.toMillis === "function") {
          const elapsedMs = this.clock().getTime() - updatedAt.toMillis();
          if (elapsedMs >= 5 * 60 * 1000) {
            isExpired = true;
          }
        }
        if (!isExpired) {
          continue;
        }
      }

      processed++;
      const outcome = await this.retryDelivery(effectId);
      if (outcome.outcomeCode === "already_terminal" || outcome.outcomeCode === "in_progress") {
        inProgressOrTerminal++;
      } else if (outcome.status === "accepted") {
        retried++;
      } else if (outcome.status === "permanent_failure") {
        permanentFailures++;
      } else {
        inProgressOrTerminal++;
      }
    }

    return { processed, retried, permanentFailures, inProgressOrTerminal };
  }

  public async reconcileBookingLifecycleNotifications(
    bookingId: string,
  ): Promise<{
    scanned: number;
    recovered: number;
    alreadyExisted: number;
  }> {
    const bookingDoc = await this.db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      return { scanned: 0, recovered: 0, alreadyExisted: 0 };
    }
    const bookingData = bookingDoc.data()!;
    const history = Array.isArray(bookingData.statusHistory) ? bookingData.statusHistory : [];

    let scanned = 0;
    let recovered = 0;
    let alreadyExisted = 0;

    // Reconcile initial booking.requested for the pending request
    if (history.length > 0 && history[0].status === "pending") {
      scanned++;
      const reqNotifId = deriveLifecycleNotificationId(
        "booking.requested",
        bookingId,
        bookingData.travelerId,
      );
      const notifDoc = await this.db.collection("notifications").doc(reqNotifId).get();
      if (notifDoc.exists) {
        alreadyExisted++;
      } else {
        const initialPendingDoc: DocumentData = {
          ...bookingData,
          status: "pending",
          statusHistory: [history[0]],
          updatedAt: history[0].changedAt,
        };
        const res = await this.handleBookingCreated(bookingId, initialPendingDoc);
        if (res.canonicalCreated) {
          recovered++;
        } else {
          alreadyExisted++;
        }
      }
    }

    for (let i = 1; i < history.length; i++) {
      const prevEntry = history[i - 1];
      const currEntry = history[i];

      const histBefore: DocumentData = {
        ...bookingData,
        status: prevEntry.status,
        statusHistory: history.slice(0, i),
        updatedAt: prevEntry.changedAt,
      };
      const histAfter: DocumentData = {
        ...bookingData,
        status: currEntry.status,
        statusHistory: history.slice(0, i + 1),
        updatedAt: currEntry.changedAt,
      };

      const descriptor = resolveBookingLifecycleTransition(histBefore, histAfter);
      if (!descriptor) {
        continue;
      }
      scanned++;

      const notificationId = deriveLifecycleNotificationId(
        descriptor.eventType,
        bookingId,
        descriptor.recipientId,
      );
      const notifDoc = await this.db.collection("notifications").doc(notificationId).get();
      if (notifDoc.exists) {
        alreadyExisted++;
      } else {
        const res = await this.handleBookingUpdate(bookingId, histBefore, histAfter);
        if (res.canonicalCreated) {
          recovered++;
        } else {
          alreadyExisted++;
        }
      }
    }

    return { scanned, recovered, alreadyExisted };
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

export { BookingAcceptedNotificationService as LifecycleNotificationService };
