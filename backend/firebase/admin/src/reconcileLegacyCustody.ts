import admin from "firebase-admin";
import { LegacyCustodyReconciler } from "../../functions/src/services/LegacyCustodyReconciler.js";

interface CliOptions {
  projectId?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--write") {
      console.warn("WARNING: '--write' mode is disabled in R05. This audit tool is strictly READ-ONLY.");
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
  const reconciler = new LegacyCustodyReconciler(db);

  console.log("Starting legacy custody reconciliation (Mode: READ-ONLY AUDIT)...");

  const report = await reconciler.reconcile({ dryRun: true });

  console.log("=== Legacy Custody Reconciliation Report ===");
  console.log(`Dry Run: ${report.dryRun}`);
  console.log(`Bookings Scanned: ${report.bookingsScanned}`);
  console.log(`Custody Events Scanned: ${report.custodyEventsScanned}`);
  console.log(`Consistent Bookings: ${report.consistentBookings}`);
  console.log(`Anomalous Bookings: ${report.anomalousBookings}`);
  console.log(`Total Anomalies Detected: ${report.anomalies.length}`);

  if (report.anomalies.length > 0) {
    console.log("--- Anomalies (Require Manual Review) ---");
    for (const a of report.anomalies) {
      console.log(`[${a.type}] Booking: ${a.bookingId}${a.eventId ? ` (Event: ${a.eventId})` : ""} — ${a.details}`);
    }
  }

  console.log("\nNOTE: This tool is strictly READ-ONLY. No writes were committed to Firestore.");
}

main().catch((err) => {
  console.error("Custody reconciliation failed:", err);
  process.exit(1);
});
