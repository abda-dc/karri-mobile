import type {
  BookingHandoffAgreement,
  HandoffAppointment,
  HandoffContactInfo,
  HandoffIssuedCode,
  HandoffReceiverInfo,
} from "../../domain/handoff/HandoffAgreement";
import type { HandoffRepository } from "../../domain/handoff/HandoffRepository";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import { DomainValidationError, requireText } from "./validation";

export interface ProposeHandoffInput {
  bookingId: string;
  actorId: string;
  pickup?: {
    meetingPoint?: string;
    scheduledAt?: string | null;
    notes?: string | null;
  };
  dropoff?: {
    meetingPoint?: string;
    scheduledAt?: string | null;
    notes?: string | null;
  };
}

export class HandoffService {
  constructor(
    private readonly repository: HandoffRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async getAgreement(bookingId: string): Promise<BookingHandoffAgreement | null> {
    const cleanId = requireText(bookingId, "bookingId", 128);
    return this.repository.findByBookingId(cleanId);
  }

  watchAgreement(
    bookingId: string,
    onData: (agreement: BookingHandoffAgreement | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    const cleanId = requireText(bookingId, "bookingId", 128);
    return this.repository.watchByBookingId(cleanId, onData, onError);
  }

  async updateSenderContact(
    bookingId: string,
    contact: HandoffContactInfo,
  ): Promise<void> {
    const existing = await this.getExistingAgreement(bookingId);
    const updated: BookingHandoffAgreement = {
      ...existing,
      senderContact: {
        name: (contact.name ?? existing.senderContact.name).trim().slice(0, 120),
        phone: contact.phone?.trim().slice(0, 32) || null,
        email: contact.email?.trim().slice(0, 120) || null,
        notes: contact.notes?.trim().slice(0, 300) || null,
      },
      updatedAt: this.clock.now(),
    };
    await this.repository.saveAgreement(updated);
  }

  async updateTravelerContact(
    bookingId: string,
    contact: HandoffContactInfo,
  ): Promise<void> {
    const existing = await this.getExistingAgreement(bookingId);
    const updated: BookingHandoffAgreement = {
      ...existing,
      travelerContact: {
        name: (contact.name ?? existing.travelerContact.name).trim().slice(0, 120),
        phone: contact.phone?.trim().slice(0, 32) || null,
        email: contact.email?.trim().slice(0, 120) || null,
        notes: contact.notes?.trim().slice(0, 300) || null,
      },
      updatedAt: this.clock.now(),
    };
    await this.repository.saveAgreement(updated);
  }

  async updateReceiver(
    bookingId: string,
    receiver: HandoffReceiverInfo,
  ): Promise<void> {
    const existing = await this.getExistingAgreement(bookingId);
    if (!receiver.name || receiver.name.trim().length === 0) {
      throw new DomainValidationError("Receiver name is required.");
    }
    const updated: BookingHandoffAgreement = {
      ...existing,
      receiver: {
        name: receiver.name.trim().slice(0, 120),
        phone: receiver.phone ? receiver.phone.trim().slice(0, 32) : "",
        email: receiver.email?.trim().slice(0, 120) || null,
        label: receiver.label?.trim().slice(0, 60) || null,
        isSenderReceiver: Boolean(receiver.isSenderReceiver),
      },
      updatedAt: this.clock.now(),
    };
    await this.repository.saveAgreement(updated);
  }

  async proposeAppointments(input: ProposeHandoffInput): Promise<void> {
    const existing = await this.getExistingAgreement(input.bookingId);
    const actorId = requireText(input.actorId, "actorId", 128);

    const newPickup: HandoffAppointment = {
      meetingPoint: input.pickup?.meetingPoint !== undefined
        ? input.pickup.meetingPoint.trim().slice(0, 160)
        : existing.pickup.meetingPoint,
      scheduledAt: input.pickup?.scheduledAt !== undefined
        ? input.pickup.scheduledAt
        : existing.pickup.scheduledAt,
      notes: input.pickup?.notes !== undefined
        ? (input.pickup.notes?.trim().slice(0, 300) || null)
        : existing.pickup.notes,
    };

    const newDropoff: HandoffAppointment = {
      meetingPoint: input.dropoff?.meetingPoint !== undefined
        ? input.dropoff.meetingPoint.trim().slice(0, 160)
        : existing.dropoff.meetingPoint,
      scheduledAt: input.dropoff?.scheduledAt !== undefined
        ? input.dropoff.scheduledAt
        : existing.dropoff.scheduledAt,
      notes: input.dropoff?.notes !== undefined
        ? (input.dropoff.notes?.trim().slice(0, 300) || null)
        : existing.dropoff.notes,
    };

    const updated: BookingHandoffAgreement = {
      ...existing,
      pickup: newPickup,
      dropoff: newDropoff,
      confirmation: {
        status: "proposed",
        proposedBy: actorId,
        confirmedBy: null,
        confirmedAt: null,
      },
      updatedAt: this.clock.now(),
    };

    await this.repository.saveAgreement(updated);
  }

  async confirmAgreement(bookingId: string, actorId: string): Promise<void> {
    const existing = await this.getExistingAgreement(bookingId);
    const cleanActor = requireText(actorId, "actorId", 128);

    if (existing.confirmation.status === "confirmed") {
      return;
    }

    const updated: BookingHandoffAgreement = {
      ...existing,
      confirmation: {
        status: "confirmed",
        proposedBy: existing.confirmation.proposedBy,
        confirmedBy: cleanActor,
        confirmedAt: this.clock.now(),
      },
      updatedAt: this.clock.now(),
    };

    await this.repository.saveAgreement(updated);
  }

  async issueVerificationCode(
    bookingId: string,
    codeType: "pickup" | "delivery",
  ): Promise<HandoffIssuedCode> {
    const cleanId = requireText(bookingId, "bookingId", 128);
    if (codeType !== "pickup" && codeType !== "delivery") {
      throw new DomainValidationError("codeType must be 'pickup' or 'delivery'.");
    }
    return this.repository.issueVerificationCode(cleanId, codeType);
  }

  async verifyPickup(
    bookingId: string,
    code: string,
  ): Promise<{ success: boolean; verified: boolean }> {
    const cleanId = requireText(bookingId, "bookingId", 128);
    const cleanCode = requireText(code, "code", 16);
    return this.repository.verifyPickup(cleanId, cleanCode);
  }

  async verifyDelivery(
    bookingId: string,
    code: string,
  ): Promise<{ success: boolean; verified: boolean }> {
    const cleanId = requireText(bookingId, "bookingId", 128);
    const cleanCode = requireText(code, "code", 16);
    return this.repository.verifyDelivery(cleanId, cleanCode);
  }

  async regenerateCode(
    bookingId: string,
    codeType: "pickup" | "delivery",
  ): Promise<{ success: boolean; codeType: "pickup" | "delivery"; newCode: string }> {
    const cleanId = requireText(bookingId, "bookingId", 128);
    return this.repository.regenerateCode(cleanId, codeType);
  }

  private async getExistingAgreement(bookingId: string): Promise<BookingHandoffAgreement> {
    const cleanId = requireText(bookingId, "bookingId", 128);
    const existing = await this.repository.findByBookingId(cleanId);
    if (!existing) {
      throw new DomainValidationError("Handoff agreement not found for booking.");
    }
    return existing;
  }
}
