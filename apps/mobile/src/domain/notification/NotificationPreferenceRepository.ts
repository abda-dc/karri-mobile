import type { NotificationPreferences } from "./NotificationPreferences";

export interface NotificationPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreferences | null>;
  save(preferences: NotificationPreferences): Promise<NotificationPreferences>;
}
