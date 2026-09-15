export const LIFECYCLE_NOTIFICATIONS = {
  "booking.requested": {
    title: "Booking requested",
    body: "A booking request needs your attention.",
    type: "booking.requested",
    relatedEntityType: "booking",
    category: "booking_requests",
  },
  "booking.accepted": {
    title: "Booking accepted",
    body: "The booking was accepted.",
    type: "booking.accepted",
    relatedEntityType: "booking",
    category: "booking_updates",
  },
  "booking.declined": {
    title: "Booking declined",
    body: "The booking request was declined.",
    type: "booking.declined",
    relatedEntityType: "booking",
    category: "booking_updates",
  },
  "booking.cancelled": {
    title: "Booking cancelled",
    body: "The booking was cancelled.",
    type: "booking.cancelled",
    relatedEntityType: "booking",
    category: "booking_updates",
  },
  "package.picked_up": {
    title: "Shipment picked up",
    body: "Custody was transferred and the shipment is now in transit.",
    type: "package.picked_up",
    relatedEntityType: "booking",
    category: "custody_updates",
  },
  "package.delivered": {
    title: "Shipment delivered",
    body: "The shipment was marked delivered.",
    type: "package.delivered",
    relatedEntityType: "booking",
    category: "delivery_updates",
  },
  "shipment.completed": {
    title: "Shipment completed",
    body: "The sender completed the shipment journey.",
    type: "shipment.completed",
    relatedEntityType: "booking",
    category: "booking_updates",
  },
} as const;

export type SupportedLifecycleEventType = keyof typeof LIFECYCLE_NOTIFICATIONS;

export const BOOKING_ACCEPTED_NOTIFICATION = LIFECYCLE_NOTIFICATIONS["booking.accepted"];

export const EXPO_VISIBLE_NOTIFICATION = {
  title: "Karri update",
  body: "Open Karri to view your latest activity.",
  channelId: "karri_activity_v1",
} as const;

export type DeliveryStatus =
  | "claimed"
  | "accepted"
  | "invalid_registration"
  | "temporary_failure"
  | "permanent_failure";

export interface ExpoPushMessage {
  readonly to: string;
  readonly title: typeof EXPO_VISIBLE_NOTIFICATION.title;
  readonly body: typeof EXPO_VISIBLE_NOTIFICATION.body;
  readonly data: {
    readonly schemaVersion: 1;
    readonly notificationId: string;
    readonly action: "open_notifications";
  };
  readonly channelId: typeof EXPO_VISIBLE_NOTIFICATION.channelId;
}

export interface PushDeliveryResult {
  readonly status: DeliveryStatus;
  readonly outcomeCode: string;
  readonly providerTicketId: string | null;
}

export interface PushProvider {
  send(messages: ReadonlyArray<ExpoPushMessage>): Promise<ReadonlyArray<PushDeliveryResult>>;
}

export interface BookingUpdateResult {
  readonly processed: boolean;
  readonly notificationId: string | null;
  readonly canonicalCreated: boolean;
  readonly pushSuppressionReason:
    | "not_applicable"
    | "event_replay"
    | "delivery_disabled"
    | "preferences"
    | "quiet_hours"
    | "no_tokens"
    | null;
  readonly claimedDeliveries: number;
}
