import type { NewShipment, Shipment } from "./Shipment";

export interface ShipmentRepository {
  create(shipment: NewShipment): Promise<Shipment>;
  findById(shipmentId: string): Promise<Shipment | null>;
  listByOwner(ownerId: string): Promise<ReadonlyArray<Shipment>>;
  watchByOwner(
    ownerId: string,
    onData: (shipments: ReadonlyArray<Shipment>) => void,
    onError: (error: Error) => void,
  ): () => void;
  watchActive(
    onData: (shipments: ReadonlyArray<Shipment>) => void,
    onError: (error: Error) => void,
  ): () => void;
}
