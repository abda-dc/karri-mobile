import { EmptyState } from "../../components/EmptyState";

interface EmptyMatchStateProps {
  readonly filtered?: boolean;
  readonly subject: "shipment" | "trip";
}

export function EmptyMatchState({ filtered = false, subject }: EmptyMatchStateProps) {
  const counterpart = subject === "shipment" ? "trips" : "shipments";
  return (
    <EmptyState
      description={
        filtered
          ? `No ${counterpart} meet the current score and eligibility filters. Try a broader filter.`
          : `No active ${counterpart} currently meet the matching requirements for this ${subject}.`
      }
      marker="M"
      title="No recommendations yet"
    />
  );
}
