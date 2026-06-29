import type { DomainEvent, EventPublisher } from "./DomainEvent";

export type DomainEventHandler<
  TEvent extends DomainEvent<string, object> = DomainEvent<string, object>,
> = (
  event: TEvent,
) => void;

export class EventBus implements EventPublisher {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();

  publish(event: DomainEvent<string, object>): void {
    const handlers = this.handlers.get(event.type);

    if (!handlers) {
      return;
    }

    for (const handler of [...handlers]) {
      handler(event);
    }
  }

  subscribe<TEvent extends DomainEvent<string, object>>(
    eventType: TEvent["type"],
    handler: DomainEventHandler<TEvent>,
  ): () => void {
    const handlers = this.handlers.get(eventType) ?? new Set<DomainEventHandler>();
    handlers.add(handler as DomainEventHandler);
    this.handlers.set(eventType, handlers);

    return () => this.unsubscribe(eventType, handler);
  }

  unsubscribe<TEvent extends DomainEvent<string, object>>(
    eventType: TEvent["type"],
    handler: DomainEventHandler<TEvent>,
  ): void {
    const handlers = this.handlers.get(eventType);
    handlers?.delete(handler as DomainEventHandler);

    if (handlers?.size === 0) {
      this.handlers.delete(eventType);
    }
  }
}
