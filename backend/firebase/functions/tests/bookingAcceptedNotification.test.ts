import admin from "firebase-admin";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingAcceptedNotificationService,
  deriveBookingAcceptedNotificationId,
  derivePushDeliveryEffectId,
  evaluateQuietHours,
} from "../src/notifications/BookingAcceptedNotificationService.js";
import type {
  ExpoPushMessage,
  PushDeliveryResult,
  PushProvider,
} from "../src/notifications/NotificationContracts.js";
import { onBookingAccepted } from "../src/index.js";

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "demo-karri-mobile" });
}

const db = admin.firestore();
const bookingId = "booking-n3a-test";
const senderId = "sender-n3a-test";
const travelerId = "traveler-n3a-test";
const deviceOne = "karri-aaaaaaaaaaaaaaaa";
const deviceTwo = "karri-bbbbbbbbbbbbbbbb";
const tokenOne = "ExpoPushToken[FAKE_N3A_TOKEN_ONE]";
const tokenTwo = "ExponentPushToken[FAKE_N3A_TOKEN_TWO]";

class FakeProvider implements PushProvider {
  readonly messages: ExpoPushMessage[][] = [];
  constructor(
    private readonly results: ReadonlyArray<PushDeliveryResult> = [{
      status: "accepted",
      outcomeCode: "ticket_accepted",
      providerTicketId: "fake-ticket",
    }],
    private readonly failure: Error | null = null,
  ) {}

  async send(messages: ReadonlyArray<ExpoPushMessage>): Promise<ReadonlyArray<PushDeliveryResult>> {
    this.messages.push([...messages]);
    if (this.failure) {
      throw this.failure;
    }
    return this.results;
  }
}

function booking(status: string, history = [historyEntry(status, status === "pending" ? senderId : travelerId)]) {
  return {
    bookingRequestId: "request-n3a-test",
    shipmentId: "shipment-n3a-test",
    tripId: "trip-n3a-test",
    senderId,
    travelerId,
    status,
    statusHistory: history,
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-07-01T12:00:00.000Z")),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-07-01T12:00:00.000Z")),
  };
}

function historyEntry(status: string, changedBy: string) {
  return {
    status,
    changedBy,
    changedAt: admin.firestore.Timestamp.fromDate(new Date("2026-07-01T12:00:00.000Z")),
  };
}

function transition() {
  const before = booking("pending");
  return {
    before,
    after: {
      ...before,
      status: "accepted",
      statusHistory: [...before.statusHistory, historyEntry("accepted", travelerId)],
      updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-07-01T12:01:00.000Z")),
    },
  };
}

async function setPreferences(overrides: Record<string, unknown> = {}) {
  await db.collection("notificationPreferences").doc(senderId).set(preferenceDocument(overrides));
}

function preferenceDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const timestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-01T11:00:00.000Z"));
  return {
    userId: senderId,
    channels: { push: true, email: false, sms: false },
    categories: {
      booking_requests: false,
      booking_updates: true,
      custody_updates: false,
      delivery_updates: false,
      general_announcements: false,
      review_reminders: false,
      trust_profile_alerts: false,
    },
    quietHours: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

async function setRegistration(
  deviceId: string,
  token: string | undefined,
  overrides: Record<string, unknown> = {},
) {
  const data: Record<string, unknown> = {
    userId: senderId,
    deviceId,
    active: true,
    provider: "expo",
    platform: "android",
    registrationVersion: 1,
    ...overrides,
  };
  if (token !== undefined) {
    data.token = token;
  }
  await db.collection("pushTokenRegistrations").doc(senderId).collection("devices").doc(deviceId).set(data);
}

function service(
  provider: PushProvider = new FakeProvider(),
  enabled = true,
  now = new Date("2026-07-01T12:00:00.000Z"),
) {
  return new BookingAcceptedNotificationService(db, provider, () => enabled, () => now);
}

async function clearTopLevelCollection(name: string) {
  const snapshot = await db.collection(name).get();
  await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
}

beforeEach(async () => {
  await Promise.all([
    clearTopLevelCollection("notifications"),
    clearTopLevelCollection("notificationDeliveries"),
    clearTopLevelCollection("notificationPreferences"),
    db.recursiveDelete(db.collection("pushTokenRegistrations").doc(senderId)),
  ]);
});

describe("BookingAcceptedNotificationService transition and canonical notification", () => {
  it("wires the Firestore update trigger to the trusted service in us-east1", async () => {
    const { before, after } = transition();
    await onBookingAccepted.run({
      data: {
        before: { data: () => before },
        after: { data: () => after },
      },
      params: { bookingId },
    } as never);

    const id = deriveBookingAcceptedNotificationId(bookingId, senderId);
    expect((await db.collection("notifications").doc(id).get()).data()?.userId).toBe(senderId);
    expect((onBookingAccepted as unknown as { __endpoint: { region: string[] } }).__endpoint.region)
      .toContain("us-east1");
  });

  it("ignores unrelated updates and every transition other than pending to accepted", async () => {
    const provider = new FakeProvider();
    const unchangedPending = booking("pending");
    const accepted = booking("accepted");
    const delivered = booking("delivered");

    expect((await service(provider).handleBookingUpdate(bookingId, unchangedPending, unchangedPending)).processed).toBe(false);
    expect((await service(provider).handleBookingUpdate(bookingId, accepted, delivered)).processed).toBe(false);
    expect((await db.collection("notifications").get()).empty).toBe(true);
    expect(provider.messages).toHaveLength(0);
  });

  it("fails closed when immutable booking core changes", async () => {
    const { before, after } = transition();
    await expect(service().handleBookingUpdate(bookingId, before, {
      ...after,
      shipmentId: "changed-shipment",
    })).rejects.toThrow("Invalid booking acceptance transition");
    expect((await db.collection("notifications").get()).empty).toBe(true);
  });

  it.each([
    ["does not grow", (before: FirebaseFirestore.DocumentData, after: FirebaseFirestore.DocumentData) => ({ ...after, statusHistory: before.statusHistory })],
    ["rewrites history", (before: FirebaseFirestore.DocumentData, after: FirebaseFirestore.DocumentData) => ({ ...after, statusHistory: [historyEntry("pending", travelerId), after.statusHistory[1]] })],
    ["uses the wrong actor", (_before: FirebaseFirestore.DocumentData, after: FirebaseFirestore.DocumentData) => ({ ...after, statusHistory: [after.statusHistory[0], historyEntry("accepted", senderId)] })],
    ["uses an invalid timestamp", (_before: FirebaseFirestore.DocumentData, after: FirebaseFirestore.DocumentData) => ({ ...after, statusHistory: [after.statusHistory[0], { status: "accepted", changedBy: travelerId, changedAt: "now" }] })],
  ])("fails closed when status history %s", async (_label, mutate) => {
    const { before, after } = transition();
    await expect(service().handleBookingUpdate(bookingId, before, mutate(before, after)))
      .rejects.toThrow("Invalid booking acceptance transition");
  });

  it("derives the recipient only from after.senderId and creates mapper-compatible canonical fields", async () => {
    const { before, after } = transition();
    const result = await service().handleBookingUpdate(bookingId, before, {
      ...after,
      recipientIds: [travelerId],
      token: tokenOne,
    });
    const snapshot = await db.collection("notifications").doc(result.notificationId!).get();

    expect(snapshot.data()).toMatchObject({
      userId: senderId,
      title: "Booking accepted",
      body: "The booking was accepted.",
      type: "booking.accepted",
      relatedEntityType: "booking",
      relatedId: bookingId,
      status: "unread",
      readAt: null,
    });
    expect(Object.keys(snapshot.data()!).sort()).toEqual([
      "body", "createdAt", "readAt", "relatedEntityType", "relatedId", "status", "title", "type", "updatedAt", "userId",
    ]);
    expect(result.pushSuppressionReason).toBe("preferences");
  });

  it("uses an opaque deterministic ID and treats duplicate invocation as a replay", async () => {
    const { before, after } = transition();
    const expectedId = deriveBookingAcceptedNotificationId(bookingId, senderId);
    expect(expectedId).not.toContain(senderId);

    const first = await service().handleBookingUpdate(bookingId, before, after);
    const second = await service().handleBookingUpdate(bookingId, before, after);

    expect(first.notificationId).toBe(expectedId);
    expect(first.canonicalCreated).toBe(true);
    expect(second.canonicalCreated).toBe(false);
    expect(second.pushSuppressionReason).toBe("event_replay");
    expect(second.claimedDeliveries).toBe(0);
    expect((await db.collection("notifications").get()).size).toBe(1);
  });

  it("fails closed on a conflicting deterministic notification", async () => {
    const { before, after } = transition();
    const id = deriveBookingAcceptedNotificationId(bookingId, senderId);
    await db.collection("notifications").doc(id).set({
      userId: travelerId,
      title: "Booking accepted",
      body: "The booking was accepted.",
      type: "booking.accepted",
      relatedEntityType: "booking",
      relatedId: bookingId,
    });
    await expect(service().handleBookingUpdate(bookingId, before, after))
      .rejects.toThrow("Conflicting canonical notification");
  });

  it("keeps the canonical notification when the provider boundary fails", async () => {
    await setPreferences();
    await setRegistration(deviceOne, tokenOne);
    const provider = new FakeProvider([], new Error(`unsafe ${tokenOne}`));
    const { before, after } = transition();
    const result = await service(provider).handleBookingUpdate(bookingId, before, after);

    expect((await db.collection("notifications").doc(result.notificationId!).get()).exists).toBe(true);
    const effect = await db.collection("notificationDeliveries")
      .doc(derivePushDeliveryEffectId(result.notificationId!, deviceOne)).get();
    expect(effect.data()?.status).toBe("temporary_failure");
    expect(JSON.stringify(effect.data())).not.toContain(tokenOne);
  });
});

describe("preferences, quiet hours, and kill switch", () => {
  it("suppresses incomplete, malformed, mismatched, and unknown preference fields while retaining canonical records", async () => {
    const complete = preferenceDocument();
    const channels = complete.channels as Record<string, unknown>;
    const categories = complete.categories as Record<string, unknown>;
    const missingChannel = { ...channels };
    delete missingChannel.sms;
    const missingCategory = { ...categories };
    delete missingCategory.review_reminders;
    const missingCreatedAt = { ...complete };
    delete missingCreatedAt.createdAt;
    const missingUpdatedAt = { ...complete };
    delete missingUpdatedAt.updatedAt;
    const cases: Array<[string, Record<string, unknown> | null]> = [
      ["missing document", null],
      ["minimal push and booking update flags", {
        userId: senderId,
        channels: { push: true },
        categories: { booking_updates: true },
      }],
      ["missing channel", { ...complete, channels: missingChannel }],
      ["missing category", { ...complete, categories: missingCategory }],
      ["non-boolean unrelated category", {
        ...complete,
        categories: { ...categories, review_reminders: "false" },
      }],
      ["unknown channel", { ...complete, channels: { ...channels, pager: false } }],
      ["unknown category", { ...complete, categories: { ...categories, promotions: false } }],
      ["missing createdAt", missingCreatedAt],
      ["missing updatedAt", missingUpdatedAt],
      ["invalid createdAt timestamp", { ...complete, createdAt: "2026-07-01" }],
      ["invalid updatedAt timestamp", { ...complete, updatedAt: 1_751_370_000_000 }],
      ["unknown top-level field", { ...complete, locale: "en" }],
      ["quiet hours missing key", {
        ...complete,
        quietHours: { startLocalTime: "22:00", endLocalTime: "07:00" },
      }],
      ["quiet hours unknown key", {
        ...complete,
        quietHours: { startLocalTime: "22:00", endLocalTime: "07:00", timeZone: "UTC", enabled: true },
      }],
      ["mismatched userId", { ...complete, userId: travelerId }],
      ["disabled push", { ...complete, channels: { ...channels, push: false } }],
      ["disabled booking updates", {
        ...complete,
        categories: { ...categories, booking_updates: false },
      }],
    ];
    for (const [label, preferences] of cases) {
      await clearTopLevelCollection("notifications");
      await clearTopLevelCollection("notificationPreferences");
      if (preferences) {
        await db.collection("notificationPreferences").doc(senderId).set(preferences);
      }
      const { before, after } = transition();
      const result = await service().handleBookingUpdate(bookingId, before, after);
      expect(result.pushSuppressionReason, label).toBe("preferences");
      expect(result.canonicalCreated, label).toBe(true);
      expect((await db.collection("notifications").doc(result.notificationId!).get()).exists, label).toBe(true);
    }
  });

  it("permits delivery with valid enabled preferences and no quiet hours", async () => {
    await setPreferences();
    await setRegistration(deviceOne, tokenOne);
    const provider = new FakeProvider();
    const { before, after } = transition();
    await service(provider).handleBookingUpdate(bookingId, before, after);
    expect(provider.messages).toHaveLength(1);
  });

  it("defaults the kill switch to disabled behavior without token lookup or effects", async () => {
    await setPreferences();
    await setRegistration(deviceOne, tokenOne);
    const provider = new FakeProvider();
    const { before, after } = transition();
    const result = await service(provider, false).handleBookingUpdate(bookingId, before, after);
    expect(result.pushSuppressionReason).toBe("delivery_disabled");
    expect(provider.messages).toHaveLength(0);
    expect((await db.collection("notificationDeliveries").get()).empty).toBe(true);
  });

  it.each([
    ["same-day start", { startLocalTime: "08:00", endLocalTime: "17:00", timeZone: "UTC" }, new Date("2026-01-01T08:00:00Z"), "quiet"],
    ["same-day end", { startLocalTime: "08:00", endLocalTime: "17:00", timeZone: "UTC" }, new Date("2026-01-01T17:00:00Z"), "allowed"],
    ["overnight late", { startLocalTime: "22:00", endLocalTime: "07:00", timeZone: "UTC" }, new Date("2026-01-01T23:00:00Z"), "quiet"],
    ["overnight early", { startLocalTime: "22:00", endLocalTime: "07:00", timeZone: "UTC" }, new Date("2026-01-01T06:59:00Z"), "quiet"],
    ["overnight end", { startLocalTime: "22:00", endLocalTime: "07:00", timeZone: "UTC" }, new Date("2026-01-01T07:00:00Z"), "allowed"],
    ["invalid zone", { startLocalTime: "08:00", endLocalTime: "17:00", timeZone: "Not/AZone" }, new Date("2026-01-01T12:00:00Z"), "invalid"],
    ["DST spring-forward", { startLocalTime: "03:00", endLocalTime: "04:00", timeZone: "America/New_York" }, new Date("2026-03-08T07:30:00Z"), "quiet"],
  ])("evaluates quiet hours at %s", (_name, quietHours, now, expected) => {
    expect(evaluateQuietHours(quietHours, now)).toBe(expected);
  });

  it("suppresses permanently during quiet hours", async () => {
    await setPreferences({ quietHours: { startLocalTime: "08:00", endLocalTime: "17:00", timeZone: "UTC" } });
    await setRegistration(deviceOne, tokenOne);
    const provider = new FakeProvider();
    const { before, after } = transition();
    const result = await service(provider, true, new Date("2026-07-01T12:00:00Z"))
      .handleBookingUpdate(bookingId, before, after);
    expect(result.pushSuppressionReason).toBe("quiet_hours");
    expect(provider.messages).toHaveLength(0);
    expect((await db.collection("notificationDeliveries").get()).empty).toBe(true);
  });

  it("treats quiet-hours suppression as terminal on a replay outside quiet hours", async () => {
    await setPreferences({ quietHours: { startLocalTime: "08:00", endLocalTime: "17:00", timeZone: "UTC" } });
    await setRegistration(deviceOne, tokenOne);
    const provider = new FakeProvider();
    const { before, after } = transition();

    const first = await service(provider, true, new Date("2026-07-01T12:00:00Z"))
      .handleBookingUpdate(bookingId, before, after);
    const replay = await service(provider, true, new Date("2026-07-01T20:00:00Z"))
      .handleBookingUpdate(bookingId, before, after);

    expect(first.canonicalCreated).toBe(true);
    expect(first.pushSuppressionReason).toBe("quiet_hours");
    expect(replay.canonicalCreated).toBe(false);
    expect(replay.pushSuppressionReason).toBe("event_replay");
    expect(provider.messages).toHaveLength(0);
    expect((await db.collection("notifications").get()).size).toBe(1);
    expect((await db.collection("notificationDeliveries").get()).empty).toBe(true);
  });

  it("treats preference suppression as terminal after preferences and registration become enabled", async () => {
    const disabled = preferenceDocument();
    const channels = disabled.channels as Record<string, unknown>;
    await setPreferences({ channels: { ...channels, push: false } });
    const provider = new FakeProvider();
    const { before, after } = transition();

    const first = await service(provider).handleBookingUpdate(bookingId, before, after);
    await setPreferences();
    await setRegistration(deviceOne, tokenOne);
    const replay = await service(provider).handleBookingUpdate(bookingId, before, after);

    expect(first.canonicalCreated).toBe(true);
    expect(first.pushSuppressionReason).toBe("preferences");
    expect(replay.canonicalCreated).toBe(false);
    expect(replay.pushSuppressionReason).toBe("event_replay");
    expect(provider.messages).toHaveLength(0);
    expect((await db.collection("notificationDeliveries").get()).empty).toBe(true);
  });

  it("treats kill-switch suppression as terminal after delivery becomes enabled", async () => {
    await setPreferences();
    await setRegistration(deviceOne, tokenOne);
    const provider = new FakeProvider();
    const { before, after } = transition();

    const first = await service(provider, false).handleBookingUpdate(bookingId, before, after);
    const replay = await service(provider, true).handleBookingUpdate(bookingId, before, after);

    expect(first.canonicalCreated).toBe(true);
    expect(first.pushSuppressionReason).toBe("delivery_disabled");
    expect(replay.canonicalCreated).toBe(false);
    expect(replay.pushSuppressionReason).toBe("event_replay");
    expect(provider.messages).toHaveLength(0);
    expect((await db.collection("notificationDeliveries").get()).empty).toBe(true);
  });
});

describe("trusted token selection and delivery effects", () => {
  it("selects only valid active bound Expo Android/iOS records and deduplicates raw tokens", async () => {
    await setPreferences();
    await setRegistration(deviceOne, tokenOne);
    await setRegistration(deviceTwo, tokenOne, { platform: "ios" });
    await setRegistration("karri-cccccccccccccccc", tokenTwo, { active: false });
    await setRegistration("karri-dddddddddddddddd", tokenTwo, { userId: travelerId });
    await setRegistration("karri-eeeeeeeeeeeeeeee", tokenTwo, { provider: "fcm" });
    await setRegistration("karri-ffffffffffffffff", tokenTwo, { platform: "web" });
    await setRegistration("karri-gggggggggggggggg", undefined);
    await setRegistration("karri-hhhhhhhhhhhhhhhh", "not-an-expo-token");
    await setRegistration("karri-iiiiiiiiiiiiiiii", tokenTwo, { registrationVersion: 0 });
    const provider = new FakeProvider();
    const { before, after } = transition();

    const result = await service(provider).handleBookingUpdate(bookingId, before, after);

    expect(result.claimedDeliveries).toBe(1);
    expect(provider.messages).toHaveLength(1);
    expect(provider.messages[0]).toHaveLength(1);
    expect(provider.messages[0][0].to).toBe(tokenOne);
  });

  it("does not call the provider when no valid token exists", async () => {
    await setPreferences();
    await setRegistration(deviceOne, undefined);
    const provider = new FakeProvider();
    const { before, after } = transition();
    const result = await service(provider).handleBookingUpdate(bookingId, before, after);
    expect(result.pushSuppressionReason).toBe("no_tokens");
    expect(provider.messages).toHaveLength(0);
  });

  it("treats no-token suppression as terminal after a valid registration is added", async () => {
    await setPreferences();
    const provider = new FakeProvider();
    const { before, after } = transition();

    const first = await service(provider).handleBookingUpdate(bookingId, before, after);
    await setRegistration(deviceOne, tokenOne);
    const replay = await service(provider).handleBookingUpdate(bookingId, before, after);

    expect(first.canonicalCreated).toBe(true);
    expect(first.pushSuppressionReason).toBe("no_tokens");
    expect(replay.canonicalCreated).toBe(false);
    expect(replay.pushSuppressionReason).toBe("event_replay");
    expect(provider.messages).toHaveLength(0);
    expect((await db.collection("notificationDeliveries").get()).empty).toBe(true);
  });

  it("claims each device once and does not send again on replay", async () => {
    await setPreferences();
    await setRegistration(deviceOne, tokenOne);
    const provider = new FakeProvider();
    const { before, after } = transition();
    const first = await service(provider).handleBookingUpdate(bookingId, before, after);
    const replay = await service(provider).handleBookingUpdate(bookingId, before, after);
    expect(first.canonicalCreated).toBe(true);
    expect(first.claimedDeliveries).toBe(1);
    expect(replay.canonicalCreated).toBe(false);
    expect(replay.pushSuppressionReason).toBe("event_replay");
    expect(replay.claimedDeliveries).toBe(0);
    expect(provider.messages).toHaveLength(1);
    expect((await db.collection("notifications").get()).size).toBe(1);
    expect((await db.collection("notificationDeliveries").get()).size).toBe(1);
    const effect = await db.collection("notificationDeliveries")
      .doc(derivePushDeliveryEffectId(first.notificationId!, deviceOne)).get();
    expect(effect.exists).toBe(true);
    expect(effect.data()?.registrationVersion).toBe(1);
    expect(JSON.stringify(effect.data())).not.toContain(tokenOne);
  });

  it("deterministically bounds registration inspection, delivery claims, and provider messages at 100", async () => {
    const registrationLimit = 100;
    await setPreferences();
    const registrations = Array.from({ length: registrationLimit + 1 }, (_, index) => {
      const suffix = String(index).padStart(16, "0");
      return {
        deviceId: `karri-${suffix}`,
        token: `ExpoPushToken[FAKE_N3A_BOUND_${suffix}]`,
      };
    });
    await Promise.all(registrations.map(({ deviceId, token }) => setRegistration(deviceId, token)));
    const provider = new FakeProvider(Array.from({ length: registrationLimit }, (_, index) => ({
      status: "accepted",
      outcomeCode: "ticket_accepted",
      providerTicketId: `fake-ticket-${index}`,
    })));
    const { before, after } = transition();

    const first = await service(provider).handleBookingUpdate(bookingId, before, after);
    const replay = await service(provider).handleBookingUpdate(bookingId, before, after);
    const effects = await db.collection("notificationDeliveries").get();

    expect(first.claimedDeliveries).toBe(registrationLimit);
    expect(replay.claimedDeliveries).toBe(0);
    expect(replay.pushSuppressionReason).toBe("event_replay");
    expect(provider.messages).toHaveLength(1);
    expect(provider.messages[0]).toHaveLength(registrationLimit);
    expect(effects.size).toBe(registrationLimit);
    expect(provider.messages[0].map((entry) => entry.to)).toEqual(
      registrations.slice(0, registrationLimit).map((entry) => entry.token),
    );
    expect(provider.messages[0].map((entry) => entry.to)).not.toContain(registrations[registrationLimit].token);
  });

  it("does not deactivate a newer registration generation after an older send is rejected", async () => {
    await setPreferences();
    await setRegistration(deviceOne, tokenOne);

    const rotatedToken = "ExpoPushToken[FAKE_N3B_ROTATED_TOKEN]";
    const registrationRef = db.collection("pushTokenRegistrations").doc(senderId)
      .collection("devices").doc(deviceOne);

    const provider: PushProvider = {
      async send() {
        await registrationRef.update({
          token: rotatedToken,
          registrationVersion: 2,
          registeredAt: "2026-07-01T12:02:00.000Z",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return [{
          status: "invalid_registration",
          outcomeCode: "device_not_registered",
          providerTicketId: null,
        }];
      },
    };

    const { before, after } = transition();
    const result = await service(provider).handleBookingUpdate(bookingId, before, after);

    const registration = (await registrationRef.get()).data();
    expect(registration?.active).toBe(true);
    expect(registration?.token).toBe(rotatedToken);
    expect(registration?.registrationVersion).toBe(2);
    expect(registration?.revokedAt).toBeUndefined();

    const effect = await db.collection("notificationDeliveries")
      .doc(derivePushDeliveryEffectId(result.notificationId!, deviceOne)).get();
    expect(effect.data()?.status).toBe("invalid_registration");
    expect(effect.data()?.registrationVersion).toBe(1);
    expect(JSON.stringify(effect.data())).not.toContain(tokenOne);
    expect(JSON.stringify(effect.data())).not.toContain(rotatedToken);
  });

  it("persists partial outcomes and transactionally removes an explicitly invalid token", async () => {
    await setPreferences();
    await setRegistration(deviceOne, tokenOne);
    await setRegistration(deviceTwo, tokenTwo, { platform: "ios" });
    const provider = new FakeProvider([
      { status: "accepted", outcomeCode: "ticket_accepted", providerTicketId: "ticket-one" },
      { status: "invalid_registration", outcomeCode: "device_not_registered", providerTicketId: null },
    ]);
    const { before, after } = transition();
    const result = await service(provider).handleBookingUpdate(bookingId, before, after);
    const effects = await db.collection("notificationDeliveries").get();
    expect(effects.docs.map((entry) => entry.data().status).sort()).toEqual(["accepted", "invalid_registration"]);
    expect(effects.docs.every((entry) => entry.data().registrationVersion === 1)).toBe(true);

    const invalidRegistration = await db.collection("pushTokenRegistrations").doc(senderId)
      .collection("devices").doc(deviceTwo).get();
    expect(invalidRegistration.data()?.active).toBe(false);
    expect(invalidRegistration.data()?.token).toBeUndefined();
    expect(invalidRegistration.data()?.revokedAt).toBeInstanceOf(admin.firestore.Timestamp);
    expect(JSON.stringify(effects.docs.map((entry) => entry.data()))).not.toContain(tokenOne);
    expect(JSON.stringify(effects.docs.map((entry) => entry.data()))).not.toContain(tokenTwo);
    expect(result.notificationId).toBeTruthy();
  });
});
