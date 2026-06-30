export const PushTokenPlatform = {
  Android: "android",
  Ios: "ios",
  Web: "web",
} as const;

export type PushTokenPlatform =
  (typeof PushTokenPlatform)[keyof typeof PushTokenPlatform];

export const PushTokenProvider = {
  ApplePushNotificationService: "apns",
  Expo: "expo",
  FirebaseCloudMessaging: "fcm",
} as const;

export type PushTokenProvider =
  (typeof PushTokenProvider)[keyof typeof PushTokenProvider];

export interface PushToken {
  readonly deviceId: string;
  readonly platform: PushTokenPlatform;
  readonly provider: PushTokenProvider;
  readonly registeredAt: string;
  readonly userId: string;
  readonly value: string;
}

export class InvalidPushTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPushTokenError";
  }
}

export function assertPushToken(token: PushToken, expectedUserId: string): void {
  if (
    !token.userId ||
    token.userId !== expectedUserId ||
    token.userId !== token.userId.trim() ||
    token.userId.length > 128
  ) {
    throw new InvalidPushTokenError("Push token must belong to the active user.");
  }
  if (
    !token.deviceId ||
    token.deviceId !== token.deviceId.trim() ||
    token.deviceId.length > 200
  ) {
    throw new InvalidPushTokenError("Push token requires a valid installation ID.");
  }
  if (!token.value || token.value !== token.value.trim() || token.value.length > 4096) {
    throw new InvalidPushTokenError("Push token value is invalid.");
  }
  if (!Number.isFinite(Date.parse(token.registeredAt))) {
    throw new InvalidPushTokenError("Push token registration time is invalid.");
  }
  if (!Object.values(PushTokenPlatform).includes(token.platform)) {
    throw new InvalidPushTokenError("Push token platform is invalid.");
  }
  if (!Object.values(PushTokenProvider).includes(token.provider)) {
    throw new InvalidPushTokenError("Push token provider is invalid.");
  }
}
