import type { RequestBookingDto, TransitionBookingDto } from "../dto/commands";
import {
  BookingRequestStatus,
  BookingStatus,
  type Booking,
  type BookingRequest,
} from "../../domain/booking/Booking";
import type { BookingRepository } from "../../domain/booking/BookingRepository";
import { transitionBooking } from "../../domain/booking/bookingStateMachine";
import type { EventPublisher } from "../../domain/events/DomainEvent";
import {
  createPlatformEvent,
  type BookingAccepted,
  type BookingCancelled,
  type BookingDeclined,
  type BookingExpired,
  type BookingRequested,
  type PackageDelivered,
  type PackagePickedUp,
  type PlatformDomainEvent,
} from "../../domain/events/platformEvents";
import { ListingStatus } from "../../domain/shipment/Shipment";
import type { ShipmentRepository } from "../../domain/shipment/ShipmentRepository";
import type { TripRepository } from "../../domain/trip/TripRepository";
import {
  CustodyEventType,
  type NewCustodyEvent,
} from "../../domain/custody/CustodyEvent";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import { DomainValidationError, requireText } from "./validation";

const requestStatusByBookingStatus: Partial<
  Record<BookingStatus, BookingRequest["status"]>
> = {
  [BookingStatus.Accepted]: BookingRequestStatus.Accepted,
  [BookingStatus.Declined]: BookingRequestStatus.Declined,
  [BookingStatus.Cancelled]: BookingRequestStatus.Cancelled,
  [BookingStatus.Expired]: BookingRequestStatus.Expired,
};

export interface ParticipantBookingActivity {
  readonly bookings: ReadonlyArray<Booking>;
  readonly requests: ReadonlyArray<BookingRequest>;
}

export class BookingService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly shipments: ShipmentRepository,
    private readonly trips: TripRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock = systemClock,
  ) {}

  async request(input: RequestBookingDto): Promise<Booking> {
    const senderId = requireText(input.senderId, "senderId", 128);
    const travelerId = requireText(input.travelerId, "travelerId", 128);

    if (senderId === travelerId) {
      throw new DomainValidationError("A sender cannot request a booking from the same account.");
    }

    const shipmentId = requireText(input.shipmentId, "shipmentId", 128);
    const tripId = requireText(input.tripId, "tripId", 128);
    const [shipment, trip] = await Promise.all([
      this.shipments.findById(shipmentId),
      this.trips.findById(tripId),
    ]);

    if (!shipment || !trip) {
      throw new DomainValidationError("The shipment and trip must both exist.");
    }

    if (shipment.ownerId !== senderId || trip.ownerId !== travelerId) {
      throw new DomainValidationError("Booking participants must own the selected listings.");
    }

    if (shipment.status !== ListingStatus.Active || trip.status !== ListingStatus.Active) {
      throw new DomainValidationError("Booking requires active shipment and trip listings.");
    }

    const normalizeCorridorPart = (value: string): string => value.trim().toLocaleLowerCase();
    const shipmentCorridor = [
      shipment.originCountry,
      shipment.originCity,
      shipment.destinationCountry,
      shipment.destinationCity,
    ].map(normalizeCorridorPart);
    const tripCorridor = [
      trip.originCountry,
      trip.originCity,
      trip.destinationCountry,
      trip.destinationCity,
    ].map(normalizeCorridorPart);

    if (shipmentCorridor.some((part, index) => part !== tripCorridor[index])) {
      throw new DomainValidationError("Shipment and trip corridors must match.");
    }

    if (shipment.weightKg > trip.availableCapacityKg) {
      throw new DomainValidationError("The trip does not have enough available capacity.");
    }

    const created = await this.bookings.createRequest({
      request: {
        shipmentId,
        tripId,
        senderId,
        travelerId,
        message: (input.message ?? "").trim().replace(/\s+/g, " ").slice(0, 500),
        status: BookingRequestStatus.Pending,
      },
      booking: {
        shipmentId,
        tripId,
        senderId,
        travelerId,
        status: BookingStatus.Pending,
        statusHistory: [
          { status: BookingStatus.Pending, changedAt: this.clock.now(), changedBy: senderId },
        ],
      },
      initialCustodyEvent: {
        eventType: CustodyEventType.ShipmentCreated,
        performedBy: senderId,
        location: null,
        note: "Booking request created for this shipment.",
        metadata: { bookingStatus: BookingStatus.Pending },
      },
    });
    const occurredAt = created.booking.createdAt ?? this.clock.now();

    this.events.publish(
      createPlatformEvent<BookingRequested>({
        type: "booking.requested",
        aggregateId: created.booking.id,
        actorId: senderId,
        occurredAt,
        payload: {
          requestId: created.request.id,
          senderId,
          travelerId,
          recipientIds: [travelerId],
        },
      }),
    );

    return created.booking;
  }

  async transition(input: TransitionBookingDto): Promise<Booking> {
    const booking = await this.bookings.findById(input.bookingId);

    if (!booking) {
      throw new DomainValidationError("Booking was not found.");
    }

    this.assertActorCanTransition(booking, input.actorId, input.nextStatus);

    const occurredAt = this.clock.now();
    const transitioned = transitionBooking(
      booking,
      input.nextStatus,
      occurredAt,
      input.actorId,
    );
    const requestStatus = requestStatusByBookingStatus[input.nextStatus];
    let request: BookingRequest | null = null;

    if (requestStatus) {
      const currentRequest = await this.bookings.findRequestById(booking.bookingRequestId);
      request = currentRequest
        ? { ...currentRequest, status: requestStatus, updatedAt: occurredAt }
        : null;
    }

    const lifecycleCustodyEvent = this.createLifecycleCustody(transitioned, input);
    const saved = await this.bookings.saveTransition(
      transitioned,
      request,
      lifecycleCustodyEvent,
    );
    const event = this.createTransitionEvent(saved.booking, input.actorId, occurredAt);

    if (event) {
      this.events.publish(event);
    }

    return saved.booking;
  }

  findById(bookingId: string): Promise<Booking | null> {
    return this.bookings.findById(bookingId);
  }

  listForParticipant(userId: string): Promise<ReadonlyArray<Booking>> {
    return this.bookings.listByParticipant(userId);
  }

  watchForParticipant(
    userId: string,
    onData: (bookings: ReadonlyArray<Booking>) => void,
    onError: (error: Error) => void,
  ): () => void {
    return this.bookings.watchByParticipant(userId, onData, onError);
  }

  watchRequestsForParticipant(
    userId: string,
    onData: (requests: ReadonlyArray<BookingRequest>) => void,
    onError: (error: Error) => void,
  ): () => void {
    return this.bookings.watchRequestsByParticipant(userId, onData, onError);
  }

  watchActivityForParticipant(
    userId: string,
    onData: (activity: ParticipantBookingActivity) => void,
    onError: (error: Error) => void,
  ): () => void {
    let bookings: ReadonlyArray<Booking> = [];
    let requests: ReadonlyArray<BookingRequest> = [];
    let bookingsReady = false;
    let requestsReady = false;
    let active = true;
    const unsubscribers: Array<() => void> = [];
    const stop = () => {
      if (!active) {
        return;
      }

      active = false;
      for (const unsubscribe of unsubscribers.splice(0)) {
        unsubscribe();
      }
    };
    const emit = () => {
      if (active && bookingsReady && requestsReady) {
        onData({ bookings, requests });
      }
    };
    const fail = (error: Error) => {
      if (!active) {
        return;
      }

      stop();
      onError(error);
    };

    try {
      unsubscribers.push(
        this.watchForParticipant(
          userId,
          (nextBookings) => {
            bookings = nextBookings;
            bookingsReady = true;
            emit();
          },
          fail,
        ),
      );
      unsubscribers.push(
        this.watchRequestsForParticipant(
          userId,
          (nextRequests) => {
            requests = nextRequests;
            requestsReady = true;
            emit();
          },
          fail,
        ),
      );
    } catch (error) {
      stop();
      throw error;
    }

    return stop;
  }

  private assertActorCanTransition(
    booking: Booking,
    actorId: string,
    nextStatus: BookingStatus,
  ): void {
    const travelerTransitions: ReadonlyArray<BookingStatus> = [
      BookingStatus.Accepted,
      BookingStatus.Declined,
      BookingStatus.InTransit,
      BookingStatus.Delivered,
    ];
    const senderTransitions: ReadonlyArray<BookingStatus> = [
      BookingStatus.Cancelled,
      BookingStatus.Completed,
    ];
    const requiresTraveler = travelerTransitions.includes(nextStatus);
    const requiresSender = senderTransitions.includes(nextStatus);

    if (nextStatus === BookingStatus.Expired && actorId !== "system") {
      throw new DomainValidationError("Only the trusted system actor can expire a booking.");
    }

    if (requiresTraveler && actorId !== booking.travelerId) {
      throw new DomainValidationError("Only the booking traveler can perform this transition.");
    }

    if (requiresSender && actorId !== booking.senderId) {
      throw new DomainValidationError("Only the booking sender can perform this transition.");
    }
  }

  private createTransitionEvent(
    booking: Booking,
    actorId: string,
    occurredAt: string,
  ): PlatformDomainEvent | null {
    const common = {
      aggregateId: booking.id,
      actorId,
      occurredAt,
    };

    switch (booking.status) {
      case BookingStatus.Accepted:
        return createPlatformEvent<BookingAccepted>({
          type: "booking.accepted",
          ...common,
          payload: { recipientIds: [booking.senderId] },
        });
      case BookingStatus.Declined:
        return createPlatformEvent<BookingDeclined>({
          type: "booking.declined",
          ...common,
          payload: { recipientIds: [booking.senderId] },
        });
      case BookingStatus.Cancelled:
        return createPlatformEvent<BookingCancelled>({
          type: "booking.cancelled",
          ...common,
          payload: { recipientIds: [booking.travelerId] },
        });
      case BookingStatus.Expired:
        return createPlatformEvent<BookingExpired>({
          type: "booking.expired",
          ...common,
          payload: { recipientIds: [booking.senderId, booking.travelerId] },
        });
      case BookingStatus.InTransit:
        return createPlatformEvent<PackagePickedUp>({
          type: "package.picked_up",
          ...common,
          payload: { recipientIds: [booking.senderId] },
        });
      case BookingStatus.Delivered:
        return createPlatformEvent<PackageDelivered>({
          type: "package.delivered",
          ...common,
          payload: { recipientIds: [booking.senderId] },
        });
      default:
        return null;
    }
  }

  private createLifecycleCustody(
    booking: Booking,
    input: TransitionBookingDto,
  ): NewCustodyEvent | null {
    const eventTypeByStatus: Partial<Record<BookingStatus, CustodyEventType>> = {
      [BookingStatus.Accepted]: CustodyEventType.TravelerAccepted,
      [BookingStatus.InTransit]: CustodyEventType.PickupConfirmed,
      [BookingStatus.Delivered]: CustodyEventType.DeliveryConfirmed,
      [BookingStatus.Completed]: CustodyEventType.Completed,
    };
    const eventType = eventTypeByStatus[booking.status];

    if (!eventType) {
      return null;
    }

    return {
      bookingId: booking.id,
      eventType,
      performedBy: input.actorId,
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
      metadata: { bookingStatus: booking.status },
    };
  }
}
