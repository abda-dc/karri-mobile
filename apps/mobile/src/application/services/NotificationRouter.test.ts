import { describe, expect, it } from "vitest";
import {
  NotificationRouter,
  NotificationDestination,
} from "./NotificationRouter";
import { FirebaseNotificationRoutingSource } from "../../infrastructure/firebase/push/FirebaseNotificationRoutingSource";
import {
  NotificationActionType,
  type NotificationAction,
} from "../notifications/NotificationAction";
import { mapNotification } from "../../infrastructure/firebase/mappers/notificationMapper";
import type { DocumentSnapshot, DocumentData } from "firebase/firestore";

describe("NotificationRouter mobile safety & push payload validation", () => {
  const source = new FirebaseNotificationRoutingSource();
  const router = new NotificationRouter(source);

  it("safely rejects malformed push payloads without crashing", () => {
    expect(router.resolvePayload(null)).toBeNull();
    expect(router.resolvePayload(undefined)).toBeNull();
    expect(router.resolvePayload("not-an-object")).toBeNull();
    expect(router.resolvePayload(12345)).toBeNull();
    expect(router.resolvePayload([])).toBeNull();
  });

  it("safely rejects push payloads containing non-allowlisted / private data fields", () => {
    const payloadWithLeak = {
      schemaVersion: 1,
      notificationId: "notif-123",
      action: "open_notifications",
      // Non-allowlisted field (e.g. sensitive internal state or tokens)
      leakedSecret: "sk_live_123456789",
    };
    expect(router.resolvePayload(payloadWithLeak)).toBeNull();
  });

  it("safely rejects push payloads with unsupported or malformed actions", () => {
    const payloadWithBadAction = {
      schemaVersion: 1,
      notificationId: "notif-123",
      action: "unsupported_or_malicious_action",
    };
    expect(router.resolvePayload(payloadWithBadAction)).toBeNull();
  });

  it("safely resolves valid open_notifications action to existing profile destination", () => {
    const validPayload = {
      schemaVersion: 1,
      notificationId: "notif-valid-123",
      action: NotificationActionType.OpenNotifications,
    };
    const route = router.resolvePayload(validPayload);
    expect(route).toEqual({
      destination: NotificationDestination.Profile,
    });
  });

  it("safely resolves open_booking action to tracking destination and bookingId", () => {
    const validBookingPayload = {
      schemaVersion: 1,
      notificationId: "notif-valid-456",
      action: NotificationActionType.OpenBooking,
      bookingId: "booking-abc-123",
    };
    const route = router.resolvePayload(validBookingPayload);
    expect(route).toEqual({
      destination: NotificationDestination.Tracking,
      bookingId: "booking-abc-123",
    });
  });

  it("does not trust push payload for authoritative state and accurately maps canonical Firestore notifications", () => {
    // Push payload contains zero status / state flags. The client navigates to the screen
    // and queries the canonical Firestore backend record.
    const fakeSnapshot = {
      id: "notification-r07-canonical",
      data: () => ({
        userId: "user-sender-1",
        title: "Booking accepted",
        body: "The booking was accepted.",
        type: "booking.accepted",
        relatedEntityType: "booking",
        relatedId: "booking-123",
        status: "unread",
        readAt: null,
        createdAt: { toMillis: () => 1782821100000 },
        updatedAt: { toMillis: () => 1782821100000 },
      }),
    } as unknown as DocumentSnapshot<DocumentData>;

    const domainModel = mapNotification(fakeSnapshot);
    expect(domainModel.id).toBe("notification-r07-canonical");
    expect(domainModel.recipientId).toBe("user-sender-1");
    expect(domainModel.type).toBe("booking.accepted");
    expect(domainModel.relatedEntityId).toBe("booking-123");
    expect(domainModel.status).toBe("unread");
  });
});
