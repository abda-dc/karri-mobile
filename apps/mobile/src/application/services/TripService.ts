import type { CreateTripDto } from "../dto/commands";
import type { EventPublisher } from "../../domain/events/DomainEvent";
import { createPlatformEvent, type TripCreated } from "../../domain/events/platformEvents";
import { ListingStatus } from "../../domain/shipment/Shipment";
import type { NewTrip, Trip } from "../../domain/trip/Trip";
import type { TripRepository } from "../../domain/trip/TripRepository";
import type { ReconciliationResult } from "./ShipmentService";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import {
  PendingOperationStorage,
  generateSecureId,
} from "../../infrastructure/storage/PendingOperationStorage";
import {
  DomainValidationError,
  isDefinitiveNonCommit,
  optionalText,
  requireIsoDate,
  requirePositiveNumber,
  requireText,
} from "./validation";

export class TripService {
  private readonly inFlightSubmissions = new Set<string>();

  constructor(
    private readonly trips: TripRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock = systemClock,
    private readonly pendingStorage?: PendingOperationStorage,
  ) {}

  isSubmitting(ownerId: string): boolean {
    return this.inFlightSubmissions.has(ownerId);
  }

  async reconcilePendingOperation(ownerId: string): Promise<ReconciliationResult<Trip>> {
    if (this.inFlightSubmissions.has(ownerId)) {
      return { status: "unconfirmed", error: new Error("Submission currently in flight.") };
    }

    if (!this.pendingStorage) {
      return { status: "absent" };
    }

    const operationId = await this.pendingStorage.getPendingOperation("trip", ownerId);
    if (!operationId) {
      return { status: "absent" };
    }

    const docId = `trip__${ownerId}__${operationId}`;
    try {
      const existing = await this.trips.findById(docId, true);
      if (existing) {
        await this.pendingStorage.clearPendingOperation("trip", ownerId);
        return { status: "found", resource: existing };
      }

      await this.pendingStorage.clearPendingOperation("trip", ownerId);
      return { status: "absent" };
    } catch (error) {
      return {
        status: "unconfirmed",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async abandonPendingOperation(ownerId: string): Promise<ReconciliationResult<Trip>> {
    return this.reconcilePendingOperation(ownerId);
  }

  async create(input: CreateTripDto): Promise<Trip> {
    const ownerId = requireText(input.ownerId, "ownerId", 128);
    this.inFlightSubmissions.add(ownerId);

    try {
      let operationId = input.operationId;
      if (!operationId && this.pendingStorage) {
        operationId =
          (await this.pendingStorage.getPendingOperation("trip", ownerId)) ??
          undefined;
      }
      if (!operationId) {
        operationId = generateSecureId("trip");
      }
      const departureDate = requireIsoDate(input.departureDate, "departureDate");
      const arrivalDate = requireIsoDate(input.arrivalDate, "arrivalDate");

      if (arrivalDate < departureDate) {
        throw new DomainValidationError("arrivalDate cannot be before departureDate.");
      }

      const trip: NewTrip = {
        ownerId,
        originCountry: requireText(input.originCountry, "originCountry", 80),
        originCity: requireText(input.originCity, "originCity", 120),
        destinationCountry: requireText(input.destinationCountry, "destinationCountry", 80),
        destinationCity: requireText(input.destinationCity, "destinationCity", 120),
        departureDate,
        arrivalDate,
        availableCapacityKg: requirePositiveNumber(
          input.availableCapacityKg,
          "availableCapacityKg",
          100,
        ),
        notes: optionalText(input.notes ?? "", "notes", 500),
        status: ListingStatus.Active,
      };

      if (this.pendingStorage) {
        await this.pendingStorage.savePendingOperation(
          "trip",
          ownerId,
          operationId,
        );
      }

      const existing = await this.trips.findById(`trip__${ownerId}__${operationId}`);
      if (existing) {
        if (!this.matchesTripPayload(existing, input)) {
          throw new DomainValidationError("Operation ID already exists with a different payload.");
        }
        if (this.pendingStorage) {
          await this.pendingStorage.clearPendingOperation("trip", ownerId);
        }
        return existing;
      }

      const created = await this.trips.create(trip, operationId);
      if (this.pendingStorage) {
        await this.pendingStorage.clearPendingOperation("trip", ownerId);
      }
      const occurredAt = created.createdAt ?? this.clock.now();

      this.events.publish(
        createPlatformEvent<TripCreated>({
          type: "trip.created",
          aggregateId: created.id,
          actorId: created.ownerId,
          occurredAt,
          payload: { ownerId: created.ownerId, recipientIds: [created.ownerId] },
        }),
      );

      return created;
    } catch (error) {
      if (isDefinitiveNonCommit(error) && this.pendingStorage) {
        await this.pendingStorage.clearPendingOperation("trip", ownerId);
      }
      throw error;
    } finally {
      this.inFlightSubmissions.delete(ownerId);
    }
  }

  findById(tripId: string): Promise<Trip | null> {
    return this.trips.findById(tripId);
  }

  listActive(): Promise<ReadonlyArray<Trip>> {
    return this.trips.listActive();
  }

  watchOwned(
    ownerId: string,
    onData: (trips: ReadonlyArray<Trip>) => void,
    onError: (error: Error) => void,
  ): () => void {
    return this.trips.watchByOwner(ownerId, onData, onError);
  }

  watchActive(
    onData: (trips: ReadonlyArray<Trip>) => void,
    onError: (error: Error) => void,
  ): () => void {
    return this.trips.watchActive(onData, onError);
  }

  private matchesTripPayload(existing: Trip, input: CreateTripDto): boolean {
    return (
      existing.ownerId === input.ownerId &&
      existing.originCountry === input.originCountry &&
      existing.originCity === input.originCity &&
      existing.destinationCountry === input.destinationCountry &&
      existing.destinationCity === input.destinationCity &&
      existing.departureDate === input.departureDate &&
      existing.arrivalDate === input.arrivalDate &&
      existing.availableCapacityKg === input.availableCapacityKg &&
      (existing.notes ?? "") === (input.notes ?? "")
    );
  }
}
