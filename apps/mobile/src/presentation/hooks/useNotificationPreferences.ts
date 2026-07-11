import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationPreferences } from "../../domain/notification/NotificationPreferences";
import { reportApplicationError } from "../errors/getFriendlyError";
import { mobileServices } from "../services/mobileServices";

export interface NotificationPreferencesState {
  readonly loading: boolean;
  readonly preferences: NotificationPreferences | null;
  updatePreferences(
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences>;
}

export function useNotificationPreferences(
  userId: string | null,
): NotificationPreferencesState {
  const [loading, setLoading] = useState(Boolean(userId));
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const requestId = useRef(0);

  const loadPreferences = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!userId) {
      setLoading(false);
      setPreferences(null);
      return;
    }

    setLoading(true);
    try {
      const nextPreferences =
        await mobileServices.notificationPreferences.getPreferences(userId);
      if (requestId.current !== currentRequestId) {
        return;
      }
      setPreferences(nextPreferences);
    } catch (error) {
      if (requestId.current !== currentRequestId) {
        return;
      }
      reportApplicationError(error, "notification-preferences.load");
    } finally {
      if (requestId.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void loadPreferences();
    return () => {
      requestId.current += 1;
    };
  }, [loadPreferences]);

  const updatePreferences = useCallback(
    async (nextPreferences: NotificationPreferences) => {
      const currentRequestId = ++requestId.current;
      if (!userId) {
        throw new Error("Sign in before saving notification preferences.");
      }

      setLoading(true);
      try {
        const saved = await mobileServices.notificationPreferences.savePreferences(
          userId,
          nextPreferences,
        );
        if (requestId.current === currentRequestId) {
          setPreferences(saved);
        }
        return saved;
      } catch (error) {
        if (requestId.current === currentRequestId) {
          reportApplicationError(error, "notification-preferences.save");
        }
        throw error;
      } finally {
        if (requestId.current === currentRequestId) {
          setLoading(false);
        }
      }
    },
    [userId],
  );

  return { loading, preferences, updatePreferences };
}
