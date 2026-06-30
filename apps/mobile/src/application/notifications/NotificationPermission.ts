export const NotificationPermissionStatus = {
  Denied: "denied",
  Ephemeral: "ephemeral",
  Granted: "granted",
  NotDetermined: "not_determined",
  Provisional: "provisional",
  Unsupported: "unsupported",
} as const;

export type NotificationPermissionStatus =
  (typeof NotificationPermissionStatus)[keyof typeof NotificationPermissionStatus];

export function permitsPushTokenRegistration(
  status: NotificationPermissionStatus,
): boolean {
  return (
    status === NotificationPermissionStatus.Granted ||
    status === NotificationPermissionStatus.Provisional ||
    status === NotificationPermissionStatus.Ephemeral
  );
}
