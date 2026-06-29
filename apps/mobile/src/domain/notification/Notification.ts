import type { DomainEntity } from "../shared/Entity";

export const NotificationStatus = {
  Unread: "unread",
  Read: "read",
} as const;

export type NotificationStatus =
  (typeof NotificationStatus)[keyof typeof NotificationStatus];

export interface Notification extends DomainEntity {
  readonly recipientId: string;
  readonly title: string;
  readonly body: string;
  readonly type: string;
  readonly relatedEntityType: string | null;
  readonly relatedEntityId: string | null;
  readonly status: NotificationStatus;
  readonly readAt: string | null;
}

export type NewNotification = Omit<
  Notification,
  "id" | "createdAt" | "updatedAt" | "readAt"
>;
