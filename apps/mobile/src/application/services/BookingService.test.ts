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
