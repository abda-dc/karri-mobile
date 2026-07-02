import { BookingStatus, type Booking } from "../../domain/booking/Booking";
import { CustodyEventType } from "../../domain/custody/CustodyEvent";

export const bookingStatusLabels: Readonly<Record<BookingStatus, string>> = {
  [BookingStatus.Pending]: "Booking requested",
  [BookingStatus.Accepted]: "Booking accepted",
  [BookingStatus.InTransit]: "Shipment in transit",
  [BookingStatus.Delivered]: "Shipment delivered",
  [BookingStatus.Completed]: "Shipment completed",
  [BookingStatus.Cancelled]: "Booking cancelled",
  [BookingStatus.Declined]: "Booking declined",
  [BookingStatus.Expired]: "Booking expired",
};

export const custodyEventLabels: Readonly<Record<CustodyEventType, string>> = {
  [CustodyEventType.ShipmentCreated]: "Shipment added to booking",
  [CustodyEventType.TravelerAccepted]: "Traveler accepted responsibility",
  [CustodyEventType.PickupConfirmed]: "Shipment picked up",
  [CustodyEventType.AirportDeparture]: "Shipment departed",
  [CustodyEventType.AirportArrival]: "Shipment arrived",
  [CustodyEventType.DeliveryConfirmed]: "Delivery confirmed",
  [CustodyEventType.Completed]: "Shipment completed",
};

export function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

export function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Time pending";
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : "Time unavailable";
}

export function actorLabel(
  actorId: string | null,
  booking: Booking,
  currentUserId: string,
): string | undefined {
  if (!actorId) {
    return undefined;
  }
  if (actorId === currentUserId) {
    return "You";
  }
  if (actorId === booking.senderId) {
    return "Sender";
  }
  if (actorId === booking.travelerId) {
    return "Traveler";
  }
  if (actorId === "system") {
    return "Karri";
  }
  return `Participant ${shortId(actorId)}`;
}

export interface RecommendedAction {
  readonly title: string;
  readonly explanation: string;
  readonly owner: "sender" | "traveler" | "none";
}

export function getRecommendedAction(booking: Booking): RecommendedAction {
  switch (booking.status) {
    case BookingStatus.Pending:
      return {
        title: "Review the booking request",
        explanation: "The traveler can accept or decline. The sender can cancel while waiting.",
        owner: "traveler",
      };
    case BookingStatus.Accepted:
      return {
        title: "Confirm shipment pickup",
        explanation: "The traveler should confirm only after taking responsibility for the shipment.",
        owner: "traveler",
      };
    case BookingStatus.InTransit:
      return {
        title: "Keep the journey current",
        explanation: "The traveler can record travel progress, then confirm delivery.",
        owner: "traveler",
      };
    case BookingStatus.Delivered:
      return {
        title: "Confirm completion",
        explanation: "The sender should complete the booking after checking the recorded delivery.",
        owner: "sender",
      };
    case BookingStatus.Completed:
      return {
        title: "Share a review",
        explanation: "Each participant may leave one review about the completed journey.",
        owner: "none",
      };
    default:
      return {
        title: "No action needed",
        explanation: "This booking has ended and no further lifecycle action is available.",
        owner: "none",
      };
  }
}
