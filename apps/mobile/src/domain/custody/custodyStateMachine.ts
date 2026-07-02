import {
  CustodyEventType,
  type CustodyEvent,
} from "./CustodyEvent";

export type CustodyState = CustodyEventType | null;

const allowedTransitions: Readonly<
  Record<CustodyEventType, ReadonlyArray<CustodyEventType>>
> = {
  [CustodyEventType.ShipmentCreated]: [CustodyEventType.TravelerAccepted],
  [CustodyEventType.TravelerAccepted]: [CustodyEventType.PickupConfirmed],
  [CustodyEventType.PickupConfirmed]: [
    CustodyEventType.AirportDeparture,
    CustodyEventType.DeliveryConfirmed,
  ],
  [CustodyEventType.AirportDeparture]: [
    CustodyEventType.AirportArrival,
    CustodyEventType.DeliveryConfirmed,
  ],
  [CustodyEventType.AirportArrival]: [CustodyEventType.DeliveryConfirmed],
  [CustodyEventType.DeliveryConfirmed]: [CustodyEventType.Completed],
  [CustodyEventType.Completed]: [],
};

export class InvalidCustodyTransitionError extends Error {
  constructor(currentState: CustodyState, nextEventType: CustodyEventType) {
    super(
      `Custody cannot transition from ${currentState ?? "no events"} to ${nextEventType}.`,
    );
    this.name = "InvalidCustodyTransitionError";
  }
}

export function getCurrentCustodyState(
  events: ReadonlyArray<CustodyEvent>,
): CustodyState {
  return events.length === 0 ? null : events[events.length - 1].eventType;
}

export function getAllowedCustodyTransitions(
  currentState: CustodyState,
): ReadonlyArray<CustodyEventType> {
  return currentState === null
    ? [CustodyEventType.ShipmentCreated]
    : [...allowedTransitions[currentState]];
}

export function canAppendCustodyEvent(
  events: ReadonlyArray<CustodyEvent>,
  nextEventType: CustodyEventType,
): boolean {
  if (events.some(({ eventType }) => eventType === nextEventType)) {
    return false;
  }

  return getAllowedCustodyTransitions(getCurrentCustodyState(events)).includes(
    nextEventType,
  );
}

export function assertCanAppendCustodyEvent(
  events: ReadonlyArray<CustodyEvent>,
  nextEventType: CustodyEventType,
): void {
  if (!canAppendCustodyEvent(events, nextEventType)) {
    throw new InvalidCustodyTransitionError(
      getCurrentCustodyState(events),
      nextEventType,
    );
  }
}
