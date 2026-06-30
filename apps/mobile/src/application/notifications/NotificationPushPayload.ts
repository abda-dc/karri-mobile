import {
  NotificationActionType,
  type NotificationAction,
} from "./NotificationAction";

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const allowedKeys = new Set(["action", "bookingId", "notificationId", "schemaVersion"]);

interface NotificationPushPayloadBase {
  readonly notificationId: string;
  readonly schemaVersion: 1;
}

export type NotificationPushPayload =
  | (NotificationPushPayloadBase & {
      readonly action: typeof NotificationActionType.OpenBooking;
      readonly bookingId: string;
    })
  | (NotificationPushPayloadBase & {
      readonly action: typeof NotificationActionType.OpenTracking;
      readonly bookingId?: string;
    })
  | (NotificationPushPayloadBase & {
      readonly action:
        | typeof NotificationActionType.OpenHome
        | typeof NotificationActionType.OpenNotifications
        | typeof NotificationActionType.OpenProfile;
    });

export type NotificationPushPayloadValidationResult =
  | {
      readonly payload: NotificationPushPayload;
      readonly valid: true;
    }
  | {
      readonly errors: ReadonlyArray<string>;
      readonly valid: false;
    };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string" && safeIdentifierPattern.test(value);
}

export function validateNotificationPushPayload(
  value: unknown,
): NotificationPushPayloadValidationResult {
  if (!isRecord(value)) {
    return { errors: ["Push payload must be an object."], valid: false };
  }

  const errors: string[] = [];
  const extraKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (extraKeys.length > 0) {
    errors.push(
      "Push payload contains non-allowlisted fields. Private content is not permitted.",
    );
  }
  if (value.schemaVersion !== 1) {
    errors.push("Push payload schemaVersion must be 1.");
  }
  const notificationId = isSafeIdentifier(value.notificationId)
    ? value.notificationId
    : null;
  if (!notificationId) {
    errors.push("Push payload notificationId must be a safe opaque identifier.");
  }

  const action = value.action;
  const bookingId = value.bookingId;
  switch (action) {
    case NotificationActionType.OpenBooking:
      if (!isSafeIdentifier(bookingId)) {
        errors.push("open_booking requires a safe bookingId.");
      }
      break;
    case NotificationActionType.OpenTracking:
      if (bookingId !== undefined && !isSafeIdentifier(bookingId)) {
        errors.push("open_tracking bookingId must be a safe opaque identifier.");
      }
      break;
    case NotificationActionType.OpenHome:
    case NotificationActionType.OpenNotifications:
    case NotificationActionType.OpenProfile:
      if (bookingId !== undefined) {
        errors.push(`${action} does not accept bookingId.`);
      }
      break;
    default:
      errors.push("Push payload action is not supported.");
  }

  if (errors.length > 0) {
    return { errors, valid: false };
  }

  const base = { notificationId: notificationId!, schemaVersion: 1 } as const;
  switch (action) {
    case NotificationActionType.OpenBooking:
      return {
        payload: { ...base, action, bookingId: bookingId as string },
        valid: true,
      };
    case NotificationActionType.OpenTracking:
      return {
        payload: {
          ...base,
          action,
          bookingId: bookingId as string | undefined,
        },
        valid: true,
      };
    case NotificationActionType.OpenHome:
    case NotificationActionType.OpenNotifications:
    case NotificationActionType.OpenProfile:
      return { payload: { ...base, action }, valid: true };
    default:
      return { errors: ["Push payload action is not supported."], valid: false };
  }
}

export function notificationPushPayloadToAction(
  payload: NotificationPushPayload,
): NotificationAction {
  switch (payload.action) {
    case NotificationActionType.OpenBooking:
      return { bookingId: payload.bookingId, type: payload.action };
    case NotificationActionType.OpenTracking:
      return { bookingId: payload.bookingId, type: payload.action };
    case NotificationActionType.OpenHome:
    case NotificationActionType.OpenNotifications:
    case NotificationActionType.OpenProfile:
      return { type: payload.action };
  }
}

export const notificationPushPayloadExamples = {
  openBooking: {
    action: NotificationActionType.OpenBooking,
    bookingId: "booking_test_001",
    notificationId: "notification_test_booking_001",
    schemaVersion: 1,
  },
  openHome: {
    action: NotificationActionType.OpenHome,
    notificationId: "notification_test_home_001",
    schemaVersion: 1,
  },
  openNotifications: {
    action: NotificationActionType.OpenNotifications,
    notificationId: "notification_test_list_001",
    schemaVersion: 1,
  },
  openProfile: {
    action: NotificationActionType.OpenProfile,
    notificationId: "notification_test_profile_001",
    schemaVersion: 1,
  },
  openTracking: {
    action: NotificationActionType.OpenTracking,
    notificationId: "notification_test_tracking_001",
    schemaVersion: 1,
  },
} as const satisfies Readonly<Record<string, NotificationPushPayload>>;
