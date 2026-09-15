import type { EventBus } from "../../domain/events/EventBus";
import type {
  PlatformDomainEvent,
  PlatformEventType,
} from "../../domain/events/platformEvents";
import { NotificationStatus } from "../../domain/notification/Notification";
import type { NotificationRepository } from "../../domain/notification/NotificationRepository";

interface NotificationTemplate {
  readonly title: string;
  readonly body: string;
}

const templates: Partial<Record<PlatformEventType, NotificationTemplate>> = {
  "review.submitted": {
    title: "Review received",
    body: "A booking participant submitted a review.",
  },
};

export class NotificationService {
  private readonly unsubscribeCallbacks: Array<() => void> = [];

  constructor(
    private readonly eventBus: EventBus,
    private readonly notifications: NotificationRepository,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  start(): void {
    if (this.unsubscribeCallbacks.length > 0) {
      return;
    }

    for (const eventType of Object.keys(templates) as PlatformEventType[]) {
      this.unsubscribeCallbacks.push(
        this.eventBus.subscribe<PlatformDomainEvent>(eventType, (event) => {
          void this.createNotifications(event).catch(this.onError);
        }),
      );
    }
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribeCallbacks.splice(0)) {
      unsubscribe();
    }
  }

  private async createNotifications(event: PlatformDomainEvent): Promise<void> {
    const template = templates[event.type];

    if (!template) {
      return;
    }
    const recipients = [...new Set(event.payload.recipientIds)];

    await Promise.all(
      recipients.map((recipientId) =>
        this.notifications.create({
          recipientId,
          title: template.title,
          body: template.body,
          type: event.type,
          relatedEntityType: event.type.startsWith("review.") ? "review" : "booking",
          relatedEntityId: event.aggregateId,
          status: NotificationStatus.Unread,
        }),
      ),
    );
  }

  watchForRecipient(
    recipientId: string,
    onData: Parameters<NotificationRepository["watchByRecipient"]>[1],
    onError: Parameters<NotificationRepository["watchByRecipient"]>[2],
  ): () => void {
    return this.notifications.watchByRecipient(recipientId, onData, onError);
  }

  markRead(notificationId: string): Promise<void> {
    return this.notifications.markRead(notificationId, new Date().toISOString());
  }
}
