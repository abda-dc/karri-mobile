import type { CustodyEvent } from "../custody/CustodyEvent";

/**
 * Shipment timelines project the canonical custody record instead of storing a
 * second operational lifecycle that could drift from booking and custody state.
 */
export type ShipmentLifecycleEvent = Omit<CustodyEvent, "shipmentId"> & {
  readonly shipmentId: string;
};

export function isShipmentLifecycleEvent(
  event: CustodyEvent,
): event is ShipmentLifecycleEvent {
  return typeof event.shipmentId === "string" && event.shipmentId.length > 0;
}
