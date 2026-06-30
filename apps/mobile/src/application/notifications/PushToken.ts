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
