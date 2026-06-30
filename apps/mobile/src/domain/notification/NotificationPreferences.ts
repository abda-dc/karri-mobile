import type { DomainEntity } from "../shared/Entity";

export const NotificationChannel = {
  Email: "email",
  Push: "push",
  Sms: "sms",
} as const;

export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationPreferenceCategory = {
  BookingRequests: "booking_requests",
  BookingUpdates: "booking_updates",
  CustodyUpdates: "custody_updates",
  DeliveryUpdates: "delivery_updates",
  GeneralAnnouncements: "general_announcements",
  ReviewReminders: "review_reminders",
  TrustProfileAlerts: "trust_profile_alerts",
} as const;

export type NotificationPreferenceCategory =
  (typeof NotificationPreferenceCategory)[keyof typeof NotificationPreferenceCategory];

export interface QuietHours {
  readonly endLocalTime: string;
  readonly startLocalTime: string;
  readonly timeZone: string;
}

export interface NotificationPreferences extends DomainEntity {
  readonly categories: Readonly<Record<NotificationPreferenceCategory, boolean>>;
  readonly channels: Readonly<Record<NotificationChannel, boolean>>;
  readonly quietHours: QuietHours | null;
  readonly userId: string;
}

export class InvalidNotificationPreferencesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNotificationPreferencesError";
  }
}

const notificationChannels = Object.values(NotificationChannel);
const notificationCategories = Object.values(NotificationPreferenceCategory);
const localTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function createDefaultNotificationPreferences(
  userId: string,
  occurredAt: string,
): NotificationPreferences {
  const preferences: NotificationPreferences = {
    id: userId,
    userId,
    channels: {
      [NotificationChannel.Email]: false,
      [NotificationChannel.Push]: false,
      [NotificationChannel.Sms]: false,
    },
    categories: {
      [NotificationPreferenceCategory.BookingRequests]: true,
      [NotificationPreferenceCategory.BookingUpdates]: true,
      [NotificationPreferenceCategory.CustodyUpdates]: true,
      [NotificationPreferenceCategory.DeliveryUpdates]: true,
      [NotificationPreferenceCategory.GeneralAnnouncements]: true,
      [NotificationPreferenceCategory.ReviewReminders]: true,
      [NotificationPreferenceCategory.TrustProfileAlerts]: true,
    },
    quietHours: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };

  assertNotificationPreferences(preferences);
  return preferences;
}

export function assertNotificationPreferences(
  preferences: NotificationPreferences,
): void {
  if (
    !preferences.userId.trim() ||
    preferences.userId !== preferences.userId.trim() ||
    preferences.id !== preferences.userId
  ) {
    throw new InvalidNotificationPreferencesError(
      "Notification preferences must belong to one valid user.",
    );
  }

  if (Object.keys(preferences.channels).length !== notificationChannels.length) {
    throw new InvalidNotificationPreferencesError(
      "Notification preferences contain an unsupported channel.",
    );
  }

  for (const channel of notificationChannels) {
    if (typeof preferences.channels[channel] !== "boolean") {
      throw new InvalidNotificationPreferencesError(
        `Notification channel ${channel} must be enabled or disabled.`,
      );
    }
  }

  if (Object.keys(preferences.categories).length !== notificationCategories.length) {
    throw new InvalidNotificationPreferencesError(
      "Notification preferences contain an unsupported category.",
    );
  }

  if (
    preferences.channels[NotificationChannel.Email] ||
    preferences.channels[NotificationChannel.Sms]
  ) {
    throw new InvalidNotificationPreferencesError(
      "Email and SMS notification channels are placeholders and cannot be enabled yet.",
    );
  }

  for (const category of notificationCategories) {
    if (typeof preferences.categories[category] !== "boolean") {
      throw new InvalidNotificationPreferencesError(
        `Notification category ${category} must be enabled or disabled.`,
      );
    }
  }

  if (preferences.quietHours) {
    normalizeQuietHours(preferences.quietHours);
  }
}

export function setNotificationChannel(
  preferences: NotificationPreferences,
  channel: NotificationChannel,
  enabled: boolean,
  occurredAt: string,
): NotificationPreferences {
  const next: NotificationPreferences = {
    ...preferences,
    channels: {
      ...preferences.channels,
      [channel]: enabled,
    },
    updatedAt: occurredAt,
  };
  assertNotificationPreferences(next);
  return next;
}

export function setNotificationQuietHours(
  preferences: NotificationPreferences,
  quietHours: QuietHours | null,
  occurredAt: string,
): NotificationPreferences {
  const next: NotificationPreferences = {
    ...preferences,
    quietHours: quietHours ? normalizeQuietHours(quietHours) : null,
    updatedAt: occurredAt,
  };
  assertNotificationPreferences(next);
  return next;
}

export function touchNotificationPreferences(
  preferences: NotificationPreferences,
  occurredAt: string,
): NotificationPreferences {
  const next = {
    ...preferences,
    quietHours: preferences.quietHours
      ? normalizeQuietHours(preferences.quietHours)
      : null,
    updatedAt: occurredAt,
  };
  assertNotificationPreferences(next);
  return next;
}

function normalizeQuietHours(quietHours: QuietHours): QuietHours {
  const timeZone = quietHours.timeZone.trim();
  if (!localTimePattern.test(quietHours.startLocalTime)) {
    throw new InvalidNotificationPreferencesError(
      "Quiet hours start time must use 24-hour HH:mm format.",
    );
  }
  if (!localTimePattern.test(quietHours.endLocalTime)) {
    throw new InvalidNotificationPreferencesError(
      "Quiet hours end time must use 24-hour HH:mm format.",
    );
  }
  if (quietHours.startLocalTime === quietHours.endLocalTime) {
    throw new InvalidNotificationPreferencesError(
      "Quiet hours start and end times must be different.",
    );
  }
  if (
    !timeZone ||
    timeZone.length > 100 ||
    !isSupportedTimeZone(timeZone)
  ) {
    throw new InvalidNotificationPreferencesError(
      "Quiet hours require a valid time zone.",
    );
  }

  return {
    endLocalTime: quietHours.endLocalTime,
    startLocalTime: quietHours.startLocalTime,
    timeZone,
  };
}
