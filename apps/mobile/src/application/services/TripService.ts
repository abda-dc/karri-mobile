import type { CreateTripDto } from "../dto/commands";
import type { EventPublisher } from "../../domain/events/DomainEvent";
import { createPlatformEvent, type TripCreated } from "../../domain/events/platformEvents";
import { ListingStatus } from "../../domain/shipment/Shipment";
import type { NewTrip, Trip } from "../../domain/trip/Trip";
import type { TripRepository } from "../../domain/trip/TripRepository";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import {
  DomainValidationError,
  optionalText,
  requireIsoDate,
  requirePositiveNumber,
  requireText,
} from "./validation";

export class TripService {
  constructor(
    private readonly trips: TripRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock = systemClock,
  ) {}

  async create(input: CreateTripDto): Promise<Trip> {
    const departureDate = requireIsoDate(input.departureDate, "departureDate");
    const arrivalDate = requireIsoDate(input.arrivalDate, "arrivalDate");

    if (arrivalDate < departureDate) {
      throw new DomainValidationError("arrivalDate cannot be before departureDate.");
    }

    const trip: NewTrip = {
      ownerId: requireText(input.ownerId, "ownerId", 128),
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
    const created = await this.trips.create(trip);
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
}
