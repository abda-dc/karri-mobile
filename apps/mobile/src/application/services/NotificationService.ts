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

const templates: Record<PlatformEventType, NotificationTemplate> = {
  "shipment.created": {
    title: "Shipment saved",
    body: "Your shipment is ready for corridor matching.",
  },
  "trip.created": {
    title: "Trip saved",
    body: "Your trip is ready for corridor matching.",
  },
  "booking.requested": {
    title: "Booking requested",
    body: "A booking request needs your attention.",
  },
  "booking.accepted": {
    title: "Booking accepted",
    body: "The booking was accepted.",
  },
  "booking.declined": {
    title: "Booking declined",
    body: "The booking request was declined.",
  },
  "booking.cancelled": {
    title: "Booking cancelled",
    body: "The booking was cancelled.",
  },
  "booking.expired": {
    title: "Booking expired",
    body: "The booking request expired before acceptance.",
  },
  "package.picked_up": {
    title: "Package picked up",
    body: "The package is now in transit.",
  },
  "package.delivered": {
    title: "Package delivered",
    body: "The package was marked delivered.",
  },
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
    const recipients = [...new Set(event.payload.recipientIds)];

    await Promise.all(
      recipients.map((recipientId) =>
        this.notifications.create({
          recipientId,
          title: template.title,
          body: template.body,
          type: event.type,
          relatedEntityType: event.type.split(".")[0],
          relatedEntityId: event.aggregateId,
          status: NotificationStatus.Unread,
        }),
      ),
    );
  }
}
