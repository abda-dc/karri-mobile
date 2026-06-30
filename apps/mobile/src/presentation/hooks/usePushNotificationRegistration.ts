import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationPermissionStatus } from "../../application/notifications/NotificationPermission";
import {
  PushRegistrationAvailability,
  PushRegistrationStatus,
  type PushRegistrationAvailability as PushRegistrationAvailabilityValue,
} from "../../application/services/PushRegistrationService";
import {
  NotificationChannel,
  type NotificationPreferences,
} from "../../domain/notification/NotificationPreferences";
import { mobileServices } from "../services/mobileServices";

export type PushRegistrationOutcome = "idle" | "success" | "warning";

export interface PushNotificationRegistrationState {
  readonly availability: PushRegistrationAvailabilityValue;
  readonly busy: boolean;
  readonly message: string | null;
  readonly outcome: PushRegistrationOutcome;
  readonly permissionStatus: NotificationPermissionStatus | null;
  register(): Promise<void>;
}

export function usePushNotificationRegistration(
  userId: string | null,
  preferences: NotificationPreferences | null,
): PushNotificationRegistrationState {
  const availability = mobileServices.pushRegistration.availability;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PushRegistrationOutcome>("idle");
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    attemptRef.current += 1;
    setBusy(false);
    setMessage(null);
    setOutcome("idle");
    setPermissionStatus(null);
  }, [userId]);

  const register = useCallback(async () => {
    if (busy) {
      return;
    }
    if (!userId) {
      setMessage("Sign in before enabling device notifications.");
      setOutcome("warning");
      return;
    }
    if (!preferences?.channels[NotificationChannel.Push]) {
      setMessage("Enable and save the Push preference before registering this device.");
      setOutcome("warning");
      return;
    }
    if (availability !== PushRegistrationAvailability.Available) {
      setMessage(
        "Registration requires an Android or iOS development build with an EAS project ID.",
      );
      setOutcome("warning");
      return;
    }

    setBusy(true);
    setMessage(null);
    setOutcome("idle");
    const attempt = ++attemptRef.current;
    try {
      const result = await mobileServices.pushRegistration.register(userId);
      if (attempt !== attemptRef.current) {
        return;
      }
      setPermissionStatus(
        await mobileServices.pushRegistration.getPermissionStatus(),
      );
      if (attempt !== attemptRef.current) {
        return;
      }

      if (result.status === PushRegistrationStatus.Registered) {
        setMessage(
          "This installation registered successfully. Push delivery remains controlled by the trusted server rollout.",
        );
        setOutcome("success");
        return;
      }

      setMessage(
        result.status === PushRegistrationStatus.Deferred
          ? result.reason
          : "This installation is not registered for push delivery.",
      );
      setOutcome("warning");
    } catch {
      if (attempt !== attemptRef.current) {
        return;
      }
      setMessage(
        "Device registration could not be completed. No token was displayed or logged.",
      );
      setOutcome("warning");
    } finally {
      if (attempt === attemptRef.current) {
        setBusy(false);
      }
    }
  }, [availability, busy, preferences, userId]);

  return {
    availability,
    busy,
    message,
    outcome,
    permissionStatus,
    register,
  };
}
