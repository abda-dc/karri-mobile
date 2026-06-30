export const NotificationActionType = {
  OpenBooking: "open_booking",
  OpenHome: "open_home",
  OpenNotifications: "open_notifications",
} as const;

export type NotificationActionType =
  (typeof NotificationActionType)[keyof typeof NotificationActionType];

export type NotificationAction =
  | {
      readonly type: typeof NotificationActionType.OpenBooking;
      readonly bookingId: string;
    }
  | {
      readonly type: typeof NotificationActionType.OpenHome;
    }
  | {
      readonly type: typeof NotificationActionType.OpenNotifications;
    };
