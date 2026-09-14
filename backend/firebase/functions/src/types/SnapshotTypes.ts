import type admin from "firebase-admin";

export interface BookingAgreementSnapshot {
  bookingId: string;
  shipmentId: string;
  tripId: string;
  senderId: string;
  travelerId: string;
  packageCategory: string;
  packageDescription: string;
  weightKg: number;
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  deliveryWindow: string;
  rewardAmount: number;
  rewardCurrency: string;
  containsBattery: boolean;
  batteryType: string;
  containsLiquid: boolean;
  containsFoodOrAgri: boolean;
  containsMedicine: boolean;
  customsDeclarationRequired: boolean;
  packageContentVersion: number;
  senderSafetyDeclaration: Record<string, unknown> | null;
  snapshotVersion: number;
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
}
