import type { NewShipment, Shipment } from "./Shipment";

export interface ShipmentRepository {
  create(shipment: NewShipment): Promise<Shipment>;
  findById(shipmentId: string): Promise<Shipment | null>;
  listByOwner(ownerId: string): Promise<ReadonlyArray<Shipment>>;
}
