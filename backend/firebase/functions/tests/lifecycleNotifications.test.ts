import admin from "firebase-admin";
import { beforeEach, describe, expect, it } from "vitest";
import {
  BookingAcceptedNotificationService,
  deriveLifecycleNotificationId,
  derivePushDeliveryEffectId,
} from "../src/notifications/BookingAcceptedNotificationService.js";
import {
  EXPO_VISIBLE_NOTIFICATION,
  LIFECYCLE_NOTIFICATIONS,
  type ExpoPushMessage,
  type PushDeliveryResult,
  type PushProvider,
  type SupportedLifecycleEventType,
} from "../src/notifications/NotificationContracts.js";

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "demo-karri-mobile" });
}

const db = admin.firestore();
const bookingId = "booking-r07-lifecycle-test";
const senderId = "sender-r07-test";
const travelerId = "traveler-r07-test";
const deviceSender = "karri-aaaaaaaaaaaaaaaa";
const deviceTraveler = "karri-bbbbbbbbbbbbbbbb";
const tokenSender = "ExpoPushToken[FAKE_R07_SENDER_TOKEN]";
const tokenTraveler = "ExpoPushToken[FAKE_R07_TRAVELER_TOKEN]";

class TestPushProvider implements PushProvider {
  readonly messages: ExpoPushMessage[][] = [];
  constructor(
    public results: ReadonlyArray<PushDeliveryResult> = [{
      status: "accepted",
      outcomeCode: "ticket_accepted",
      providerTicketId: "ticket-r07-default",
    }],
    public failure: Error | null = null,
  ) {}

  async send(messages: ReadonlyArray<ExpoPushMessage>): Promise<ReadonlyArray<PushDeliveryResult>> {
    this.messages.push([...messages]);
    if (this.failure) {
      throw this.failure;
    }
    return this.results;
  }
}

function historyEntry(status: string, changedBy: string, dateStr = "2026-07-01T12:00:00.000Z") {
  return {
    status,
    changedBy,
    changedAt: admin.firestore.Timestamp.fromDate(new Date(dateStr)),
  };
}

function createBooking(status: string, history: Array<ReturnType<typeof historyEntry>>) {
  return {
    bookingRequestId: "request-r07-test",
    shipmentId: "shipment-r07-test",
    tripId: "trip-r07-test",
    senderId,
    travelerId,
    status,
    statusHistory: history,
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-07-01T12:00:00.000Z")),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-07-01T12:00:00.000Z")),
  };
}

function createLifecycleTransition(eventType: SupportedLifecycleEventType) {
  const hPending = historyEntry("pending", senderId, "2026-07-01T12:00:00.000Z");
  const hAccepted = historyEntry("accepted", travelerId, "2026-07-01T12:01:00.000Z");
  const hInTransit = historyEntry("in_transit", travelerId, "2026-07-01T12:02:00.000Z");
  const hDelivered = historyEntry("delivered", travelerId, "2026-07-01T12:03:00.000Z");
  const hCompleted = historyEntry("completed", senderId, "2026-07-01T12:04:00.000Z");
  const hDeclined = historyEntry("declined", travelerId, "2026-07-01T12:01:00.000Z");

  switch (eventType) {
    case "booking.accepted": {
      const before = createBooking("pending", [hPending]);
      const after = {
        ...before,
        status: "accepted",
        statusHistory: [hPending, hAccepted],
        updatedAt: hAccepted.changedAt,
      };
      return { before, after };
    }
    case "booking.declined": {
      const before = createBooking("pending", [hPending]);
      const after = {
        ...before,
        status: "declined",
        statusHistory: [hPending, hDeclined],
        updatedAt: hDeclined.changedAt,
      };
      return { before, after };
    }
    case "booking.cancelled": {
      const hCancelled = historyEntry("cancelled", senderId, "2026-07-01T12:01:00.000Z");
      const before = createBooking("pending", [hPending]);
      const after = {
        ...before,
        status: "cancelled",
        statusHistory: [hPending, hCancelled],
        updatedAt: hCancelled.changedAt,
      };
      return { before, after };
    }
    case "booking.requested": {
      const before = createBooking("pending", [hPending]);
      const after = { ...before };
      return { before, after };
    }
    case "package.picked_up": {
      const before = createBooking("accepted", [hPending, hAccepted]);
      const after = {
        ...before,
        status: "in_transit",
        statusHistory: [hPending, hAccepted, hInTransit],
        updatedAt: hInTransit.changedAt,
      };
      return { before, after };
    }
    case "package.delivered": {
      const before = createBooking("in_transit", [hPending, hAccepted, hInTransit]);
      const after = {
        ...before,
        status: "delivered",
        statusHistory: [hPending, hAccepted, hInTransit, hDelivered],
        updatedAt: hDelivered.changedAt,
      };
      return { before, after };
    }
    case "shipment.completed": {
      const before = createBooking("delivered", [hPending, hAccepted, hInTransit, hDelivered]);
      const after = {
        ...before,
        status: "completed",
        statusHistory: [hPending, hAccepted, hInTransit, hDelivered, hCompleted],
        updatedAt: hCompleted.changedAt,
      };
      return { before, after };
    }
  }
}

async function seedUserPreferences(userId: string) {
  const timestamp = admin.firestore.Timestamp.fromDate(new Date("2026-07-01T11:00:00.000Z"));
  await db.collection("notificationPreferences").doc(userId).set({
    userId,
    channels: { push: true, email: false, sms: false },
    categories: {
      booking_requests: true,
      booking_updates: true,
      custody_updates: true,
      delivery_updates: true,
      general_announcements: false,
      review_reminders: false,
      trust_profile_alerts: false,
    },
    quietHours: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function seedDeviceRegistration(
  userId: string,
  deviceId: string,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  await db.collection("pushTokenRegistrations").doc(userId).collection("devices").doc(deviceId).set({
    userId,
    deviceId,
    active: true,
    provider: "expo",
    platform: "android",
    registrationVersion: 1,
    token,
    ...overrides,
  });
}

async function clearTopLevelCollection(name: string) {
  const snapshot = await db.collection(name).get();
  await Promise.all(snapshot.docs.map((d) => d.ref.delete()));
}

function makeService(
  provider: PushProvider = new TestPushProvider(),
  clockNow = new Date("2026-07-01T12:05:00.000Z"),
) {
  return new BookingAcceptedNotificationService(
    db,
    provider,
    () => true,
    () => clockNow,
  );
}

beforeEach(async () => {
  await Promise.all([
    clearTopLevelCollection("notifications"),
    clearTopLevelCollection("notificationDeliveries"),
    clearTopLevelCollection("notificationPreferences"),
    clearTopLevelCollection("bookings"),
    db.recursiveDelete(db.collection("pushTokenRegistrations").doc(senderId)),
    db.recursiveDelete(db.collection("pushTokenRegistrations").doc(travelerId)),
  ]);
});

describe("R07 — Comprehensive Lifecycle Notifications & Idempotency", () => {
  it.each([
    ["booking.accepted", senderId, deviceSender, tokenSender],
    ["booking.declined", senderId, deviceSender, tokenSender],
    ["package.picked_up", senderId, deviceSender, tokenSender],
    ["package.delivered", senderId, deviceSender, tokenSender],
    ["shipment.completed", travelerId, deviceTraveler, tokenTraveler],
  ] as const)(
    "processes lifecycle event %s: creates canonical record, routes to recipient %s, delivers push idempotently",
    async (eventType, expectedRecipient, deviceId, token) => {
      await seedUserPreferences(expectedRecipient);
      await seedDeviceRegistration(expectedRecipient, deviceId, token);

      const provider = new TestPushProvider();
      const s = makeService(provider);
      const { before, after } = createLifecycleTransition(eventType);

      // First invocation
      const result1 = await s.handleBookingUpdate(bookingId, before, after);
      expect(result1.processed).toBe(true);
      expect(result1.claimedDeliveries).toBe(1);
      expect(result1.notificationId).toBe(deriveLifecycleNotificationId(eventType, bookingId, expectedRecipient));

      // Assert canonical notification in Firestore
      const expectedTemplate = LIFECYCLE_NOTIFICATIONS[eventType];
      const notifDoc = await db.collection("notifications").doc(result1.notificationId!).get();
      expect(notifDoc.exists).toBe(true);
      const notifData = notifDoc.data();
      expect(notifData?.userId).toBe(expectedRecipient);
      expect(notifData?.type).toBe(eventType);
      expect(notifData?.title).toBe(expectedTemplate.title);
      expect(notifData?.body).toBe(expectedTemplate.body);
      expect(notifData?.relatedEntityType).toBe("booking");
      expect(notifData?.relatedId).toBe(bookingId);

      // Assert delivery effect in Firestore
      const effectId = derivePushDeliveryEffectId(result1.notificationId!, deviceId);
      const effectDoc = await db.collection("notificationDeliveries").doc(effectId).get();
      expect(effectDoc.exists).toBe(true);
      const effectData = effectDoc.data();
      expect(effectData?.status).toBe("accepted");
      expect(effectData?.attemptCount).toBe(1);
      expect(effectData?.maxAttempts).toBe(3);
      expect(effectData?.providerTicketId).toBe("ticket-r07-default");
      // Security invariant: raw token NEVER stored in effect document
      expect(JSON.stringify(effectData)).not.toContain(token);

      // Provider was called with correct message
      expect(provider.messages).toHaveLength(1);
      expect(provider.messages[0][0].to).toBe(token);
      expect(provider.messages[0][0].title).toBe(EXPO_VISIBLE_NOTIFICATION.title);

      // Retry/Replay invocation (Idempotency test)
      const result2 = await s.handleBookingUpdate(bookingId, before, after);
      expect(result2.processed).toBe(true);
      expect(result2.claimedDeliveries).toBe(0);
      expect(result2.pushSuppressionReason).toBe("event_replay");

      // Verify no extra provider messages were sent
      expect(provider.messages).toHaveLength(1);

      // Verify only one canonical notification exists
      const notifCount = await db.collection("notifications").get();
      expect(notifCount.size).toBe(1);

      // Verify only one delivery effect exists
      const effectCount = await db.collection("notificationDeliveries").get();
      expect(effectCount.size).toBe(1);
    },
  );

  it("proves duplicate lifecycle transition invocations never create duplicate notifications or deliveries", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    const provider = new TestPushProvider();
    const s = makeService(provider);
    const { before, after } = createLifecycleTransition("booking.accepted");

    // Execute 5 sequential invocations representing retries or duplicate trigger deliveries
    for (let i = 0; i < 5; i++) {
      const res = await s.handleBookingUpdate(bookingId, before, after);
      expect(res.processed).toBe(true);
      if (i === 0) {
        expect(res.claimedDeliveries).toBe(1);
      } else {
        expect(res.claimedDeliveries).toBe(0);
        expect(res.pushSuppressionReason).toBe("event_replay");
      }
    }

    const notifs = await db.collection("notifications").get();
    expect(notifs.size).toBe(1);
    const deliveries = await db.collection("notificationDeliveries").get();
    expect(deliveries.size).toBe(1);
    expect(provider.messages).toHaveLength(1);
  });
});

describe("R07 — Concurrency & Processor Race Hardening", () => {
  it("serializes concurrent claimDelivery races on the same delivery intent so exactly one processor sends", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    const provider = new TestPushProvider();
    const s1 = makeService(provider);
    const s2 = makeService(provider);
    const { before, after } = createLifecycleTransition("booking.accepted");

    // Concurrently trigger handleBookingUpdate from two competing processors
    const [res1, res2] = await Promise.all([
      s1.handleBookingUpdate(bookingId, before, after),
      s2.handleBookingUpdate(bookingId, before, after),
    ]);

    // Exactly one claimed the delivery and sent
    const claims = [res1.claimedDeliveries, res2.claimedDeliveries];
    expect(claims.sort()).toEqual([0, 1]);

    // Firestore reflects exactly 1 notification and 1 delivery record
    const notifs = await db.collection("notifications").get();
    expect(notifs.size).toBe(1);
    const deliveries = await db.collection("notificationDeliveries").get();
    expect(deliveries.size).toBe(1);
    expect(deliveries.docs[0].data().status).toBe("accepted");

    // Exactly one provider send batch occurred
    expect(provider.messages).toHaveLength(1);
  });

  it("serializes concurrent retryDelivery on the same failed delivery intent so only one retry claim succeeds", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    // First, cause an initial send failure to create a failed delivery record
    const failingProvider = new TestPushProvider([], new Error("Network timeout"));
    const sFailing = makeService(failingProvider);
    const { before, after } = createLifecycleTransition("package.picked_up");

    const initResult = await sFailing.handleBookingUpdate(bookingId, before, after);
    expect(initResult.claimedDeliveries).toBe(1);

    const effectId = derivePushDeliveryEffectId(initResult.notificationId!, deviceSender);
    const effectBeforeRetry = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectBeforeRetry.data()?.status).toBe("temporary_failure");
    expect(effectBeforeRetry.data()?.attemptCount).toBe(1);

    // Now, simulate two concurrent retry processors racing to retry the delivery effect
    const successProvider = new TestPushProvider();
    const sRetry1 = makeService(successProvider);
    const sRetry2 = makeService(successProvider);

    const [retry1, retry2] = await Promise.all([
      sRetry1.retryDelivery(effectId),
      sRetry2.retryDelivery(effectId),
    ]);

    // Exactly one processor claimed and dispatched the retry (outcomeCode is ticket_accepted)
    const dispatched = [retry1, retry2].filter((r) => r.outcomeCode === "ticket_accepted");
    expect(dispatched).toHaveLength(1);

    // The other processor observed the in-progress lease or already-terminal state
    const suppressed = [retry1, retry2].filter(
      (r) => r.outcomeCode === "in_progress" || r.outcomeCode === "already_terminal",
    );
    expect(suppressed).toHaveLength(1);

    // Check final delivery status in Firestore emulator
    const effectAfterRetry = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectAfterRetry.data()?.status).toBe("accepted");
    expect(effectAfterRetry.data()?.attemptCount).toBe(2);

    // Only one retry send was dispatched to provider
    expect(successProvider.messages).toHaveLength(1);
  });
});

describe("R07 — Automatic Retry Execution & Expired Lease Recovery", () => {
  it("automatically queries and retries eligible temporary_failure deliveries via processRetryableDeliveries", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    // Create an initial failed delivery
    const failingProvider = new TestPushProvider([], new Error("Transient 503"));
    const sFailing = makeService(failingProvider);
    const { before, after } = createLifecycleTransition("package.delivered");

    const initResult = await sFailing.handleBookingUpdate(bookingId, before, after);
    const effectId = derivePushDeliveryEffectId(initResult.notificationId!, deviceSender);

    const effectSnap = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectSnap.data()?.status).toBe("temporary_failure");
    expect(effectSnap.data()?.attemptCount).toBe(1);

    // Run the automated retry processor with a succeeding provider
    const workingProvider = new TestPushProvider();
    const sWorker = makeService(workingProvider);

    const summary = await sWorker.processRetryableDeliveries(10);
    expect(summary.processed).toBe(1);
    expect(summary.retried).toBe(1);

    const effectAfterWorker = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectAfterWorker.data()?.status).toBe("accepted");
    expect(effectAfterWorker.data()?.attemptCount).toBe(2);
    expect(workingProvider.messages).toHaveLength(1);
  });

  it("recovers an expired claimed lease after 5 minutes, while skipping active leases", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    const effectId = "delivery_test_lease_recovery";
    const timestampPast = admin.firestore.Timestamp.fromDate(new Date("2026-07-01T11:50:00.000Z")); // 15 mins ago

    // Seed a canonical notification first
    await db.collection("notifications").doc("notif-lease-test").set({
      userId: senderId,
      title: "Booking accepted",
      body: "The booking was accepted.",
      type: "booking.accepted",
      relatedEntityType: "booking",
      relatedId: bookingId,
      status: "unread",
      readAt: null,
      createdAt: timestampPast,
      updatedAt: timestampPast,
    });

    // Seed an expired claimed delivery intent
    await db.collection("notificationDeliveries").doc(effectId).set({
      notificationId: "notif-lease-test",
      bookingId,
      recipientId: senderId,
      registrationId: deviceSender,
      registrationVersion: 1,
      provider: "expo",
      platform: "android",
      status: "claimed",
      outcomeCode: null,
      providerTicketId: null,
      attemptCount: 1,
      maxAttempts: 3,
      createdAt: timestampPast,
      updatedAt: timestampPast,
    });

    // Run retry with service clock at 12:05:00 (15 minutes elapsed -> lease is expired)
    const successProvider = new TestPushProvider();
    const s = makeService(successProvider, new Date("2026-07-01T12:05:00.000Z"));

    const result = await s.retryDelivery(effectId);
    expect(result.status).toBe("accepted");
    expect(result.outcomeCode).toBe("ticket_accepted");

    const recoveredDoc = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(recoveredDoc.data()?.status).toBe("accepted");
    expect(recoveredDoc.data()?.attemptCount).toBe(2);
    expect(successProvider.messages).toHaveLength(1);
  });

  it("respects active claimed leases within 5 minutes and skips recovery", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    const effectId = "delivery_test_active_lease";
    const timestampRecent = admin.firestore.Timestamp.fromDate(new Date("2026-07-01T12:03:00.000Z")); // 2 mins ago

    await db.collection("notificationDeliveries").doc(effectId).set({
      notificationId: "notif-active-lease",
      bookingId,
      recipientId: senderId,
      registrationId: deviceSender,
      registrationVersion: 1,
      provider: "expo",
      platform: "android",
      status: "claimed",
      outcomeCode: null,
      providerTicketId: null,
      attemptCount: 1,
      maxAttempts: 3,
      createdAt: timestampRecent,
      updatedAt: timestampRecent,
    });

    const provider = new TestPushProvider();
    const s = makeService(provider, new Date("2026-07-01T12:05:00.000Z")); // only 2 min elapsed

    const result = await s.retryDelivery(effectId);
    expect(result.status).toBe("claimed");
    expect(result.outcomeCode).toBe("in_progress");

    // Provider was NOT invoked because active lease protects the in-flight send
    expect(provider.messages).toHaveLength(0);
  });
});

describe("R07 — Business-to-Intent Durability & Reconciliation", () => {
  it("reconciles missing notifications for committed booking lifecycle states when triggers are delayed or dropped", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    // Simulate a booking that committed all lifecycle transitions, but where triggers dropped or never ran
    const hPending = historyEntry("pending", senderId, "2026-07-01T12:00:00.000Z");
    const hAccepted = historyEntry("accepted", travelerId, "2026-07-01T12:01:00.000Z");
    const hInTransit = historyEntry("in_transit", travelerId, "2026-07-01T12:02:00.000Z");
    const hDelivered = historyEntry("delivered", travelerId, "2026-07-01T12:03:00.000Z");

    const committedBooking = {
      bookingRequestId: "request-r07-test",
      shipmentId: "shipment-r07-test",
      tripId: "trip-r07-test",
      senderId,
      travelerId,
      status: "delivered",
      statusHistory: [hPending, hAccepted, hInTransit, hDelivered],
      createdAt: hPending.changedAt,
      updatedAt: hDelivered.changedAt,
    };

    // Save committed business state directly to Firestore
    await db.collection("bookings").doc(bookingId).set(committedBooking);

    // Verify zero notifications exist prior to reconciliation
    const beforeCount = await db.collection("notifications").get();
    expect(beforeCount.empty).toBe(true);

    // Run reconciliation
    const s = makeService();
    const report1 = await s.reconcileBookingLifecycleNotifications(bookingId);

    // 4 transitions scanned: initial booking.requested, pending->accepted, accepted->in_transit, in_transit->delivered
    expect(report1.scanned).toBe(4);
    expect(report1.recovered).toBe(4);
    expect(report1.alreadyExisted).toBe(0);

    // Verify all 4 canonical notifications were created in Firestore
    const notifs = await db.collection("notifications").get();
    expect(notifs.size).toBe(4);
    const types = notifs.docs.map((d) => d.data().type).sort();
    expect(types).toEqual(["booking.accepted", "booking.requested", "package.delivered", "package.picked_up"]);

    // Second reconciliation run is strictly idempotent: 0 recovered, 4 alreadyExisted
    const report2 = await s.reconcileBookingLifecycleNotifications(bookingId);
    expect(report2.scanned).toBe(4);
    expect(report2.recovered).toBe(0);
    expect(report2.alreadyExisted).toBe(4);
    expect((await db.collection("notifications").get()).size).toBe(4);
  });
});

describe("R07 — Provider Timeout Ambiguity & External Transport Semantics", () => {
  it("proves provider timeout records temporary_failure without corrupting or duplicating logical records", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    // Simulate provider HTTP client timeout (e.g. AbortError)
    const timeoutProvider: PushProvider = {
      async send() {
        return [{
          status: "temporary_failure",
          outcomeCode: "network_timeout",
          providerTicketId: null,
        }];
      },
    };

    const s = makeService(timeoutProvider);
    const { before, after } = createLifecycleTransition("booking.accepted");

    const result = await s.handleBookingUpdate(bookingId, before, after);
    expect(result.processed).toBe(true);

    // Canonical notification document uniquely created
    const notifCount = await db.collection("notifications").get();
    expect(notifCount.size).toBe(1);

    // Delivery effect recorded as temporary_failure
    const effectId = derivePushDeliveryEffectId(result.notificationId!, deviceSender);
    const effectDoc = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectDoc.data()?.status).toBe("temporary_failure");
    expect(effectDoc.data()?.outcomeCode).toBe("network_timeout");

    // Retry invocation on ambiguous timeout
    const successProvider = new TestPushProvider();
    const sRetry = makeService(successProvider);

    const retryResult = await sRetry.retryDelivery(effectId);
    expect(retryResult.status).toBe("accepted");

    // Exactly 1 notification and 1 delivery document persist at rest
    expect((await db.collection("notifications").get()).size).toBe(1);
    expect((await db.collection("notificationDeliveries").get()).size).toBe(1);
  });
});

describe("R07 — Push Token Hygiene & Deduplication", () => {
  it("deduplicates identical push tokens across multiple registered devices so only one push is dispatched", async () => {
    await seedUserPreferences(senderId);
    const device1 = "karri-aaaaaaaaaaaaaaaa";
    const device2 = "karri-cccccccccccccccc";
    const sharedToken = "ExpoPushToken[SHARED_TOKEN_BETWEEN_DEVICES]";

    // Register two devices with identical push tokens
    await seedDeviceRegistration(senderId, device1, sharedToken);
    await seedDeviceRegistration(senderId, device2, sharedToken);

    const provider = new TestPushProvider();
    const s = makeService(provider);
    const { before, after } = createLifecycleTransition("booking.accepted");

    const result = await s.handleBookingUpdate(bookingId, before, after);
    expect(result.processed).toBe(true);

    // Only 1 unique message dispatched to provider
    expect(provider.messages).toHaveLength(1);
    expect(provider.messages[0]).toHaveLength(1);
    expect(provider.messages[0][0].to).toBe(sharedToken);
  });

  it("proves transient provider errors do NOT deactivate valid push tokens", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    const failingProvider = new TestPushProvider([], new Error("500 Server Error"));
    const s = makeService(failingProvider);
    const { before, after } = createLifecycleTransition("booking.accepted");

    await s.handleBookingUpdate(bookingId, before, after);

    // Device registration remains fully active
    const regDoc = await db.collection("pushTokenRegistrations")
      .doc(senderId)
      .collection("devices")
      .doc(deviceSender)
      .get();
    expect(regDoc.data()?.active).toBe(true);
    expect(regDoc.data()?.token).toBe(tokenSender);
  });
});

describe("R07 — Failure Atomicity, Safe Deactivation, and Bounded Retries", () => {
  it("proves business transaction failure leaves zero notification intent in Firestore", async () => {
    const bookingRef = db.collection("bookings").doc("booking-failed-tx");
    await bookingRef.set(createBooking("pending", [historyEntry("pending", senderId)]));

    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(bookingRef);
        transaction.update(bookingRef, {
          status: "accepted",
          statusHistory: [...snap.data()!.statusHistory, historyEntry("accepted", travelerId)],
        });
        throw new Error("Simulated business validation abort");
      });
    } catch {
      // Expected rollback
    }

    const bookingSnap = await bookingRef.get();
    expect(bookingSnap.data()?.status).toBe("pending");

    const notifs = await db.collection("notifications").where("relatedId", "==", "booking-failed-tx").get();
    expect(notifs.empty).toBe(true);
    const deliveries = await db.collection("notificationDeliveries").where("bookingId", "==", "booking-failed-tx").get();
    expect(deliveries.empty).toBe(true);
  });

  it("proves external push provider failure leaves business state intact and records retryable failure", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    const bookingRef = db.collection("bookings").doc(bookingId);
    const { before, after } = createLifecycleTransition("package.delivered");
    await bookingRef.set(after);

    const provider = new TestPushProvider([], new Error("Expo 503 Service Unavailable"));
    const s = makeService(provider);

    const result = await s.handleBookingUpdate(bookingId, before, after);
    expect(result.processed).toBe(true);

    const bookingSnap = await bookingRef.get();
    expect(bookingSnap.data()?.status).toBe("delivered");

    const notifSnap = await db.collection("notifications").doc(result.notificationId!).get();
    expect(notifSnap.exists).toBe(true);

    const effectId = derivePushDeliveryEffectId(result.notificationId!, deviceSender);
    const effectSnap = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectSnap.data()?.status).toBe("temporary_failure");
    expect(effectSnap.data()?.attemptCount).toBe(1);
    expect(effectSnap.data()?.maxAttempts).toBe(3);
  });

  it("proves retries beyond maxAttempts (3) transition to permanent_failure with attempts_exhausted", async () => {
    await seedUserPreferences(senderId);
    await seedDeviceRegistration(senderId, deviceSender, tokenSender);

    const failingProvider = new TestPushProvider([], new Error("Persistent network failure"));
    const s = makeService(failingProvider);
    const { before, after } = createLifecycleTransition("booking.accepted");

    // Initial attempt (attempt 1)
    const initRes = await s.handleBookingUpdate(bookingId, before, after);
    const effectId = derivePushDeliveryEffectId(initRes.notificationId!, deviceSender);

    let effectDoc = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectDoc.data()?.attemptCount).toBe(1);
    expect(effectDoc.data()?.status).toBe("temporary_failure");

    // Second attempt (attempt 2)
    const retry1 = await s.retryDelivery(effectId);
    expect(retry1.status).toBe("temporary_failure");
    expect(retry1.outcomeCode).toBe("provider_boundary_failure");
    effectDoc = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectDoc.data()?.attemptCount).toBe(2);
    expect(effectDoc.data()?.status).toBe("temporary_failure");

    // Third attempt (attempt 3)
    const retry2 = await s.retryDelivery(effectId);
    expect(retry2.status).toBe("permanent_failure");
    expect(retry2.outcomeCode).toBe("attempts_exhausted");
    effectDoc = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectDoc.data()?.attemptCount).toBe(3);
    expect(effectDoc.data()?.status).toBe("permanent_failure");

    // Fourth attempt: attemptCount is now 3 (>= maxAttempts 3) -> should remain permanent_failure
    const retry3 = await s.retryDelivery(effectId);
    expect(retry3.status).toBe("permanent_failure");
    expect(retry3.outcomeCode).toBe("attempts_exhausted");

    effectDoc = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectDoc.data()?.status).toBe("permanent_failure");
    expect(effectDoc.data()?.outcomeCode).toBe("attempts_exhausted");
  });

  it("proves permanent token error (DeviceNotRegistered) deactivates token safely without rolling back business state", async () => {
    await seedUserPreferences(travelerId);
    await seedDeviceRegistration(travelerId, deviceTraveler, tokenTraveler);

    const bookingRef = db.collection("bookings").doc(bookingId);
    const { before, after } = createLifecycleTransition("shipment.completed");
    await bookingRef.set(after);

    const invalidProvider = new TestPushProvider([{
      status: "invalid_registration",
      outcomeCode: "device_not_registered",
      providerTicketId: null,
    }]);
    const s = makeService(invalidProvider);

    const res = await s.handleBookingUpdate(bookingId, before, after);
    expect(res.processed).toBe(true);

    const bookingSnap = await bookingRef.get();
    expect(bookingSnap.data()?.status).toBe("completed");

    const notifDoc = await db.collection("notifications").doc(res.notificationId!).get();
    expect(notifDoc.exists).toBe(true);

    const effectId = derivePushDeliveryEffectId(res.notificationId!, deviceTraveler);
    const effectDoc = await db.collection("notificationDeliveries").doc(effectId).get();
    expect(effectDoc.data()?.status).toBe("invalid_registration");

    const regDoc = await db.collection("pushTokenRegistrations")
      .doc(travelerId)
      .collection("devices")
      .doc(deviceTraveler)
      .get();
    expect(regDoc.data()?.active).toBe(false);
    expect(regDoc.data()?.token).toBeUndefined();
    expect(regDoc.data()?.revokedAt).toBeInstanceOf(admin.firestore.Timestamp);
  });

  describe("booking.requested lifecycle authority", () => {
    it("processes lifecycle event booking.requested: creates canonical record, routes to intended traveler, delivers push idempotently", async () => {
      await seedUserPreferences(travelerId);
      await seedDeviceRegistration(travelerId, deviceTraveler, tokenTraveler);

      const bookingData = createBooking("pending", [
        historyEntry("pending", senderId, "2026-07-01T12:00:00.000Z"),
      ]);
      await db.collection("bookings").doc(bookingId).set(bookingData);

      const provider = new TestPushProvider();
      const s = makeService(provider);

      const res = await s.handleBookingCreated(bookingId, bookingData);
      expect(res.processed).toBe(true);
      expect(res.canonicalCreated).toBe(true);
      expect(res.claimedDeliveries).toBe(1);

      // Verify canonical notification
      const notifDoc = await db.collection("notifications").doc(res.notificationId!).get();
      expect(notifDoc.exists).toBe(true);
      expect(notifDoc.data()?.userId).toBe(travelerId);
      expect(notifDoc.data()?.type).toBe("booking.requested");
      expect(notifDoc.data()?.title).toBe(LIFECYCLE_NOTIFICATIONS["booking.requested"].title);
      expect(notifDoc.data()?.body).toBe(LIFECYCLE_NOTIFICATIONS["booking.requested"].body);
      expect(notifDoc.data()?.relatedId).toBe(bookingId);

      // Verify push delivery record
      const effectId = derivePushDeliveryEffectId(res.notificationId!, deviceTraveler);
      const effectDoc = await db.collection("notificationDeliveries").doc(effectId).get();
      expect(effectDoc.exists).toBe(true);
      expect(effectDoc.data()?.status).toBe("accepted");
      expect(effectDoc.data()?.recipientId).toBe(travelerId);

      // Verify replay idempotency
      const replayRes = await s.handleBookingCreated(bookingId, bookingData);
      expect(replayRes.processed).toBe(true);
      expect(replayRes.canonicalCreated).toBe(false);
      expect(replayRes.pushSuppressionReason).toBe("event_replay");

      // Verify delivery count did not duplicate
      const allDeliveries = await db.collection("notificationDeliveries")
        .where("notificationId", "==", res.notificationId)
        .get();
      expect(allDeliveries.size).toBe(1);
    });

    it("rejects booking.requested if booking request is invalid or forged", async () => {
      const s = makeService(new TestPushProvider());

      // 1. Non-pending status
      const nonPending = createBooking("accepted", [
        historyEntry("accepted", travelerId, "2026-07-01T12:00:00.000Z"),
      ]);
      const res1 = await s.handleBookingCreated(bookingId, nonPending);
      expect(res1.processed).toBe(false);

      // 2. Sender and traveler are the same user
      const selfBooking = {
        ...createBooking("pending", [
          historyEntry("pending", senderId, "2026-07-01T12:00:00.000Z"),
        ]),
        senderId,
        travelerId: senderId,
      };
      await expect(s.handleBookingCreated(bookingId, selfBooking)).rejects.toThrow(
        "Invalid booking request document.",
      );
    });
  });

  describe("booking.cancelled lifecycle authority", () => {
    it("processes lifecycle event booking.cancelled: creates canonical record, routes to traveler, delivers push idempotently", async () => {
      await seedUserPreferences(travelerId);
      await seedDeviceRegistration(travelerId, deviceTraveler, tokenTraveler);

      const { before, after } = createLifecycleTransition("booking.cancelled");
      await db.collection("bookings").doc(bookingId).set(after);

      const provider = new TestPushProvider();
      const s = makeService(provider);

      const res = await s.handleBookingUpdate(bookingId, before, after);
      expect(res.processed).toBe(true);
      expect(res.canonicalCreated).toBe(true);
      expect(res.claimedDeliveries).toBe(1);

      // Verify canonical record
      const notifDoc = await db.collection("notifications").doc(res.notificationId!).get();
      expect(notifDoc.exists).toBe(true);
      expect(notifDoc.data()?.userId).toBe(travelerId);
      expect(notifDoc.data()?.type).toBe("booking.cancelled");
      expect(notifDoc.data()?.title).toBe(LIFECYCLE_NOTIFICATIONS["booking.cancelled"].title);
      expect(notifDoc.data()?.body).toBe(LIFECYCLE_NOTIFICATIONS["booking.cancelled"].body);
      expect(notifDoc.data()?.relatedId).toBe(bookingId);

      // Verify replay idempotency
      const replayRes = await s.handleBookingUpdate(bookingId, before, after);
      expect(replayRes.processed).toBe(true);
      expect(replayRes.canonicalCreated).toBe(false);
      expect(replayRes.pushSuppressionReason).toBe("event_replay");
    });

    it("rejects booking.cancelled if the actor is not the booking sender", async () => {
      const s = makeService(new TestPushProvider());
      const { before, after } = createLifecycleTransition("booking.cancelled");

      // Forged actor: traveler attempting to cancel sender's booking
      const forgedAfter = {
        ...after,
        statusHistory: [
          before.statusHistory[0],
          historyEntry("cancelled", travelerId, "2026-07-01T12:01:00.000Z"),
        ],
      };

      await expect(s.handleBookingUpdate(bookingId, before, forgedAfter)).rejects.toThrow(
        "Invalid booking lifecycle transition.",
      );
    });
  });

  describe("Automatic retry worker execution", () => {
    it("discovers temporary_failure deliveries, claims them atomically, and successfully retries them", async () => {
      await seedUserPreferences(senderId);
      await seedDeviceRegistration(senderId, deviceSender, tokenSender);

      // Create initial temporary_failure
      const failingProvider = new TestPushProvider([], new Error("Temporary network error"));
      const initialService = makeService(failingProvider);
      const { before, after } = createLifecycleTransition("booking.accepted");
      const initRes = await initialService.handleBookingUpdate(bookingId, before, after);
      const effectId = derivePushDeliveryEffectId(initRes.notificationId!, deviceSender);

      const beforeRetry = await db.collection("notificationDeliveries").doc(effectId).get();
      expect(beforeRetry.data()?.status).toBe("temporary_failure");
      expect(beforeRetry.data()?.attemptCount).toBe(1);

      // Now run retry worker with working provider
      const workingProvider = new TestPushProvider([{
        status: "accepted",
        outcomeCode: "ticket_accepted",
        providerTicketId: "ticket-retry-success",
      }]);
      const retryWorkerService = makeService(workingProvider);

      const batchResult = await retryWorkerService.processRetryableDeliveries(10);
      expect(batchResult.processed).toBe(1);
      expect(batchResult.retried).toBe(1);

      const afterRetry = await db.collection("notificationDeliveries").doc(effectId).get();
      expect(afterRetry.data()?.status).toBe("accepted");
      expect(afterRetry.data()?.attemptCount).toBe(2);
      expect(afterRetry.data()?.providerTicketId).toBe("ticket-retry-success");
    });

    it("recovers expired claimed leases (> 5 min) and retries delivery once", async () => {
      await seedUserPreferences(senderId);
      await seedDeviceRegistration(senderId, deviceSender, tokenSender);

      const notificationId = deriveLifecycleNotificationId("booking.accepted", bookingId, senderId);
      const effectId = derivePushDeliveryEffectId(notificationId, deviceSender);

      // Seed a stalled delivery claimed 15 minutes before 12:05
      const fifteenMinutesAgo = admin.firestore.Timestamp.fromDate(
        new Date("2026-07-01T11:50:00.000Z"),
      );
      await db.collection("notificationDeliveries").doc(effectId).set({
        notificationId,
        bookingId,
        recipientId: senderId,
        registrationId: deviceSender,
        registrationVersion: 1,
        provider: "expo",
        platform: "android",
        status: "claimed",
        outcomeCode: null,
        providerTicketId: null,
        attemptCount: 1,
        maxAttempts: 3,
        createdAt: fifteenMinutesAgo,
        updatedAt: fifteenMinutesAgo,
      });

      const workingProvider = new TestPushProvider([{
        status: "accepted",
        outcomeCode: "ticket_accepted",
        providerTicketId: "ticket-recovered-lease",
      }]);
      const retryWorkerService = makeService(workingProvider, new Date("2026-07-01T12:05:00.000Z"));

      const batchResult = await retryWorkerService.processRetryableDeliveries(10);
      expect(batchResult.processed).toBe(1);
      expect(batchResult.retried).toBe(1);

      const recoveredDoc = await db.collection("notificationDeliveries").doc(effectId).get();
      expect(recoveredDoc.data()?.status).toBe("accepted");
      expect(recoveredDoc.data()?.attemptCount).toBe(2);
      expect(recoveredDoc.data()?.providerTicketId).toBe("ticket-recovered-lease");
    });

    it("respects active claimed leases (< 5 min) and skips processing to prevent double-processing", async () => {
      await seedUserPreferences(senderId);
      await seedDeviceRegistration(senderId, deviceSender, tokenSender);

      const notificationId = deriveLifecycleNotificationId("booking.accepted", bookingId, senderId);
      const effectId = derivePushDeliveryEffectId(notificationId, deviceSender);

      // Seed an active claimed delivery updated at 12:03 (2 minutes before 12:05)
      const twoMinutesAgo = admin.firestore.Timestamp.fromDate(
        new Date("2026-07-01T12:03:00.000Z"),
      );
      await db.collection("notificationDeliveries").doc(effectId).set({
        notificationId,
        bookingId,
        recipientId: senderId,
        registrationId: deviceSender,
        registrationVersion: 1,
        provider: "expo",
        platform: "android",
        status: "claimed",
        outcomeCode: null,
        providerTicketId: null,
        attemptCount: 1,
        maxAttempts: 3,
        createdAt: twoMinutesAgo,
        updatedAt: twoMinutesAgo,
      });

      const provider = new TestPushProvider();
      const retryWorkerService = makeService(provider, new Date("2026-07-01T12:05:00.000Z"));

      const batchResult = await retryWorkerService.processRetryableDeliveries(10);
      expect(batchResult.processed).toBe(0);
      expect(batchResult.retried).toBe(0);

      const docAfter = await db.collection("notificationDeliveries").doc(effectId).get();
      expect(docAfter.data()?.status).toBe("claimed");
      expect(docAfter.data()?.attemptCount).toBe(1);
      expect(provider.messages.length).toBe(0);
    });

    it("transitions delivery to permanent_failure with attempts_exhausted when attemptCount reaches maxAttempts", async () => {
      await seedUserPreferences(senderId);
      await seedDeviceRegistration(senderId, deviceSender, tokenSender);

      const notificationId = deriveLifecycleNotificationId("booking.accepted", bookingId, senderId);
      const effectId = derivePushDeliveryEffectId(notificationId, deviceSender);

      // Seed delivery at attemptCount = 2 (next attempt will reach maxAttempts 3)
      const twoMinutesAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 120000));
      await db.collection("notificationDeliveries").doc(effectId).set({
        notificationId,
        bookingId,
        recipientId: senderId,
        registrationId: deviceSender,
        registrationVersion: 1,
        provider: "expo",
        platform: "android",
        status: "temporary_failure",
        outcomeCode: "network_error",
        providerTicketId: null,
        attemptCount: 2,
        maxAttempts: 3,
        createdAt: twoMinutesAgo,
        updatedAt: twoMinutesAgo,
      });

      const failingProvider = new TestPushProvider([], new Error("Still failing"));
      const retryWorkerService = makeService(failingProvider);

      const batchResult = await retryWorkerService.processRetryableDeliveries(10);
      expect(batchResult.processed).toBe(1);
      expect(batchResult.permanentFailures).toBe(1);

      const exhaustedDoc = await db.collection("notificationDeliveries").doc(effectId).get();
      expect(exhaustedDoc.data()?.status).toBe("permanent_failure");
      expect(exhaustedDoc.data()?.attemptCount).toBe(3);
      expect(exhaustedDoc.data()?.outcomeCode).toBe("attempts_exhausted");

      // Running worker again ignores the terminal permanent_failure
      const secondRun = await retryWorkerService.processRetryableDeliveries(10);
      expect(secondRun.processed).toBe(0);
    });

    it("serializes concurrent worker executions so exactly one delivery claim wins and only one logical record is created", async () => {
      await seedUserPreferences(senderId);
      await seedDeviceRegistration(senderId, deviceSender, tokenSender);

      const notificationId = deriveLifecycleNotificationId("booking.accepted", bookingId, senderId);
      const effectId = derivePushDeliveryEffectId(notificationId, deviceSender);

      await db.collection("notificationDeliveries").doc(effectId).set({
        notificationId,
        bookingId,
        recipientId: senderId,
        registrationId: deviceSender,
        registrationVersion: 1,
        provider: "expo",
        platform: "android",
        status: "temporary_failure",
        outcomeCode: "network_timeout",
        providerTicketId: null,
        attemptCount: 1,
        maxAttempts: 3,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const providerA = new TestPushProvider([{ status: "accepted", outcomeCode: "ticket_accepted", providerTicketId: "ticket-worker-a" }]);
      const providerB = new TestPushProvider([{ status: "accepted", outcomeCode: "ticket_accepted", providerTicketId: "ticket-worker-b" }]);

      const workerA = makeService(providerA);
      const workerB = makeService(providerB);

      // Race two worker executions simultaneously
      const [resultA, resultB] = await Promise.all([
        workerA.processRetryableDeliveries(10),
        workerB.processRetryableDeliveries(10),
      ]);

      const totalRetried = resultA.retried + resultB.retried;
      expect(totalRetried).toBe(1);

      // Check total provider calls across both workers
      const totalProviderSends = providerA.messages.length + providerB.messages.length;
      expect(totalProviderSends).toBe(1);

      const finalDoc = await db.collection("notificationDeliveries").doc(effectId).get();
      expect(finalDoc.data()?.status).toBe("accepted");
      expect(finalDoc.data()?.attemptCount).toBe(2);
    });
  });
});
