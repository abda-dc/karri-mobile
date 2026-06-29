import type { NewNotification, Notification } from "./Notification";

export interface NotificationRepository {
  create(notification: NewNotification): Promise<Notification>;
  listByRecipient(recipientId: string): Promise<ReadonlyArray<Notification>>;
  watchByRecipient(
    recipientId: string,
    onData: (notifications: ReadonlyArray<Notification>) => void,
    onError: (error: Error) => void,
  ): () => void;
  markRead(notificationId: string, readAt: string): Promise<void>;
}
