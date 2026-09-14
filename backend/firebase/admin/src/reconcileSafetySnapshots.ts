import admin from "firebase-admin";
import { SafetySnapshotReconciler } from "../../functions/src/services/SafetySnapshotReconciler.js";

interface CliOptions {
  projectId?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--write") {
      console.warn("WARNING: '--write' mode is disabled in R06. This audit tool is strictly READ-ONLY.");
    } else if (arg === "--project-id" && args[i + 1]) {
      options.projectId = args[i + 1];
      i++;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: options.projectId ?? process.env.GCLOUD_PROJECT ?? "karri-mobile-dev",
    });
  }

  const db = admin.firestore();
  const reconciler = new SafetySnapshotReconciler(db);

  console.log("Starting safety & agreement snapshot reconciliation (Mode: READ-ONLY AUDIT)...");

  const report = await reconciler.reconcile({ dryRun: true });

  console.log("=== Safety & Agreement Snapshot Reconciliation Report ===");
  console.log(`Dry Run: ${report.dryRun}`);
  console.log(`Bookings Scanned: ${report.bookingsScanned}`);
  console.log(`Snapshots Scanned: ${report.snapshotsScanned}`);
  console.log(`Holds Scanned: ${report.holdsScanned}`);
  console.log(`Reviews Scanned: ${report.reviewsScanned}`);
  console.log(`Consistent Bookings: ${report.consistentBookings}`);
  console.log(`Anomalous Bookings: ${report.anomalousBookings}`);
  console.log(`Total Anomalies Detected: ${report.anomalies.length}`);

  if (report.anomalies.length > 0) {
    console.log("\n--- Anomalies (Require Operator Review) ---");
    for (const a of report.anomalies) {
      console.log(`[${a.type}] Booking: ${a.bookingId}${a.shipmentId ? ` (Shipment: ${a.shipmentId})` : ""} — ${a.details}`);
    }
  }

  console.log("\nNOTE: This tool is strictly READ-ONLY. No writes were committed to Firestore.");
}

main().catch((err) => {
  console.error("Safety snapshot reconciliation failed:", err);
  process.exit(1);
});
