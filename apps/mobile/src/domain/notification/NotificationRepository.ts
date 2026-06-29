import type { NewNotification, Notification } from "./Notification";

export interface NotificationRepository {
  create(notification: NewNotification): Promise<Notification>;
  listByRecipient(recipientId: string): Promise<ReadonlyArray<Notification>>;
  markRead(notificationId: string, readAt: string): Promise<void>;
}
