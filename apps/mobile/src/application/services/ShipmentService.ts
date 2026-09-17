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
  PendingOperationStorage,
  generateSecureId,
} from "../../infrastructure/storage/PendingOperationStorage";
import {
  DomainValidationError,
  isDefinitiveNonCommit,
  requirePositiveNumber,
  requireText,
} from "./validation";

export type ReconciliationResult<T> =
  | { status: "found"; resource: T }
  | { status: "absent" }
  | { status: "unconfirmed"; error: Error };

export class ShipmentService {
  private readonly inFlightSubmissions = new Set<string>();

  constructor(
    private readonly shipments: ShipmentRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock = systemClock,
    private readonly pendingStorage?: PendingOperationStorage,
  ) {}

  isSubmitting(ownerId: string): boolean {
    return this.inFlightSubmissions.has(ownerId);
  }

  async reconcilePendingOperation(ownerId: string): Promise<ReconciliationResult<Shipment>> {
    if (this.inFlightSubmissions.has(ownerId)) {
      return { status: "unconfirmed", error: new Error("Submission currently in flight.") };
    }

    if (!this.pendingStorage) {
      return { status: "absent" };
    }

    const operationId = await this.pendingStorage.getPendingOperation("shipment", ownerId);
    if (!operationId) {
      return { status: "absent" };
    }

    const docId = `shipment__${ownerId}__${operationId}`;
    try {
      const existing = await this.shipments.findById(docId, true);
      if (existing) {
        await this.pendingStorage.clearPendingOperation("shipment", ownerId);
        return { status: "found", resource: existing };
      }

      await this.pendingStorage.clearPendingOperation("shipment", ownerId);
      return { status: "absent" };
    } catch (error) {
      return {
        status: "unconfirmed",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async abandonPendingOperation(ownerId: string): Promise<ReconciliationResult<Shipment>> {
    return this.reconcilePendingOperation(ownerId);
  }

  async create(input: CreateShipmentDto): Promise<Shipment> {
    const ownerId = requireText(input.ownerId, "ownerId", 128);
    this.inFlightSubmissions.add(ownerId);

    try {
      let operationId = input.operationId;
      if (!operationId && this.pendingStorage) {
        operationId =
          (await this.pendingStorage.getPendingOperation("shipment", ownerId)) ??
          undefined;
      }
      if (!operationId) {
        operationId = generateSecureId("ship");
      }
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

      if (this.pendingStorage) {
        await this.pendingStorage.savePendingOperation(
          "shipment",
          ownerId,
          operationId,
        );
      }

      const existing = await this.shipments.findById(
        `shipment__${ownerId}__${operationId}`,
      );
      if (existing) {
        if (!this.matchesShipmentPayload(existing, input)) {
          throw new DomainValidationError(
            "Operation ID already exists with a different payload.",
          );
        }
        if (this.pendingStorage) {
          await this.pendingStorage.clearPendingOperation("shipment", ownerId);
        }
        return existing;
      }

      const created = await this.shipments.create(shipment, operationId);
      if (this.pendingStorage) {
        await this.pendingStorage.clearPendingOperation("shipment", ownerId);
      }
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
    } catch (error) {
      if (isDefinitiveNonCommit(error) && this.pendingStorage) {
        await this.pendingStorage.clearPendingOperation("shipment", ownerId);
      }
      throw error;
    } finally {
      this.inFlightSubmissions.delete(ownerId);
    }
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

  private matchesShipmentPayload(existing: Shipment, input: CreateShipmentDto): boolean {
    return (
      existing.ownerId === input.ownerId &&
      existing.originCountry === input.originCountry &&
      existing.originCity === input.originCity &&
      existing.destinationCountry === input.destinationCountry &&
      existing.destinationCity === input.destinationCity &&
      existing.packageCategory === input.packageCategory &&
      existing.packageDescription === input.packageDescription &&
      existing.weightKg === input.weightKg &&
      existing.deliveryWindow === input.deliveryWindow &&
      existing.rewardAmount === input.rewardAmount &&
      existing.rewardCurrency === (input.rewardCurrency ?? "USD") &&
      existing.containsBattery === input.containsBattery &&
      existing.batteryType === input.batteryType &&
      existing.containsLiquid === input.containsLiquid &&
      existing.containsFoodOrAgri === input.containsFoodOrAgri &&
      existing.containsMedicine === input.containsMedicine &&
      existing.customsDeclarationRequired === input.customsDeclarationRequired &&
      existing.packageContentVersion === input.packageContentVersion
    );
  }
}
