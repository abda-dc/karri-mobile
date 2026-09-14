import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandoffService } from "./HandoffService";
import type { HandoffRepository } from "../../domain/handoff/HandoffRepository";
import type { BookingHandoffAgreement } from "../../domain/handoff/HandoffAgreement";

describe("HandoffService", () => {
  const clock = { now: () => "2026-03-01T12:00:00Z" };

  const baseAgreement: BookingHandoffAgreement = {
    id: "booking-1",
    bookingId: "booking-1",
    senderContact: {
      name: "Sender User",
      phone: "+251911000111",
      email: null,
      notes: null,
    },
    travelerContact: {
      name: "Traveler User",
      phone: "+251922000222",
      email: null,
      notes: null,
    },
    receiver: {
      name: "Sender User",
      phone: "+251911000111",
      email: null,
      label: "Self",
      isSenderReceiver: true,
    },
    pickup: {
      meetingPoint: "Addis Ababa Airport",
      scheduledAt: "2026-03-01T14:00:00Z",
      notes: null,
    },
    dropoff: {
      meetingPoint: "Dulles Airport",
      scheduledAt: "2026-03-02T10:00:00Z",
      notes: null,
    },
    confirmation: {
      status: "needs_confirmation",
      proposedBy: null,
      confirmedBy: null,
      confirmedAt: null,
    },
    pickupVerification: {
      verified: false,
      verifiedAt: null,
      verifiedBy: null,
      failedAttempts: 0,
    },
    deliveryVerification: {
      verified: false,
      verifiedAt: null,
      verifiedBy: null,
      failedAttempts: 0,
    },
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
  };

  let mockRepository: HandoffRepository;
  let service: HandoffService;

  beforeEach(() => {
    mockRepository = {
      findByBookingId: vi.fn().mockResolvedValue(baseAgreement),
      saveAgreement: vi.fn().mockResolvedValue(undefined),
      watchByBookingId: vi.fn().mockReturnValue(() => {}),
      issueVerificationCode: vi.fn().mockResolvedValue({
        bookingId: "booking-1",
        codeType: "pickup",
        code: "123456",
      }),
      verifyPickup: vi.fn().mockResolvedValue({ success: true, verified: true }),
      verifyDelivery: vi.fn().mockResolvedValue({ success: true, verified: true }),
      regenerateCode: vi.fn().mockResolvedValue({ success: true, codeType: "pickup", newCode: "987654" }),
    };

    service = new HandoffService(mockRepository, clock);
  });

  it("updates sender contact information", async () => {
    await service.updateSenderContact("booking-1", {
      name: "Sender User",
      phone: "+251911999999",
      notes: "Call me upon arrival",
    });

    expect(mockRepository.saveAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        senderContact: {
          name: "Sender User",
          phone: "+251911999999",
          email: null,
          notes: "Call me upon arrival",
        },
        updatedAt: "2026-03-01T12:00:00Z",
      }),
    );
  });

  it("updates traveler contact information", async () => {
    await service.updateTravelerContact("booking-1", {
      name: "Traveler User",
      phone: "+251922888888",
      notes: "Will meet at departure terminal gate 2",
    });

    expect(mockRepository.saveAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        travelerContact: {
          name: "Traveler User",
          phone: "+251922888888",
          email: null,
          notes: "Will meet at departure terminal gate 2",
        },
      }),
    );
  });

  it("updates destination receiver information", async () => {
    await service.updateReceiver("booking-1", {
      name: "Uncle Bob",
      phone: "+12025550144",
      email: "bob@example.com",
      label: "Family",
      isSenderReceiver: false,
    });

    expect(mockRepository.saveAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        receiver: {
          name: "Uncle Bob",
          phone: "+12025550144",
          email: "bob@example.com",
          label: "Family",
          isSenderReceiver: false,
        },
      }),
    );
  });

  it("proposes appointment changes and sets confirmation status to proposed", async () => {
    await service.proposeAppointments({
      bookingId: "booking-1",
      actorId: "sender-1",
      pickup: {
        meetingPoint: "Terminal 2 Coffee Shop",
        scheduledAt: "2026-03-01T15:30:00Z",
        notes: "I'll be holding the blue parcel",
      },
    });

    expect(mockRepository.saveAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        pickup: {
          meetingPoint: "Terminal 2 Coffee Shop",
          scheduledAt: "2026-03-01T15:30:00Z",
          notes: "I'll be holding the blue parcel",
        },
        confirmation: {
          status: "proposed",
          proposedBy: "sender-1",
          confirmedBy: null,
          confirmedAt: null,
        },
      }),
    );
  });

  it("confirms a proposed agreement", async () => {
    const proposedAgreement: BookingHandoffAgreement = {
      ...baseAgreement,
      confirmation: {
        status: "proposed",
        proposedBy: "sender-1",
        confirmedBy: null,
        confirmedAt: null,
      },
    };
    (mockRepository.findByBookingId as any).mockResolvedValue(proposedAgreement);

    await service.confirmAgreement("booking-1", "traveler-1");

    expect(mockRepository.saveAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmation: {
          status: "confirmed",
          proposedBy: "sender-1",
          confirmedBy: "traveler-1",
          confirmedAt: "2026-03-01T12:00:00Z",
        },
      }),
    );
  });

  it("delegates verification and code generation to repository", async () => {
    const codeRes = await service.issueVerificationCode("booking-1", "pickup");
    expect(codeRes.code).toBe("123456");
    expect(mockRepository.issueVerificationCode).toHaveBeenCalledWith("booking-1", "pickup");

    const pickupRes = await service.verifyPickup("booking-1", "123456");
    expect(pickupRes.verified).toBe(true);
    expect(mockRepository.verifyPickup).toHaveBeenCalledWith("booking-1", "123456");

    const deliveryRes = await service.verifyDelivery("booking-1", "654321");
    expect(deliveryRes.verified).toBe(true);
    expect(mockRepository.verifyDelivery).toHaveBeenCalledWith("booking-1", "654321");

    const regenRes = await service.regenerateCode("booking-1", "pickup");
    expect(regenRes.newCode).toBe("987654");
    expect(mockRepository.regenerateCode).toHaveBeenCalledWith("booking-1", "pickup");
  });
});
