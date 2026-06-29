import type { NewTrip, Trip } from "./Trip";

export interface TripRepository {
  create(trip: NewTrip): Promise<Trip>;
  findById(tripId: string): Promise<Trip | null>;
  listByOwner(ownerId: string): Promise<ReadonlyArray<Trip>>;
}
