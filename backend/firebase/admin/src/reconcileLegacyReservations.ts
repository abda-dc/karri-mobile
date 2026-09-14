import admin from "firebase-admin";
import { LegacyReservationReconciler } from "../../functions/src/services/LegacyReservationReconciler.js";

interface CliOptions {
  dryRun: boolean;
  projectId?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--write") {
      options.dryRun = false;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
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
  const reconciler = new LegacyReservationReconciler(db);

  console.log(`Starting legacy reservation reconciliation (mode: ${options.dryRun ? "DRY-RUN (read-only)" : "WRITE"})...`);

  const report = await reconciler.reconcile({ dryRun: options.dryRun });

  console.log("=== Legacy Reservation Reconciliation Report ===");
  console.log(`Dry Run: ${report.dryRun}`);
  console.log(`Trips Scanned: ${report.tripsScanned}`);
  console.log(`Trips Missing R03 Metadata: ${report.tripsMissingMetadata}`);
  console.log(`Trips With Historical Commitments: ${report.tripsWithHistoricalCommitments}`);
  console.log(`Planned Trip Updates: ${report.plannedTripUpdates}`);
  console.log(`Shipments Scanned: ${report.shipmentsScanned}`);
  console.log(`Shipments Needing Claims: ${report.shipmentsNeedingClaims}`);
  console.log(`Planned Shipment Updates: ${report.plannedShipmentUpdates}`);
  console.log(`Conflicts Detected: ${report.conflicts.length}`);

  if (report.conflicts.length > 0) {
    console.log("--- Conflicts (Require Manual Review) ---");
    for (const c of report.conflicts) {
      console.log(`[${c.type}] Entity: ${c.entityId} — ${c.reason}`);
    }
  }

  if (options.dryRun) {
    console.log("\nNOTE: This was a DRY-RUN. No writes were committed to Firestore.");
    console.log("To apply these changes, rerun with '--write'.");
  } else {
    console.log("\nSUCCESS: Writes committed to Firestore.");
  }
}

main().catch((err) => {
  console.error("Reconciliation failed:", err);
  process.exit(1);
});
