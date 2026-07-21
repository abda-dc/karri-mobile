import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../domain/events/EventBus";
import { createPlatformEvent, type PlatformDomainEvent } from "../../domain/events/platformEvents";
import type { NotificationRepository } from "../../domain/notification/NotificationRepository";
import { NotificationService } from "./NotificationService";

type TestedEventType = "booking.accepted" | "booking.declined" | "package.delivered";

function event<TType extends TestedEventType>(
  type: TType,
): Extract<PlatformDomainEvent, { type: TType }> {
  type TestedEvent = Extract<PlatformDomainEvent, { type: TType }>;
  return createPlatformEvent<TestedEvent>({
    aggregateId: "booking-test",
    actorId: "actor-test",
    occurredAt: "2026-07-21T12:00:00.000Z",
    payload: { recipientIds: ["recipient-one"] },
    type,
  } as Omit<TestedEvent, "id" | "schemaVersion">);
}

async function flushAsyncHandler(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("NotificationService notification ownership", () => {
  it("does not materialize booking.accepted events from the mobile event bus", async () => {
    const bus = new EventBus();
    const create = vi.fn();
    const repository = { create } as unknown as NotificationRepository;
    const service = new NotificationService(bus, repository);
    service.start();

    bus.publish(event("booking.accepted"));
    await flushAsyncHandler();

    expect(create).not.toHaveBeenCalled();
    service.stop();
  });

  it("keeps existing non-migrated event templates active", async () => {
    const bus = new EventBus();
    const create = vi.fn(async (notification) => ({
      ...notification,
      id: "notification-test",
      createdAt: "2026-07-21T12:00:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z",
      readAt: null,
    }));
    const repository = { create } as unknown as NotificationRepository;
    const service = new NotificationService(bus, repository);
    service.start();

    bus.publish(event("booking.declined"));
    bus.publish(event("package.delivered"));
    await flushAsyncHandler();

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([notification]) => notification.type)).toEqual([
      "booking.declined",
      "package.delivered",
    ]);
    service.stop();
  });
});
