import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type {
  BookingHandoffAgreement,
  HandoffIssuedCode,
} from "../../../domain/handoff/HandoffAgreement";
import type { HandoffRepository } from "../../../domain/handoff/HandoffRepository";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import {
  mapHandoffAgreement,
  toFirestoreHandoffAgreement,
} from "../mappers/handoffMapper";
import type { PrivilegedCallableTransport } from "../privilegedCallableTransport";

export class FirebaseHandoffRepository implements HandoffRepository {
  constructor(private readonly transport: PrivilegedCallableTransport) {}

  async findByBookingId(bookingId: string): Promise<BookingHandoffAgreement | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "bookingHandoffAgreements", bookingId));
    return snapshot.exists() ? mapHandoffAgreement(snapshot) : null;
  }

  async saveAgreement(agreement: BookingHandoffAgreement): Promise<void> {
    const { db } = getFirebaseServices();
    const ref = doc(db, "bookingHandoffAgreements", agreement.bookingId);
    const firestoreData = toFirestoreHandoffAgreement(agreement);

    await firebaseOfflineStatusGateway.trackWrite(() =>
      setDoc(
        ref,
        {
          ...firestoreData,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
  }

  watchByBookingId(
    bookingId: string,
    onData: (agreement: BookingHandoffAgreement | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    const ref = doc(db, "bookingHandoffAgreements", bookingId);

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        onData(snapshot.exists() ? mapHandoffAgreement(snapshot) : null);
      },
      (error) => {
        onError(error);
      },
    );

    return unsubscribe;
  }

  async issueVerificationCode(
    bookingId: string,
    codeType: "pickup" | "delivery",
  ): Promise<HandoffIssuedCode> {
    const res = await this.transport.issueHandoffVerificationCode({ bookingId, codeType });
    return {
      bookingId: res.bookingId,
      codeType: res.codeType,
      code: res.code,
    };
  }

  async verifyPickup(
    bookingId: string,
    code: string,
  ): Promise<{ success: boolean; verified: boolean }> {
    const res = await this.transport.verifyPickupHandoff({ bookingId, code });
    return {
      success: res.success,
      verified: res.verified,
    };
  }

  async verifyDelivery(
    bookingId: string,
    code: string,
  ): Promise<{ success: boolean; verified: boolean }> {
    const res = await this.transport.verifyDeliveryHandoff({ bookingId, code });
    return {
      success: res.success,
      verified: res.verified,
    };
  }

  async regenerateCode(
    bookingId: string,
    codeType: "pickup" | "delivery",
  ): Promise<{ success: boolean; codeType: "pickup" | "delivery"; newCode: string }> {
    const res = await this.transport.regenerateHandoffCode({ bookingId, codeType });
    return {
      success: res.success,
      codeType: res.codeType,
      newCode: res.newCode,
    };
  }
}
