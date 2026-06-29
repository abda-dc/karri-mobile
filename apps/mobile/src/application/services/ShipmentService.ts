import type { CreateShipmentDto } from "../dto/commands";
import type { EventPublisher } from "../../domain/events/DomainEvent";
import {
  createPlatformEvent,
  type ShipmentCreated,
} from "../../domain/events/platformEvents";
import {
  ListingStatus,
  type NewShipment,
  type Shipment,
} from "../../domain/shipment/Shipment";
import type { ShipmentRepository } from "../../domain/shipment/ShipmentRepository";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import {
  DomainValidationError,
  requirePositiveNumber,
  requireText,
} from "./validation";

export class ShipmentService {
  constructor(
    private readonly shipments: ShipmentRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock = systemClock,
  ) {}

  async create(input: CreateShipmentDto): Promise<Shipment> {
    const shipment: NewShipment = {
      ownerId: requireText(input.ownerId, "ownerId", 128),
      originCountry: requireText(input.originCountry, "originCountry", 80),
      originCity: requireText(input.originCity, "originCity", 120),
      destinationCountry: requireText(input.destinationCountry, "destinationCountry", 80),
      destinationCity: requireText(input.destinationCity, "destinationCity", 120),
      packageCategory: requireText(input.packageCategory, "packageCategory", 80),
      packageDescription: requireText(input.packageDescription, "packageDescription", 500),
      weightKg: requirePositiveNumber(input.weightKg, "weightKg", 100),
      deliveryWindow: requireText(input.deliveryWindow, "deliveryWindow", 120),
      rewardAmount: requirePositiveNumber(input.rewardAmount, "rewardAmount", 100000),
      rewardCurrency: this.validateCurrency(input.rewardCurrency ?? "USD"),
      status: ListingStatus.Active,
    };
    const created = await this.shipments.create(shipment);
    const occurredAt = created.createdAt ?? this.clock.now();

    this.events.publish(
      createPlatformEvent<ShipmentCreated>({
        type: "shipment.created",
        aggregateId: created.id,
        actorId: created.ownerId,
        occurredAt,
        payload: { ownerId: created.ownerId, recipientIds: [created.ownerId] },
      }),
    );

    return created;
  }

  private validateCurrency(value: string): string {
    const currency = requireText(value, "rewardCurrency", 3).toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new DomainValidationError("rewardCurrency must be a three-letter currency code.");
    }

    return currency;
  }
}
