import type {
  BookingHandoffAgreement,
  HandoffIssuedCode,
} from "./HandoffAgreement";

export interface HandoffRepository {
  findByBookingId(bookingId: string): Promise<BookingHandoffAgreement | null>;
  saveAgreement(agreement: BookingHandoffAgreement): Promise<void>;
  watchByBookingId(
    bookingId: string,
    onData: (agreement: BookingHandoffAgreement | null) => void,
    onError: (error: Error) => void,
  ): () => void;
  issueVerificationCode(
    bookingId: string,
    codeType: "pickup" | "delivery",
  ): Promise<HandoffIssuedCode>;
  verifyPickup(
    bookingId: string,
    code: string,
  ): Promise<{ success: boolean; verified: boolean }>;
  verifyDelivery(
    bookingId: string,
    code: string,
  ): Promise<{ success: boolean; verified: boolean }>;
  regenerateCode(
    bookingId: string,
    codeType: "pickup" | "delivery",
  ): Promise<{ success: boolean; codeType: "pickup" | "delivery"; newCode: string }>;
}
