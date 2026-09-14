import { describe, it, expect, vi } from "vitest";
import { SafetySnapshotReconciler } from "../../functions/src/services/SafetySnapshotReconciler.js";

describe("reconcileSafetySnapshots admin tooling", () => {
  it("executes read-only preflight reconciliation against mocked firestore", async () => {
    const mockBookings = [
      {
        id: "b-accepted-clean",
        data: () => ({
          shipmentId: "s-1",
          tripId: "t-1",
          status: "accepted",
          reservedWeightKg: 5,
        }),
      },
      {
        id: "b-accepted-missing-snap",
        data: () => ({
          shipmentId: "s-2",
          tripId: "t-2",
          status: "accepted",
          reservedWeightKg: 3,
        }),
      },
    ];

    const mockSnapshots = [
      {
        id: "b-accepted-clean",
        data: () => ({
          bookingId: "b-accepted-clean",
          shipmentId: "s-1",
          tripId: "t-1",
          senderId: "u-1",
          travelerId: "u-2",
          weightKg: 5,
          packageCategory: "general",
          packageDescription: "Luggage",
          packageContentVersion: 1,
        }),
      },
    ];

    const mockDb: any = {
      collection: vi.fn((colName: string) => ({
        get: vi.fn(async () => {
          if (colName === "bookings") {
            return { size: mockBookings.length, docs: mockBookings };
          }
          if (colName === "bookingAgreementSnapshots") {
            return { size: mockSnapshots.length, docs: mockSnapshots };
          }
          if (colName === "administrativeHolds") {
            return { size: 0, docs: [] };
          }
          if (colName === "shipmentSafetyReviews") {
            return { size: 0, docs: [] };
          }
          return { size: 0, docs: [] };
        }),
      })),
    };

    const reconciler = new SafetySnapshotReconciler(mockDb);
    const report = await reconciler.reconcile({ dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.bookingsScanned).toBe(2);
    expect(report.anomalousBookings).toBe(1);
    expect(report.consistentBookings).toBe(1);
    expect(report.anomalies[0].type).toBe("missing_snapshot");
    expect(report.anomalies[0].bookingId).toBe("b-accepted-missing-snap");
  });
});
