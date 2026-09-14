import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import {
  acceptBooking,
  issueHandoffVerificationCode,
  verifyPickupHandoff,
  verifyDeliveryHandoff,
  regenerateHandoffCode,
} from "../src/index.js";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "demo-karri-mobile",
  });
}

const db = admin.firestore();

async function seedUserAndProfile(userId: string, displayName: string) {
  await db.collection("users").doc(userId).set({
    userId,
    email: `${userId}@example.com`,
    status: "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
  await db.collection("profiles").doc(userId).set({
    userId,
    displayName,
    homeRegion: "Addis Ababa",
    primaryDestinationCountry: "United States",
    roles: ["sender", "traveler"],
    trustScore: null,
    status: "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

async function seedFullBookingFixture(
  bookingId: string,
  senderId = "sender-test-1",
  travelerId = "traveler-test-1",
) {
  const tripId = `trip-${bookingId}`;
  const shipmentId = `shipment-${bookingId}`;
  const reqId = `req-${bookingId}`;

  await seedUserAndProfile(senderId, "Abebe Sender");
  await seedUserAndProfile(travelerId, "Chala Traveler");

  await db.collection("trips").doc(tripId).set({
    ownerId: travelerId,
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    departureDate: "2026-03-01",
    arrivalDate: "2026-03-02",
    availableCapacityKg: 10,
    totalCapacityKg: 10,
    reservedCapacityKg: 0,
    notes: "Trip notes",
    status: "active",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("shipments").doc(shipmentId).set({
    ownerId: senderId,
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    packageCategory: "documents",
    packageDescription: "Important documents",
    weightKg: 2,
    deliveryWindow: "2026-03-01 to 2026-03-10",
    rewardAmount: 50,
    rewardCurrency: "USD",
    status: "active",
    containsBattery: false,
    batteryType: "none",
    containsLiquid: false,
    containsFoodOrAgri: false,
    containsMedicine: false,
    customsDeclarationRequired: false,
    packageContentVersion: 1,
    activeBookingId: null,
    activeCarrierId: null,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("bookingRequests").doc(reqId).set({
    bookingId,
    shipmentId,
    tripId,
    senderId,
    travelerId,
    message: "Handoff test booking",
    status: "pending",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  await db.collection("bookings").doc(bookingId).set({
    bookingRequestId: reqId,
    shipmentId,
    tripId,
    senderId,
    travelerId,
    status: "pending",
    statusHistory: [
      {
        status: "pending",
        changedAt: admin.firestore.Timestamp.now(),
        changedBy: senderId,
      },
    ],
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  return { tripId, shipmentId, reqId, senderId, travelerId };
}

describe("R04 — Secure Participant Handoff Coordination & Receiver Verification", () => {
  beforeEach(async () => {
    // Clear collections used in test
    const collections = [
      "bookings",
      "bookingRequests",
      "shipments",
      "trips",
      "custodyEvents",
      "bookingHandoffAgreements",
      "bookingHandoffSecrets",
      "profiles",
      "users",
    ];
    for (const c of collections) {
      const snap = await db.collection(c).get();
      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
  });

  it("initializes handoff agreement and secrets metadata upon acceptance with ZERO plaintext codes at rest", async () => {
    const bookingId = "bk-accept-init";
    const { travelerId } = await seedFullBookingFixture(bookingId);

    // Accept booking as traveler
    await acceptBooking.run({
      data: { bookingId },
      auth: { uid: travelerId, token: {} },
    } as any);

    // Verify bookingHandoffAgreements doc was created
    const agreementDoc = await db.collection("bookingHandoffAgreements").doc(bookingId).get();
    expect(agreementDoc.exists).toBe(true);
    const agreement = agreementDoc.data()!;
    expect(agreement.bookingId).toBe(bookingId);
    expect(agreement.senderContact.name).toBe("Abebe Sender");
    expect(agreement.travelerContact.name).toBe("Chala Traveler");
    expect(agreement.pickupVerification.verified).toBe(false);
    expect(agreement.deliveryVerification.verified).toBe(false);
    expect(agreement.confirmation.status).toBe("needs_confirmation");

    // Verify bookingHandoffSecrets doc was created with metadata only
    const secretsDoc = await db.collection("bookingHandoffSecrets").doc(bookingId).get();
    expect(secretsDoc.exists).toBe(true);
    const secrets = secretsDoc.data()!;

    // PLAINTEXT AT REST VERIFICATION:
    expect((secrets as any).pickupCode).toBeUndefined();
    expect((secrets as any).deliveryCode).toBeUndefined();
    expect(secrets.pickupIssued).toBe(false);
    expect(secrets.deliveryIssued).toBe(false);
    expect(secrets.pickupCodeHash).toBeNull();
    expect(secrets.deliveryCodeHash).toBeNull();
    expect(secrets.pickupSalt).toBeNull();
    expect(secrets.deliverySalt).toBeNull();
    expect(secrets.pickupAttempts).toBe(0);
    expect(secrets.deliveryAttempts).toBe(0);

    // Deep inspect all document values: absolutely no 6-digit numeric PIN exists in the document
    const allValues = JSON.stringify(secrets);
    expect(allValues).not.toMatch(/\b\d{6}\b/);
  });

  it("allows only sender to issue verification codes, and stores only salt+hash at rest", async () => {
    const bookingId = "bk-codes-auth";
    const { senderId, travelerId } = await seedFullBookingFixture(bookingId);

    await acceptBooking.run({
      data: { bookingId },
      auth: { uid: travelerId, token: {} },
    } as any);

    // 1. Traveler attempts to issue code -> DENIED
    await expect(
      issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "pickup" },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Only the booking sender can generate handoff verification codes/);

    // 2. Unrelated third party attempts to issue code -> DENIED
    await expect(
      issueHandoffVerificationCode.run({
        data: { bookingId, codeType: "pickup" },
        auth: { uid: "stranger-uid", token: {} },
      } as any),
    ).rejects.toThrow(/Only the booking sender can generate handoff verification codes/);

    // 3. Sender issues pickup code -> PASS
    const issueRes = await issueHandoffVerificationCode.run({
      data: { bookingId, codeType: "pickup" },
      auth: { uid: senderId, token: {} },
    } as any);
    expect(issueRes.success).toBe(true);
    expect(issueRes.codeType).toBe("pickup");
    expect(issueRes.code).toMatch(/^\d{6}$/);
    const issuedPlaintextCode = issueRes.code;

    // 4. Verify Firestore secrets record:
    const secretsDoc = await db.collection("bookingHandoffSecrets").doc(bookingId).get();
    const secrets = secretsDoc.data()!;
    expect(secrets.pickupIssued).toBe(true);
    expect(secrets.pickupCodeHash).toBeDefined();
    expect(secrets.pickupSalt).toBeDefined();
    expect((secrets as any).pickupCode).toBeUndefined();

    // Verify plaintext code is NOT stored anywhere in the Firestore document
    const secretsJson = JSON.stringify(secrets);
    expect(secretsJson.includes(issuedPlaintextCode)).toBe(false);
  });

  it("rotates code: old code fails, new code succeeds, and failed-attempt count resets", async () => {
    const bookingId = "bk-rotation-flow";
    const { senderId, travelerId } = await seedFullBookingFixture(bookingId);

    await acceptBooking.run({
      data: { bookingId },
      auth: { uid: travelerId, token: {} },
    } as any);

    // Step 1: Issue code A
    const resA = await issueHandoffVerificationCode.run({
      data: { bookingId, codeType: "pickup" },
      auth: { uid: senderId, token: {} },
    } as any);
    const codeA = resA.code;

    // Step 2: Traveler enters an invalid code to produce failed attempts
    await expect(
      verifyPickupHandoff.run({
        data: { bookingId, code: "000000" },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Incorrect verification code. 4 attempt\(s\) remaining/);

    // Step 3: Issue replacement code B (rotation)
    const resB = await issueHandoffVerificationCode.run({
      data: { bookingId, codeType: "pickup" },
      auth: { uid: senderId, token: {} },
    } as any);
    const codeB = resB.code;
    expect(codeB).not.toBe(codeA);

    // Step 4: Verify that old code A now FAILS
    await expect(
      verifyPickupHandoff.run({
        data: { bookingId, code: codeA },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Incorrect verification code/);

    // Step 5: Verify that new code B SUCCEEDS
    const passRes = await verifyPickupHandoff.run({
      data: { bookingId, code: codeB },
      auth: { uid: travelerId, token: {} },
    } as any);
    expect(passRes.success).toBe(true);
    expect(passRes.verified).toBe(true);
  });

  it("prevents replay: verified code cannot be submitted again", async () => {
    const bookingId = "bk-replay-flow";
    const { senderId, travelerId } = await seedFullBookingFixture(bookingId);

    await acceptBooking.run({
      data: { bookingId },
      auth: { uid: travelerId, token: {} },
    } as any);

    const issueRes = await issueHandoffVerificationCode.run({
      data: { bookingId, codeType: "pickup" },
      auth: { uid: senderId, token: {} },
    } as any);
    const code = issueRes.code;

    // Verification 1 -> SUCCEEDS
    const passRes = await verifyPickupHandoff.run({
      data: { bookingId, code },
      auth: { uid: travelerId, token: {} },
    } as any);
    expect(passRes.success).toBe(true);

    // Verification 2 (Replay attack with exact same code) -> REJECTED
    await expect(
      verifyPickupHandoff.run({
        data: { bookingId, code },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Pickup handoff has already been verified/);

    // Verify secret hash and salt were cleared at rest upon successful verification
    const secretsDoc = await db.collection("bookingHandoffSecrets").doc(bookingId).get();
    expect(secretsDoc.data()?.pickupCodeHash).toBeNull();
    expect(secretsDoc.data()?.pickupSalt).toBeNull();
  });

  it("enforces explicit lifecycle allowlist for verification operations", async () => {
    const bookingId = "bk-lifecycle-allowlist";
    const { senderId, travelerId } = await seedFullBookingFixture(bookingId);

    // 1. Try pickup verification while still pending -> REJECTED
    await expect(
      verifyPickupHandoff.run({
        data: { bookingId, code: "123456" },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Pickup verification is only permitted when booking is in 'accepted' status/);

    // Accept booking
    await acceptBooking.run({
      data: { bookingId },
      auth: { uid: travelerId, token: {} },
    } as any);

    // 2. Try delivery verification while status is 'accepted' (before departure/transit) -> REJECTED
    await expect(
      verifyDeliveryHandoff.run({
        data: { bookingId, code: "123456" },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Delivery verification is only permitted when booking is in 'in_transit' status/);

    // Sender generates pickup code and traveler verifies it
    const pickupRes = await issueHandoffVerificationCode.run({
      data: { bookingId, codeType: "pickup" },
      auth: { uid: senderId, token: {} },
    } as any);
    await verifyPickupHandoff.run({
      data: { bookingId, code: pickupRes.code },
      auth: { uid: travelerId, token: {} },
    } as any);

    // Transition booking to in_transit
    await db.collection("bookings").doc(bookingId).update({
      status: "in_transit",
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // 3. In 'in_transit' status, pickup verification is no longer allowed
    await expect(
      verifyPickupHandoff.run({
        data: { bookingId, code: pickupRes.code },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Pickup verification is only permitted when booking is in 'accepted' status/);

    // 4. In 'in_transit' status, delivery verification is allowed
    const deliveryRes = await issueHandoffVerificationCode.run({
      data: { bookingId, codeType: "delivery" },
      auth: { uid: senderId, token: {} },
    } as any);
    const delPass = await verifyDeliveryHandoff.run({
      data: { bookingId, code: deliveryRes.code },
      auth: { uid: travelerId, token: {} },
    } as any);
    expect(delPass.success).toBe(true);
    expect(delPass.verified).toBe(true);

    // 5. Replay of delivery code -> REJECTED
    await expect(
      verifyDeliveryHandoff.run({
        data: { bookingId, code: deliveryRes.code },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Delivery handoff has already been verified/);
  });

  it("locks code after 5 failed attempts until regenerated by sender", async () => {
    const bookingId = "bk-lockout-flow";
    const { senderId, travelerId } = await seedFullBookingFixture(bookingId);

    await acceptBooking.run({
      data: { bookingId },
      auth: { uid: travelerId, token: {} },
    } as any);

    const issueRes = await issueHandoffVerificationCode.run({
      data: { bookingId, codeType: "pickup" },
      auth: { uid: senderId, token: {} },
    } as any);
    const validCode = issueRes.code;

    // Fail 4 times
    for (let i = 1; i <= 4; i++) {
      await expect(
        verifyPickupHandoff.run({
          data: { bookingId, code: "000000" },
          auth: { uid: travelerId, token: {} },
        } as any),
      ).rejects.toThrow(/attempt\(s\) remaining/);
    }

    // 5th failed attempt triggers lockout
    await expect(
      verifyPickupHandoff.run({
        data: { bookingId, code: "000000" },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Maximum attempts exceeded. Code is now locked/);

    // Correct code is now rejected because code is locked
    await expect(
      verifyPickupHandoff.run({
        data: { bookingId, code: validCode },
        auth: { uid: travelerId, token: {} },
      } as any),
    ).rejects.toThrow(/Maximum pickup verification attempts exceeded. Code is locked/);

    // Sender regenerates the code
    const regenRes = await regenerateHandoffCode.run({
      data: { bookingId, codeType: "pickup" },
      auth: { uid: senderId, token: {} },
    } as any);
    expect(regenRes.newCode).toMatch(/^\d{6}$/);

    // Traveler uses regenerated code -> PASS
    const passRes = await verifyPickupHandoff.run({
      data: { bookingId, code: regenRes.newCode },
      auth: { uid: travelerId, token: {} },
    } as any);
    expect(passRes.success).toBe(true);
    expect(passRes.verified).toBe(true);
  });
});
