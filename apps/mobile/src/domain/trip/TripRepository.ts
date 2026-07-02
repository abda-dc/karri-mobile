import type { NewTrip, Trip } from "./Trip";

export interface TripRepository {
  create(trip: NewTrip): Promise<Trip>;
  findById(tripId: string): Promise<Trip | null>;
  listActive(): Promise<ReadonlyArray<Trip>>;
  listByOwner(ownerId: string): Promise<ReadonlyArray<Trip>>;
  watchByOwner(
    ownerId: string,
    onData: (trips: ReadonlyArray<Trip>) => void,
    onError: (error: Error) => void,
  ): () => void;
  watchActive(
    onData: (trips: ReadonlyArray<Trip>) => void,
    onError: (error: Error) => void,
  ): () => void;
}
