import type { ShipmentLifecycleEvent } from "../../domain/shipment/ShipmentLifecycleEvent";
import type { ShipmentTimelineRepository } from "../../domain/shipment/ShipmentTimelineRepository";
import { requireText } from "./validation";

export class ShipmentTimelineService {
  constructor(private readonly timeline: ShipmentTimelineRepository) {}

  listByShipment(
    shipmentId: string,
  ): Promise<ReadonlyArray<ShipmentLifecycleEvent>> {
    return this.timeline.listByShipment(
      requireText(shipmentId, "shipmentId", 128),
    );
  }

  watchByShipment(
    shipmentId: string,
    onData: (events: ReadonlyArray<ShipmentLifecycleEvent>) => void,
    onError: (error: Error) => void,
  ): () => void {
    return this.timeline.watchByShipment(
      requireText(shipmentId, "shipmentId", 128),
      onData,
      onError,
    );
  }
}
