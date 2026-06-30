export const NotificationActionType = {
  OpenBooking: "open_booking",
  OpenHome: "open_home",
  OpenNotifications: "open_notifications",
  OpenProfile: "open_profile",
  OpenTracking: "open_tracking",
} as const;

export type NotificationActionType =
  (typeof NotificationActionType)[keyof typeof NotificationActionType];

const notificationActionEntityIdMaximumLength = 128;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

export function normalizeNotificationActionEntityId(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized &&
    normalized.length <= notificationActionEntityIdMaximumLength &&
    !controlCharacterPattern.test(normalized)
    ? normalized
    : null;
}

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
