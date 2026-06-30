export const NotificationActionType = {
  OpenBooking: "open_booking",
  OpenHome: "open_home",
  OpenNotifications: "open_notifications",
  OpenProfile: "open_profile",
  OpenTracking: "open_tracking",
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
    }
  | {
      readonly type: typeof NotificationActionType.OpenProfile;
    }
  | {
      readonly bookingId?: string;
      readonly type: typeof NotificationActionType.OpenTracking;
    };
