import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  NotificationPermissionStatus,
  permitsPushTokenRegistration,
} from "../../../application/notifications/NotificationPermission";
import {
  PushTokenPlatform,
  PushTokenProvider,
  type PushToken,
} from "../../../application/notifications/PushToken";
import {
  PushRegistrationAvailability,
  PushRegistrationStatus,
  type PushRegistrationResult,
  type PushTokenRegistrationGateway,
} from "../../../application/services/PushRegistrationService";

const installationIdKey = "@karri/push-installation-id/v1";
const installationIdPattern = /^karri-[a-z0-9-]{16,100}$/;

function isNativePlatform(): boolean {
  return Platform.OS === "android" || Platform.OS === "ios";
}

function getEasProjectId(): string | null {
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  return typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : null;
}

function createInstallationId(): string {
  const randomPart = Array.from({ length: 4 }, () =>
    Math.random().toString(36).slice(2, 10),
  ).join("");
  return `karri-${Date.now().toString(36)}-${randomPart}`;
}

async function getInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(installationIdKey);
  if (existing && installationIdPattern.test(existing)) {
    return existing;
  }

  const installationId = createInstallationId();
  await AsyncStorage.setItem(installationIdKey, installationId);
  return installationId;
}

function mapPermissionStatus(
  status: Notifications.NotificationPermissionsStatus,
): NotificationPermissionStatus {
  if (Platform.OS === "ios" && status.ios) {
    switch (status.ios.status) {
      case Notifications.IosAuthorizationStatus.AUTHORIZED:
        return NotificationPermissionStatus.Granted;
      case Notifications.IosAuthorizationStatus.PROVISIONAL:
        return NotificationPermissionStatus.Provisional;
      case Notifications.IosAuthorizationStatus.EPHEMERAL:
        return NotificationPermissionStatus.Ephemeral;
      case Notifications.IosAuthorizationStatus.DENIED:
        return NotificationPermissionStatus.Denied;
      case Notifications.IosAuthorizationStatus.NOT_DETERMINED:
        return NotificationPermissionStatus.NotDetermined;
    }
  }

  switch (status.status) {
    case Notifications.PermissionStatus.GRANTED:
      return NotificationPermissionStatus.Granted;
    case Notifications.PermissionStatus.DENIED:
      return NotificationPermissionStatus.Denied;
    case Notifications.PermissionStatus.UNDETERMINED:
      return NotificationPermissionStatus.NotDetermined;
  }
}

async function createAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  await Promise.all([
    Notifications.setNotificationChannelAsync("karri_activity_v1", {
      description: "Booking, custody, delivery, review, and trust updates.",
      importance: Notifications.AndroidImportance.DEFAULT,
      name: "Karri activity",
      showBadge: true,
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync("karri_announcements_v1", {
      description: "Optional general Karri announcements.",
      importance: Notifications.AndroidImportance.LOW,
      name: "Karri announcements",
      showBadge: false,
      sound: null,
    }),
  ]);
}

async function disableExpoAutomaticTokenUpdates(): Promise<boolean> {
  try {
    await Notifications.setAutoServerRegistrationEnabledAsync(false);
    return true;
  } catch {
    return false;
  }
}

export class ExpoPushTokenRegistrationGateway
  implements PushTokenRegistrationGateway
{
  get availability(): PushRegistrationAvailability {
    return isNativePlatform() && getEasProjectId()
      ? PushRegistrationAvailability.Available
      : PushRegistrationAvailability.Deferred;
  }

  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    if (!isNativePlatform()) {
      return NotificationPermissionStatus.Unsupported;
    }

    try {
      return mapPermissionStatus(await Notifications.getPermissionsAsync());
    } catch {
      return NotificationPermissionStatus.Unsupported;
    }
  }

  async register(userId: string): Promise<PushRegistrationResult> {
    const projectId = getEasProjectId();
    if (!isNativePlatform()) {
      return {
        reason: "Push registration is available only in Android and iOS builds.",
        status: PushRegistrationStatus.Deferred,
      };
    }
    if (!projectId) {
      return {
        reason: "Push registration requires a configured EAS project ID.",
        status: PushRegistrationStatus.Deferred,
      };
    }

    try {
      await createAndroidChannels();
      let permissionStatus = await this.getPermissionStatus();
      if (permissionStatus === NotificationPermissionStatus.NotDetermined) {
        permissionStatus = mapPermissionStatus(
          await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          }),
        );
      }
      if (!permitsPushTokenRegistration(permissionStatus)) {
        return {
          reason:
            permissionStatus === NotificationPermissionStatus.Denied
              ? "Notification permission is denied. Karri did not open system settings or prompt again."
              : "Notification permission is not available for this build.",
          status: PushRegistrationStatus.Deferred,
        };
      }

      const deviceId = await getInstallationId();
      const expoToken = await Notifications.getExpoPushTokenAsync({
        deviceId,
        projectId,
      });
      if (!(await disableExpoAutomaticTokenUpdates())) {
        return {
          reason: "Expo automatic token updates could not be disabled safely.",
          status: PushRegistrationStatus.Deferred,
        };
      }

      const token: PushToken = {
        deviceId,
        platform:
          Platform.OS === "android"
            ? PushTokenPlatform.Android
            : PushTokenPlatform.Ios,
        provider: PushTokenProvider.Expo,
        registeredAt: new Date().toISOString(),
        userId,
        value: expoToken.data,
      };
      return { status: PushRegistrationStatus.Registered, token };
    } catch {
      await disableExpoAutomaticTokenUpdates();
      return {
        reason:
          "Expo could not obtain a push token. Confirm this is a compatible development build with matching credentials and network access.",
        status: PushRegistrationStatus.Deferred,
      };
    }
  }

  async unregister(_token: PushToken): Promise<PushRegistrationResult> {
    return (await disableExpoAutomaticTokenUpdates())
      ? { status: PushRegistrationStatus.Unregistered }
      : {
          reason: "Expo automatic token updates could not be disabled safely.",
          status: PushRegistrationStatus.Deferred,
        };
  }
}
