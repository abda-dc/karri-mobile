export const BOOKING_ACCEPTED_NOTIFICATION = {
  title: "Booking accepted",
  body: "The booking was accepted.",
  type: "booking.accepted",
  relatedEntityType: "booking",
} as const;

export const EXPO_VISIBLE_NOTIFICATION = {
  title: "Karri update",
  body: "Open Karri to view your latest activity.",
  channelId: "karri_activity_v1",
} as const;

export type DeliveryStatus =
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
