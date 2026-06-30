import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import {
  NotificationChannel,
  NotificationPreferenceCategory,
  type NotificationPreferences,
  type QuietHours,
} from "../../../domain/notification/NotificationPreferences";
import {
  recordValue,
  snapshotData,
  stringValue,
  toDomainTimestamp,
} from "./firestoreValues";

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function mapQuietHours(value: unknown): QuietHours | null {
  const quietHours = recordValue(value);
  const startLocalTime = stringValue(quietHours.startLocalTime);
  const endLocalTime = stringValue(quietHours.endLocalTime);
  const timeZone = stringValue(quietHours.timeZone);

  return startLocalTime && endLocalTime && timeZone
    ? { startLocalTime, endLocalTime, timeZone }
    : null;
}

export function mapNotificationPreferences(
  snapshot: DocumentSnapshot<DocumentData>,
): NotificationPreferences {
  const data = snapshotData(snapshot);
  const channels = recordValue(data.channels);
  const categories = recordValue(data.categories);

  return {
    id: snapshot.id,
    userId: stringValue(data.userId, snapshot.id),
    channels: {
      [NotificationChannel.Email]: booleanValue(
        channels[NotificationChannel.Email],
        false,
      ),
      [NotificationChannel.Push]: booleanValue(
        channels[NotificationChannel.Push],
        false,
      ),
      [NotificationChannel.Sms]: booleanValue(
        channels[NotificationChannel.Sms],
        false,
      ),
    },
    categories: {
      [NotificationPreferenceCategory.BookingRequests]: booleanValue(
        categories[NotificationPreferenceCategory.BookingRequests],
        true,
      ),
      [NotificationPreferenceCategory.BookingUpdates]: booleanValue(
        categories[NotificationPreferenceCategory.BookingUpdates],
        true,
      ),
      [NotificationPreferenceCategory.CustodyUpdates]: booleanValue(
        categories[NotificationPreferenceCategory.CustodyUpdates],
        true,
      ),
      [NotificationPreferenceCategory.DeliveryUpdates]: booleanValue(
        categories[NotificationPreferenceCategory.DeliveryUpdates],
        true,
      ),
      [NotificationPreferenceCategory.GeneralAnnouncements]: booleanValue(
        categories[NotificationPreferenceCategory.GeneralAnnouncements],
        true,
      ),
      [NotificationPreferenceCategory.ReviewReminders]: booleanValue(
        categories[NotificationPreferenceCategory.ReviewReminders],
        true,
      ),
      [NotificationPreferenceCategory.TrustProfileAlerts]: booleanValue(
        categories[NotificationPreferenceCategory.TrustProfileAlerts],
        true,
      ),
    },
    quietHours: data.quietHours ? mapQuietHours(data.quietHours) : null,
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreNotificationPreferences(
  preferences: NotificationPreferences,
): DocumentData {
  return {
    userId: preferences.userId,
    channels: preferences.channels,
    categories: preferences.categories,
    quietHours: preferences.quietHours,
  };
}
