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
  type SafetyDeclarationSnapshot,
} from "../../domain/shipment/Shipment";
import { CURRENT_POLICY_VERSION, CURRENT_DECLARATION_VERSION } from "../../domain/configuration/SafetyPolicy";
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
    const ownerId = requireText(input.ownerId, "ownerId", 128);
    const packageContentVersion = input.packageContentVersion;

    // Validate safety declaration first
    this.validateSafetyDeclaration(input.safetyDeclaration, ownerId, packageContentVersion);

    // Validate battery configuration
    const allowedBatteryTypes = ["lithium_ion", "lithium_metal", "none"];
    if (!allowedBatteryTypes.includes(input.batteryType)) {
      throw new DomainValidationError("batteryType must be lithium_ion, lithium_metal, or none.");
    }
    if (input.containsBattery && input.batteryType === "none") {
      throw new DomainValidationError("batteryType cannot be none when containsBattery is true.");
    }
    if (!input.containsBattery && input.batteryType !== "none") {
      throw new DomainValidationError("batteryType must be none when containsBattery is false.");
    }

    const shipment: NewShipment = {
      ownerId,
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

      containsBattery: input.containsBattery,
      batteryType: input.batteryType,
      containsLiquid: input.containsLiquid,
      containsFoodOrAgri: input.containsFoodOrAgri,
      containsMedicine: input.containsMedicine,
      customsDeclarationRequired: input.customsDeclarationRequired,
      packageContentVersion,
      safetyDeclaration: input.safetyDeclaration,
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

  findById(shipmentId: string): Promise<Shipment | null> {
    return this.shipments.findById(shipmentId);
  }

  listActive(): Promise<ReadonlyArray<Shipment>> {
    return this.shipments.listActive();
  }

  watchOwned(
    ownerId: string,
    onData: (shipments: ReadonlyArray<Shipment>) => void,
    onError: (error: Error) => void,
  ): () => void {
    return this.shipments.watchByOwner(ownerId, onData, onError);
  }

  watchActive(
    onData: (shipments: ReadonlyArray<Shipment>) => void,
    onError: (error: Error) => void,
  ): () => void {
    return this.shipments.watchActive(onData, onError);
  }

  private validateCurrency(value: string): string {
    const currency = requireText(value, "rewardCurrency", 3).toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new DomainValidationError("rewardCurrency must be a three-letter currency code.");
    }

    return currency;
  }

  private validateSafetyDeclaration(
    declaration: SafetyDeclarationSnapshot,
    ownerId: string,
    packageContentVersion: number,
  ): void {
    if (!declaration) {
      throw new DomainValidationError("Safety declaration is required.");
    }
    if (declaration.policyVersion !== CURRENT_POLICY_VERSION) {
      throw new DomainValidationError(`Stale or invalid policy version: ${declaration.policyVersion}`);
    }
    if (declaration.declarationVersion !== CURRENT_DECLARATION_VERSION) {
      throw new DomainValidationError(`Stale or invalid declaration version: ${declaration.declarationVersion}`);
    }
    if (declaration.acceptedByUserId !== ownerId) {
      throw new DomainValidationError("Declaration user ID must match the shipment owner.");
    }
    if (declaration.packageContentVersion !== packageContentVersion) {
      throw new DomainValidationError("Declaration package content version must match the shipment content version.");
    }
    const acks = declaration.acknowledgements;
    if (!acks) {
      throw new DomainValidationError("Acknowledgements are required.");
    }
    if (
      acks.contentsAccurate !== true ||
      acks.noProhibitedItems !== true ||
      acks.inspectionPermitted !== true ||
      acks.customsResponsibilityAccepted !== true
    ) {
      throw new DomainValidationError("All safety acknowledgements must be accepted.");
    }
  }
}
