import { describe, it, expect, beforeEach } from "vitest";
import admin from "firebase-admin";
import { SafetySnapshotReconciler } from "../src/services/SafetySnapshotReconciler.js";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "demo-karri-mobile",
  });
}

const db = admin.firestore();

describe("SafetySnapshotReconciler (R06 Preflight Audit Tool)", () => {
  beforeEach(async () => {
    const collections = [
      "bookings",
      "bookingAgreementSnapshots",
      "administrativeHolds",
      "shipmentSafetyReviews",
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

  it("detects missing agreement snapshots for accepted bookings", async () => {
    await db.collection("bookings").doc("b-1").set({
      shipmentId: "s-1",
      tripId: "t-1",
      senderId: "u-1",
      travelerId: "u-2",
      status: "accepted",
      reservedWeightKg: 5,
    });

    const reconciler = new SafetySnapshotReconciler(db);
    const report = await reconciler.reconcile({ dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.bookingsScanned).toBe(1);
    expect(report.anomalousBookings).toBe(1);
    expect(report.anomalies.some((a) => a.type === "missing_snapshot" && a.bookingId === "b-1")).toBe(true);
  });

  it("detects active administrative holds on active bookings", async () => {
    await db.collection("bookings").doc("b-2").set({
      shipmentId: "s-2",
      tripId: "t-2",
      senderId: "u-1",
      travelerId: "u-2",
      status: "accepted",
      reservedWeightKg: 3,
    });

    await db.collection("bookingAgreementSnapshots").doc("b-2").set({
      bookingId: "b-2",
      shipmentId: "s-2",
      tripId: "t-2",
      senderId: "u-1",
      travelerId: "u-2",
      packageCategory: "general",
      packageDescription: "Books",
      weightKg: 3,
      packageContentVersion: 1,
    });

    await db.collection("administrativeHolds").doc("hold-s2").set({
      shipmentId: "s-2",
      status: "active",
      reasonCode: "suspected_policy_violation",
    });

    const reconciler = new SafetySnapshotReconciler(db);
    const report = await reconciler.reconcile({ dryRun: true });

    expect(report.anomalousBookings).toBe(1);
    expect(report.anomalies.some((a) => a.type === "active_hold_on_accepted_booking" && a.bookingId === "b-2")).toBe(true);
  });

  it("detects blocking safety reviews on active bookings", async () => {
    await db.collection("bookings").doc("b-3").set({
      shipmentId: "s-3",
      tripId: "t-3",
      senderId: "u-1",
      travelerId: "u-2",
      status: "in_transit",
      reservedWeightKg: 2,
    });

    await db.collection("bookingAgreementSnapshots").doc("b-3").set({
      bookingId: "b-3",
      shipmentId: "s-3",
      tripId: "t-3",
      senderId: "u-1",
      travelerId: "u-2",
      packageCategory: "general",
      packageDescription: "Clothes",
      weightKg: 2,
      packageContentVersion: 1,
    });

    await db.collection("shipmentSafetyReviews").doc("rev-s3").set({
      shipmentId: "s-3",
      decision: "rejected",
      reasonCode: "prohibited_item",
    });

    const reconciler = new SafetySnapshotReconciler(db);
    const report = await reconciler.reconcile({ dryRun: true });

    expect(report.anomalousBookings).toBe(1);
    expect(report.anomalies.some((a) => a.type === "blocking_review_on_accepted_booking" && a.bookingId === "b-3")).toBe(true);
  });

  it("reports zero anomalies when all accepted bookings have valid snapshots and clean safety states", async () => {
    await db.collection("bookings").doc("b-clean").set({
      shipmentId: "s-clean",
      tripId: "t-clean",
      senderId: "u-1",
      travelerId: "u-2",
      status: "accepted",
      reservedWeightKg: 4,
    });

    await db.collection("bookingAgreementSnapshots").doc("b-clean").set({
      bookingId: "b-clean",
      shipmentId: "s-clean",
      tripId: "t-clean",
      senderId: "u-1",
      travelerId: "u-2",
      packageCategory: "electronics",
      packageDescription: "Camera",
      weightKg: 4,
      packageContentVersion: 1,
    });

    const reconciler = new SafetySnapshotReconciler(db);
    const report = await reconciler.reconcile({ dryRun: true });

    expect(report.anomalies.length).toBe(0);
    expect(report.anomalousBookings).toBe(0);
    expect(report.consistentBookings).toBe(1);
  });
});
