import type { NotificationPreferenceRepository } from "../../domain/notification/NotificationPreferenceRepository";
import {
  assertNotificationPreferences,
  createDefaultNotificationPreferences,
  InvalidNotificationPreferencesError,
  setNotificationChannel,
  setNotificationQuietHours,
  touchNotificationPreferences,
  type NotificationChannel,
  type NotificationPreferences,
  type QuietHours,
} from "../../domain/notification/NotificationPreferences";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";

export class NotificationPreferenceService {
  constructor(
    private readonly preferences: NotificationPreferenceRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const existing = await this.preferences.findByUserId(userId);
    if (existing) {
      assertNotificationPreferences(existing);
      return existing;
    }

    return createDefaultNotificationPreferences(userId, this.clock.now());
  }

  savePreferences(
    userId: string,
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    const next = touchNotificationPreferences(preferences, this.clock.now());
    if (next.userId !== userId || next.id !== userId) {
      throw new InvalidNotificationPreferencesError(
        "Notification preferences can only be saved for the active user.",
      );
    }

    return this.preferences.save(next);
  }

  async enableChannel(
    userId: string,
    channel: NotificationChannel,
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    return this.preferences.save(
      setNotificationChannel(current, channel, true, this.clock.now()),
    );
  }

  async disableChannel(
    userId: string,
    channel: NotificationChannel,
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    return this.preferences.save(
      setNotificationChannel(current, channel, false, this.clock.now()),
    );
  }

  async setQuietHours(
    userId: string,
    quietHours: QuietHours | null,
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    return this.preferences.save(
      setNotificationQuietHours(current, quietHours, this.clock.now()),
    );
  }
}
