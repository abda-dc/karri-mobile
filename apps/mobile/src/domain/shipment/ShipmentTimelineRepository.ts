import type { ShipmentLifecycleEvent } from "./ShipmentLifecycleEvent";

export interface ShipmentTimelineRepository {
  listByShipment(
    shipmentId: string,
  ): Promise<ReadonlyArray<ShipmentLifecycleEvent>>;
  watchByShipment(
    shipmentId: string,
    onData: (events: ReadonlyArray<ShipmentLifecycleEvent>) => void,
    onError: (error: Error) => void,
  ): () => void;
}
