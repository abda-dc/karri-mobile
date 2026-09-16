import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingService } from "./BookingService";
import { BookingStatus } from "../../domain/booking/Booking";
import type { BookingRepository } from "../../domain/booking/BookingRepository";
import type { ShipmentRepository } from "../../domain/shipment/ShipmentRepository";
import type { TripRepository } from "../../domain/trip/TripRepository";
import type { EventPublisher } from "../../domain/events/DomainEvent";

describe("BookingService - Traveler Custody Acceptance", () => {
  const mockBookingRepository = {
    findById: vi.fn(),
    findRequestById: vi.fn(),
    createRequest: vi.fn(),
    listByParticipant: vi.fn(),
    saveTransition: vi.fn(),
  } as unknown as BookingRepository;

  const mockShipmentRepository = {
    findById: vi.fn(),
  } as unknown as ShipmentRepository;

  const mockTripRepository = {} as unknown as TripRepository;
  const mockEvents = { publish: vi.fn() } as unknown as EventPublisher;

  const clock = { now: () => "2026-07-11T12:00:00Z" };

  const service = new BookingService(
    mockBookingRepository,
    mockShipmentRepository,
    mockTripRepository,
    mockEvents,
    clock
  );

  const baseBooking = {
    id: "booking-123",
    shipmentId: "ship-123",
    travelerId: "traveler-1",
    senderId: "sender-1",
    status: BookingStatus.Accepted,
    statusHistory: [],
  };

  const baseShipment = {
    id: "ship-123",
    packageContentVersion: 1,
    safetyDeclaration: { declarationVersion: "v1" },
  };

  const validAcceptance = {
    bookingId: "booking-123",
    shipmentId: "ship-123",
    acceptedByUserId: "traveler-1",
    custodyVersion: 1,
    custodyPolicyVersion: "2026-07-v1",
    declarationVersion: "v1",
    packageContentVersion: 1,
    senderDeclarationVersion: "v1",
    inspection: {
      packageAvailableForInspection: true,
      packagingSecure: true,
      weightAppearsReasonable: true,
      noVisibleLeak: true,
      noVisibleBatteryDamage: true,
      noSuspiciousWiring: true,
      noUnusualOdorOrContamination: true,
      noVisibleConcealment: true,
      visibleContentsAppearConsistent: true,
    },
    acknowledgements: {
      personallyInspected: true,
      contentsAppearConsistent: true,
      noSuspiciousItemsObserved: true,
      safeTransportationAccepted: true,
      reasonableCustodyResponsibilityAccepted: true,
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws validation error if transitioning to in_transit without custodyAcceptance payload", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
      })
    ).rejects.toThrow("Traveler custody acceptance declaration is required to confirm pickup.");
  });

  it("throws validation error if one visual inspection checklist item is unchecked", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({ ...baseShipment } as any);

    const invalidInspection = {
      ...validAcceptance,
      inspection: {
        ...validAcceptance.inspection,
        packagingSecure: false, // unchecked
      },
    };

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: invalidInspection as any,
      })
    ).rejects.toThrow("All visual inspection checklist items must be successfully verified.");
  });

  it("throws validation error if one custody acknowledgement is missing/unchecked", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({ ...baseShipment } as any);

    const invalidAck = {
      ...validAcceptance,
      acknowledgements: {
        ...validAcceptance.acknowledgements,
        noSuspiciousItemsObserved: false, // unchecked
      },
    };

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: invalidAck as any,
      })
    ).rejects.toThrow("All custody acknowledgements must be accepted.");
  });

  it("throws validation error if performed by incorrect traveler ID (spoofed actor)", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "malicious-user",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: validAcceptance as any,
      })
    ).rejects.toThrow("Only the booking traveler can perform this transition.");
  });

  it("throws validation error if traveler ID in custody acceptance does not match booking traveler", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({ ...baseShipment } as any);

    const invalidTravelerId = {
      ...validAcceptance,
      acceptedByUserId: "other-user",
    };

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: invalidTravelerId as any,
      })
    ).rejects.toThrow("Declaration acceptedByUserId mismatch.");
  });

  it("throws validation error if booking ID in custody acceptance does not match request booking ID", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({ ...baseShipment } as any);

    const invalidBookingId = {
      ...validAcceptance,
      bookingId: "mismatched-booking",
    };

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: invalidBookingId as any,
      })
    ).rejects.toThrow("Declaration booking ID mismatch.");
  });

  it("throws validation error if shipment ID in custody acceptance does not match booking shipment ID", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({ ...baseShipment } as any);

    const invalidShipmentId = {
      ...validAcceptance,
      shipmentId: "mismatched-shipment",
    };

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: invalidShipmentId as any,
      })
    ).rejects.toThrow("Declaration shipment ID mismatch.");
  });

  it("throws validation error if packageContentVersion is outdated / mismatched", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({
      ...baseShipment,
      packageContentVersion: 2, // shipment updated to version 2
    } as any);

    const outdatedVersion = {
      ...validAcceptance,
      packageContentVersion: 1, // traveler inspected against version 1
    };

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: outdatedVersion as any,
      })
    ).rejects.toThrow("Outdated package content version. Senders safety declaration has changed since this booking was accepted.");
  });

  it("throws validation error if custodyPolicyVersion or declarationVersion is incorrect", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({ ...baseShipment } as any);

    const invalidPolicy = {
      ...validAcceptance,
      custodyVersion: 2, // incorrect version
    };

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: invalidPolicy as any,
      })
    ).rejects.toThrow("Invalid declaration custody policy version.");
  });

  it("throws validation error if booking is in an invalid state (e.g. cancelled)", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({
      ...baseBooking,
      status: BookingStatus.Cancelled, // cancelled booking
    } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({ ...baseShipment } as any);

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: validAcceptance as any,
      })
    ).rejects.toThrow("Booking cannot transition from cancelled to in_transit.");
  });

  it("throws validation error if duplicate custody acceptance attempted (already in_transit)", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({
      ...baseBooking,
      status: BookingStatus.InTransit, // already in transit
    } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({ ...baseShipment } as any);

    await expect(
      service.transition({
        bookingId: "booking-123",
        actorId: "traveler-1",
        nextStatus: BookingStatus.InTransit,
        custodyAcceptance: validAcceptance as any,
      })
    ).rejects.toThrow("Booking cannot transition from in_transit to in_transit.");
  });

  it("succeeds if all inputs, checklists, and acknowledgements are checked and valid", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce({ ...baseBooking } as any);
    vi.mocked(mockShipmentRepository.findById).mockResolvedValueOnce({ ...baseShipment } as any);
    vi.mocked(mockBookingRepository.saveTransition).mockResolvedValueOnce({
      booking: { ...baseBooking, status: BookingStatus.InTransit },
      request: null,
    } as any);

    const result = await service.transition({
      bookingId: "booking-123",
      actorId: "traveler-1",
      nextStatus: BookingStatus.InTransit,
      custodyAcceptance: validAcceptance as any,
    });

    expect(result.status).toBe(BookingStatus.InTransit);
    expect(mockBookingRepository.saveTransition).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingStatus.InTransit }),
      null,
      expect.objectContaining({ eventType: "pickup_confirmed" }),
      expect.objectContaining({ acceptedAt: "2026-07-11T12:00:00Z" })
    );
  });
});

describe("BookingService - Atomic Booking Acceptance Gateway", () => {
  const mockBookingRepository = {
    findById: vi.fn(),
    findRequestById: vi.fn(),
    createRequest: vi.fn(),
    listByParticipant: vi.fn(),
    saveTransition: vi.fn(),
  } as unknown as BookingRepository;

  const mockShipmentRepository = {
    findById: vi.fn(),
  } as unknown as ShipmentRepository;

  const mockTripRepository = {} as unknown as TripRepository;
  const mockEvents = { publish: vi.fn() } as unknown as EventPublisher;
  const mockAcceptanceGateway = {
    acceptBooking: vi.fn(),
  };
  const mockCancellationGateway = {
    cancelBooking: vi.fn(),
    declineBooking: vi.fn(),
  };

  const clock = { now: () => "2026-07-11T12:00:00Z" };

  const serviceWithGateway = new BookingService(
    mockBookingRepository,
    mockShipmentRepository,
    mockTripRepository,
    mockEvents,
    clock,
    mockAcceptanceGateway as any,
  );

  const serviceWithAllGateways = new BookingService(
    mockBookingRepository,
    mockShipmentRepository,
    mockTripRepository,
    mockEvents,
    clock,
    mockAcceptanceGateway as any,
    undefined,
    mockCancellationGateway as any,
  );


  const pendingBooking = {
    id: "booking-pending",
    shipmentId: "ship-1",
    tripId: "trip-1",
    bookingRequestId: "req-1",
    travelerId: "traveler-1",
    senderId: "sender-1",
    status: BookingStatus.Pending,
    statusHistory: [],
    createdAt: "2026-07-10T10:00:00Z",
    updatedAt: "2026-07-10T10:00:00Z",
  };

  const acceptedBooking = {
    ...pendingBooking,
    status: BookingStatus.Accepted,
    reservedWeightKg: 5,
    updatedAt: "2026-07-11T12:00:00Z",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("delegates acceptance to BookingAcceptanceGateway and publishes event", async () => {
    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(pendingBooking as any)
      .mockResolvedValueOnce(acceptedBooking as any);

    mockAcceptanceGateway.acceptBooking.mockResolvedValueOnce({
      bookingId: "booking-pending",
      status: "accepted",
      reservedWeightKg: 5,
      acceptedAt: "2026-07-11T12:00:00Z",
    });

    const result = await serviceWithGateway.transition({
      bookingId: "booking-pending",
      actorId: "traveler-1",
      nextStatus: BookingStatus.Accepted,
      note: "Ready to pick up",
    });

    expect(mockAcceptanceGateway.acceptBooking).toHaveBeenCalledWith({
      bookingId: "booking-pending",
      actorId: "traveler-1",
      note: "Ready to pick up",
      location: undefined,
    });
    expect(mockBookingRepository.saveTransition).not.toHaveBeenCalled();
    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "booking.accepted",
        aggregateId: "booking-pending",
      })
    );
    expect(result.status).toBe(BookingStatus.Accepted);
  });

  it("propagates capacity conflict error from BookingAcceptanceGateway without publishing", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(pendingBooking as any);
    mockAcceptanceGateway.acceptBooking.mockRejectedValueOnce(
      new Error("This trip no longer has enough available capacity.")
    );

    await expect(
      serviceWithGateway.transition({
        bookingId: "booking-pending",
        actorId: "traveler-1",
        nextStatus: BookingStatus.Accepted,
      })
    ).rejects.toThrow("This trip no longer has enough available capacity.");

    expect(mockEvents.publish).not.toHaveBeenCalled();
    expect(mockBookingRepository.saveTransition).not.toHaveBeenCalled();
  });

  it("propagates shipment exclusivity collision error without publishing", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(pendingBooking as any);
    mockAcceptanceGateway.acceptBooking.mockRejectedValueOnce(
      new Error("This shipment has already been accepted by another traveler.")
    );

    await expect(
      serviceWithGateway.transition({
        bookingId: "booking-pending",
        actorId: "traveler-1",
        nextStatus: BookingStatus.Accepted,
      })
    ).rejects.toThrow("This shipment has already been accepted by another traveler.");

    expect(mockEvents.publish).not.toHaveBeenCalled();
    expect(mockBookingRepository.saveTransition).not.toHaveBeenCalled();
  });

  it("does not call acceptanceGateway when transitioning to non-accepted status (e.g. declined)", async () => {
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(pendingBooking as any);
    vi.mocked(mockBookingRepository.findRequestById).mockResolvedValueOnce({
      id: "req-1",
      status: "pending",
    } as any);
    vi.mocked(mockBookingRepository.saveTransition).mockResolvedValueOnce({
      booking: { ...pendingBooking, status: BookingStatus.Declined },
      request: { id: "req-1", status: "declined" },
    } as any);

    const result = await serviceWithGateway.transition({
      bookingId: "booking-pending",
      actorId: "traveler-1",
      nextStatus: BookingStatus.Declined,
      note: "Not enough space",
    });

    expect(mockAcceptanceGateway.acceptBooking).not.toHaveBeenCalled();
    expect(mockBookingRepository.saveTransition).toHaveBeenCalled();
    expect(result.status).toBe(BookingStatus.Declined);
  });

  it("delegates cancellation to BookingCancellationGateway and publishes event", async () => {
    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(acceptedBooking as any)
      .mockResolvedValueOnce({ ...acceptedBooking, status: BookingStatus.Cancelled } as any);

    mockCancellationGateway.cancelBooking.mockResolvedValueOnce({
      success: true,
      bookingId: "booking-pending",
      status: "cancelled",
      cancelled: true,
      idempotent: false,
      capacityRestored: true,
      shipmentReleased: true,
    });

    const result = await serviceWithAllGateways.transition({
      bookingId: "booking-pending",
      actorId: "traveler-1",
      nextStatus: BookingStatus.Cancelled,
      note: "Emergency",
    });

    expect(mockCancellationGateway.cancelBooking).toHaveBeenCalledWith({
      bookingId: "booking-pending",
      actorId: "traveler-1",
      note: "Emergency",
    });
    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "booking.cancelled",
        aggregateId: "booking-pending",
      })
    );
    expect(result.status).toBe(BookingStatus.Cancelled);
  });

  it("delegates decline to BookingCancellationGateway and publishes event", async () => {
    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(pendingBooking as any)
      .mockResolvedValueOnce({ ...pendingBooking, status: BookingStatus.Declined } as any);

    mockCancellationGateway.declineBooking.mockResolvedValueOnce({
      success: true,
      bookingId: "booking-pending",
      status: "declined",
      declined: true,
      idempotent: false,
    });

    const result = await serviceWithAllGateways.transition({
      bookingId: "booking-pending",
      actorId: "traveler-1",
      nextStatus: BookingStatus.Declined,
      note: "Cannot carry",
    });

    expect(mockCancellationGateway.declineBooking).toHaveBeenCalledWith({
      bookingId: "booking-pending",
      actorId: "traveler-1",
      note: "Cannot carry",
    });
    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "booking.declined",
        aggregateId: "booking-pending",
      })
    );
    expect(result.status).toBe(BookingStatus.Declined);
  });
});


describe("BookingService - Custody Transition Gateway (R05)", () => {
  const mockBookingRepository = {
    findById: vi.fn(),
    findRequestById: vi.fn(),
    createRequest: vi.fn(),
    listByParticipant: vi.fn(),
    saveTransition: vi.fn(),
  } as unknown as BookingRepository;

  const mockShipmentRepository = {
    findById: vi.fn(),
  } as unknown as ShipmentRepository;

  const mockTripRepository = {} as unknown as TripRepository;
  const mockEvents = { publish: vi.fn() } as unknown as EventPublisher;
  const clock = { now: () => "2026-07-11T12:00:00Z" };

  const mockCustodyGateway = {
    confirmPickup: vi.fn(),
    confirmDelivery: vi.fn(),
    completeBooking: vi.fn(),
    recordTravelEvent: vi.fn(),
  };

  const serviceWithCustody = new BookingService(
    mockBookingRepository,
    mockShipmentRepository,
    mockTripRepository,
    mockEvents,
    clock,
    undefined,
    mockCustodyGateway as any,
  );

  const acceptedBooking = {
    id: "booking-accepted-1",
    shipmentId: "ship-1",
    tripId: "trip-1",
    travelerId: "traveler-1",
    senderId: "sender-1",
    status: BookingStatus.Accepted,
    statusHistory: [],
  };

  const inTransitBooking = {
    ...acceptedBooking,
    status: BookingStatus.InTransit,
  };

  const deliveredBooking = {
    ...acceptedBooking,
    status: BookingStatus.Delivered,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("delegates InTransit transition to custodyGateway.confirmPickup", async () => {
    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(acceptedBooking as any)
      .mockResolvedValueOnce(inTransitBooking as any);

    mockCustodyGateway.confirmPickup.mockResolvedValueOnce({
      success: true,
      bookingId: acceptedBooking.id,
      status: "in_transit",
      eventId: "booking-accepted-1__pickup_confirmed",
      alreadyTransitioned: false,
    });

    const dummyAcceptance = {
      bookingId: acceptedBooking.id,
      shipmentId: acceptedBooking.shipmentId,
      acceptedByUserId: "traveler-1",
      custodyVersion: 1,
      custodyPolicyVersion: "2026-07-v1",
      declarationVersion: "v1",
      packageContentVersion: 1,
      senderDeclarationVersion: "v1",
      inspection: {} as any,
      acknowledgements: {} as any,
    };

    const result = await serviceWithCustody.transition({
      bookingId: acceptedBooking.id,
      actorId: "traveler-1",
      nextStatus: BookingStatus.InTransit,
      location: "Addis Ababa",
      note: "Picked up package",
      custodyAcceptance: dummyAcceptance,
    });

    expect(mockCustodyGateway.confirmPickup).toHaveBeenCalledWith({
      bookingId: acceptedBooking.id,
      actorId: "traveler-1",
      location: "Addis Ababa",
      note: "Picked up package",
      custodyAcceptance: dummyAcceptance,
    });

    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "package.picked_up" }),
    );
    expect(mockBookingRepository.saveTransition).not.toHaveBeenCalled();
    expect(result.status).toBe(BookingStatus.InTransit);
  });

  it("delegates Delivered transition to custodyGateway.confirmDelivery", async () => {
    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(inTransitBooking as any)
      .mockResolvedValueOnce(deliveredBooking as any);

    mockCustodyGateway.confirmDelivery.mockResolvedValueOnce({
      success: true,
      bookingId: inTransitBooking.id,
      status: "delivered",
      eventId: "booking-accepted-1__delivery_confirmed",
      alreadyTransitioned: false,
    });

    const result = await serviceWithCustody.transition({
      bookingId: inTransitBooking.id,
      actorId: "traveler-1",
      nextStatus: BookingStatus.Delivered,
      location: "Washington Dulles",
      note: "Delivered to receiver",
    });

    expect(mockCustodyGateway.confirmDelivery).toHaveBeenCalledWith({
      bookingId: inTransitBooking.id,
      actorId: "traveler-1",
      location: "Washington Dulles",
      note: "Delivered to receiver",
    });

    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "package.delivered" }),
    );
    expect(mockBookingRepository.saveTransition).not.toHaveBeenCalled();
    expect(result.status).toBe(BookingStatus.Delivered);
  });

  it("delegates Completed transition to custodyGateway.completeBooking", async () => {
    const completedBooking = {
      ...deliveredBooking,
      status: BookingStatus.Completed,
    };

    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(deliveredBooking as any)
      .mockResolvedValueOnce(completedBooking as any);

    mockCustodyGateway.completeBooking.mockResolvedValueOnce({
      success: true,
      bookingId: deliveredBooking.id,
      status: "completed",
      alreadyTransitioned: false,
    });

    const result = await serviceWithCustody.transition({
      bookingId: deliveredBooking.id,
      actorId: "sender-1",
      nextStatus: BookingStatus.Completed,
    });

    expect(mockCustodyGateway.completeBooking).toHaveBeenCalledWith({
      bookingId: deliveredBooking.id,
      actorId: "sender-1",
    });

    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "shipment.completed" }),
    );
    expect(mockBookingRepository.saveTransition).not.toHaveBeenCalled();
    expect(result.status).toBe(BookingStatus.Completed);
  });
});

describe("BookingService - Creation Gateway and Retry Deduplication (R09)", () => {
  const mockBookingRepository = {
    findById: vi.fn(),
    createRequest: vi.fn(),
  } as unknown as BookingRepository;
  const mockShipmentRepository = {
    findById: vi.fn(),
  } as unknown as ShipmentRepository;
  const mockTripRepository = {
    findById: vi.fn(),
  } as unknown as TripRepository;
  const mockEvents = { publish: vi.fn() } as unknown as EventPublisher;
  const clock = { now: () => "2026-09-16T12:00:00Z" };

  const mockCreationGateway = {
    requestBooking: vi.fn(),
  };
  const mockAcceptanceGateway = {
    acceptBooking: vi.fn(),
  };
  const mockCustodyGateway = {
    confirmPickup: vi.fn(),
    confirmDelivery: vi.fn(),
    completeBooking: vi.fn(),
    recordTravelEvent: vi.fn(),
  };
  const mockCancellationGateway = {
    cancelBooking: vi.fn(),
    declineBooking: vi.fn(),
  };

  const service = new BookingService(
    mockBookingRepository,
    mockShipmentRepository,
    mockTripRepository,
    mockEvents,
    clock,
    mockAcceptanceGateway as any,
    mockCustodyGateway as any,
    mockCancellationGateway as any,
    mockCreationGateway as any,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("delegates request to creationGateway and publishes booking.requested if newly created", async () => {
    const booking = {
      id: "booking-r09-1",
      shipmentId: "ship-1",
      tripId: "trip-1",
      senderId: "sender-1",
      travelerId: "traveler-1",
      status: BookingStatus.Pending,
      createdAt: "2026-09-16T12:00:00Z",
    };

    mockCreationGateway.requestBooking.mockResolvedValueOnce({
      success: true,
      bookingId: booking.id,
      bookingRequestId: "req-1",
      status: "pending",
      alreadyExisted: false,
      rebooked: false,
      tripId: "trip-1",
      shipmentId: "ship-1",
    });
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(booking as any);

    const result = await service.request({
      shipmentId: "ship-1",
      tripId: "trip-1",
      senderId: "sender-1",
      travelerId: "traveler-1",
      operationId: "op-test-1",
    });

    expect(result.id).toBe(booking.id);
    expect(mockCreationGateway.requestBooking).toHaveBeenCalledWith({
      shipmentId: "ship-1",
      tripId: "trip-1",
      senderId: "sender-1",
      travelerId: "traveler-1",
      message: undefined,
      operationId: "op-test-1",
    });
    expect(mockEvents.publish).toHaveBeenCalledTimes(1);
    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "booking.requested" }),
    );
  });

  it("delegates request to creationGateway and SUPPRESSES duplicate event if alreadyExisted: true", async () => {
    const booking = {
      id: "booking-r09-dup",
      shipmentId: "ship-1",
      tripId: "trip-1",
      senderId: "sender-1",
      travelerId: "traveler-1",
      status: BookingStatus.Pending,
      createdAt: "2026-09-16T12:00:00Z",
    };

    mockCreationGateway.requestBooking.mockResolvedValueOnce({
      success: true,
      bookingId: booking.id,
      bookingRequestId: "req-1",
      status: "pending",
      alreadyExisted: true,
      rebooked: false,
      tripId: "trip-1",
      shipmentId: "ship-1",
    });
    vi.mocked(mockBookingRepository.findById).mockResolvedValueOnce(booking as any);

    const result = await service.request({
      shipmentId: "ship-1",
      tripId: "trip-1",
      senderId: "sender-1",
      travelerId: "traveler-1",
      operationId: "op-test-retry",
    });

    expect(result.id).toBe(booking.id);
    // Duplicate side effect suppressed!
    expect(mockEvents.publish).not.toHaveBeenCalled();
  });

  it("suppresses duplicate event on alreadyAccepted: true in transition to accepted", async () => {
    const booking = {
      id: "booking-acc",
      shipmentId: "ship-1",
      tripId: "trip-1",
      senderId: "sender-1",
      travelerId: "traveler-1",
      status: BookingStatus.Pending,
    };

    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, status: BookingStatus.Accepted } as any);

    mockAcceptanceGateway.acceptBooking.mockResolvedValueOnce({
      success: true,
      bookingId: booking.id,
      alreadyAccepted: true,
    });

    await service.transition({
      bookingId: booking.id,
      actorId: "traveler-1",
      nextStatus: BookingStatus.Accepted,
    });

    expect(mockEvents.publish).not.toHaveBeenCalled();
  });

  it("suppresses duplicate event on alreadyTransitioned: true in confirmPickup", async () => {
    const booking = {
      id: "booking-pickup",
      shipmentId: "ship-1",
      tripId: "trip-1",
      senderId: "sender-1",
      travelerId: "traveler-1",
      status: BookingStatus.Accepted,
    };

    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, status: BookingStatus.InTransit } as any);

    mockCustodyGateway.confirmPickup.mockResolvedValueOnce({
      success: true,
      bookingId: booking.id,
      status: "in_transit",
      alreadyTransitioned: true,
    });

    await service.transition({
      bookingId: booking.id,
      actorId: "traveler-1",
      nextStatus: BookingStatus.InTransit,
      custodyAcceptance: { dummy: true } as any,
    });

    expect(mockEvents.publish).not.toHaveBeenCalled();
  });

  it("suppresses duplicate event on idempotent: true in cancelBooking", async () => {
    const booking = {
      id: "booking-cancel",
      shipmentId: "ship-1",
      tripId: "trip-1",
      senderId: "sender-1",
      travelerId: "traveler-1",
      status: BookingStatus.Pending,
    };

    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, status: BookingStatus.Cancelled } as any);

    mockCancellationGateway.cancelBooking.mockResolvedValueOnce({
      success: true,
      bookingId: booking.id,
      status: "cancelled",
      cancelled: false,
      idempotent: true,
      capacityRestored: false,
      shipmentReleased: false,
    });

    await service.transition({
      bookingId: booking.id,
      actorId: "sender-1",
      nextStatus: BookingStatus.Cancelled,
    });

    expect(mockEvents.publish).not.toHaveBeenCalled();
  });

  it("suppresses duplicate event on idempotent: true in declineBooking", async () => {
    const booking = {
      id: "booking-decline",
      shipmentId: "ship-1",
      tripId: "trip-1",
      senderId: "sender-1",
      travelerId: "traveler-1",
      status: BookingStatus.Pending,
    };

    vi.mocked(mockBookingRepository.findById)
      .mockResolvedValueOnce(booking as any)
      .mockResolvedValueOnce({ ...booking, status: BookingStatus.Declined } as any);

    mockCancellationGateway.declineBooking.mockResolvedValueOnce({
      success: true,
      bookingId: booking.id,
      status: "declined",
      declined: false,
      idempotent: true,
    });

    await service.transition({
      bookingId: booking.id,
      actorId: "traveler-1",
      nextStatus: BookingStatus.Declined,
    });

    expect(mockEvents.publish).not.toHaveBeenCalled();
  });
});
