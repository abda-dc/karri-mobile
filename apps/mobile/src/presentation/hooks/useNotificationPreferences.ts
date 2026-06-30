import { useCallback, useEffect, useState } from "react";
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

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setPreferences(null);
      return;
    }

    let active = true;
    setLoading(true);
    void mobileServices.notificationPreferences
      .getPreferences(userId)
      .then((nextPreferences) => {
        if (active) {
          setPreferences(nextPreferences);
          setLoading(false);
        }
      })
      .catch((error) => {
        reportApplicationError(error, "notification-preferences.load");
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const updatePreferences = useCallback(
    async (nextPreferences: NotificationPreferences) => {
      setLoading(true);
      try {
        const saved = await mobileServices.notificationPreferences.savePreferences(
          nextPreferences,
        );
        setPreferences(saved);
        return saved;
      } catch (error) {
        reportApplicationError(error, "notification-preferences.save");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, preferences, updatePreferences };
}
