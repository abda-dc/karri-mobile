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
export type PushRegistrationOperation = "register" | "unregister";

export interface PushNotificationRegistrationState {
  readonly availability: PushRegistrationAvailabilityValue;
  readonly activeOperation: PushRegistrationOperation | null;
  readonly unregistrationAvailability: PushRegistrationAvailabilityValue;
  readonly busy: boolean;
  readonly message: string | null;
  readonly messageOperation: PushRegistrationOperation | null;
  readonly outcome: PushRegistrationOutcome;
  readonly permissionStatus: NotificationPermissionStatus | null;
  register(): Promise<void>;
  unregister(): Promise<void>;
}

export function usePushNotificationRegistration(
  userId: string | null,
  preferences: NotificationPreferences | null,
): PushNotificationRegistrationState {
  const availability = mobileServices.pushRegistration.availability;
  const unregistrationAvailability =
    mobileServices.pushRegistration.unregistrationAvailability;
  const [busy, setBusy] = useState(false);
  const [activeOperation, setActiveOperation] =
    useState<PushRegistrationOperation | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOperation, setMessageOperation] =
    useState<PushRegistrationOperation | null>(null);
  const [outcome, setOutcome] = useState<PushRegistrationOutcome>("idle");
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus | null>(null);
  const sessionGenerationRef = useRef(0);
  const operationIdRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    sessionGenerationRef.current += 1;
    setMessage(null);
    setMessageOperation(null);
    setOutcome("idle");
    setPermissionStatus(null);
  }, [userId]);

  const register = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    setMessageOperation("register");
    if (!userId) {
      setMessage("Sign in before registering this device.");
      setOutcome("warning");
      return;
    }
    if (!preferences?.channels[NotificationChannel.Push]) {
      setMessage("Turn on and save the Push preference before registering this device.");
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

    busyRef.current = true;
    setBusy(true);
    setActiveOperation("register");
    setMessage(null);
    setOutcome("idle");
    const sessionGeneration = sessionGenerationRef.current;
    const operationId = ++operationIdRef.current;
    try {
      const result = await mobileServices.pushRegistration.register(userId);
      if (sessionGeneration !== sessionGenerationRef.current) {
        return;
      }
      setPermissionStatus(
        await mobileServices.pushRegistration.getPermissionStatus(),
      );
      if (sessionGeneration !== sessionGenerationRef.current) {
        return;
      }

      if (result.status === PushRegistrationStatus.Registered) {
        setMessage(
          "This installation registered successfully. Remote push delivery is not enabled yet.",
        );
        setOutcome("success");
        return;
      }

      setMessage(
        result.status === PushRegistrationStatus.Deferred
          ? result.reason
          : "This installation is not registered for remote push delivery.",
      );
      setOutcome("warning");
    } catch {
      if (sessionGeneration !== sessionGenerationRef.current) {
        return;
      }
      setMessage(
        "Device registration could not be completed. No token was displayed or logged.",
      );
      setOutcome("warning");
    } finally {
      if (operationId === operationIdRef.current) {
        busyRef.current = false;
        setBusy(false);
        setActiveOperation(null);
      }
    }
  }, [availability, preferences, userId]);

  const unregister = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    setMessageOperation("unregister");
    if (!userId) {
      setMessage("Sign in before unregistering this device.");
      setOutcome("warning");
      return;
    }
    if (unregistrationAvailability !== PushRegistrationAvailability.Available) {
      setMessage(
        "Unregistration requires a supported Android or iOS development build.",
      );
      setOutcome("warning");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setActiveOperation("unregister");
    setMessage(null);
    setOutcome("idle");
    const sessionGeneration = sessionGenerationRef.current;
    const operationId = ++operationIdRef.current;
    try {
      const result =
        await mobileServices.pushRegistration.unregisterCurrentInstallation(userId);
      if (sessionGeneration !== sessionGenerationRef.current) {
        return;
      }
      if (result.status === PushRegistrationStatus.Unregistered) {
        setMessage(
          "This installation is no longer registered for remote push delivery.",
        );
        setOutcome("success");
        return;
      }

      setMessage(
        "This installation could not be unregistered safely. Try again from a supported build.",
      );
      setOutcome("warning");
    } catch {
      if (sessionGeneration !== sessionGenerationRef.current) {
        return;
      }
      setMessage(
        "Device unregistration could not be completed safely.",
      );
      setOutcome("warning");
    } finally {
      if (operationId === operationIdRef.current) {
        busyRef.current = false;
        setBusy(false);
        setActiveOperation(null);
      }
    }
  }, [unregistrationAvailability, userId]);

  return {
    availability,
    activeOperation,
    busy,
    message,
    messageOperation,
    outcome,
    permissionStatus,
    register,
    unregistrationAvailability,
    unregister,
  };
}
