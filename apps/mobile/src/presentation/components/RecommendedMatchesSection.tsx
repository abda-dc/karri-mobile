import { StyleSheet, View } from "react-native";
import { Banner } from "../../components/Banner";
import { LoadingState } from "../../components/LoadingState";
import { SectionHeader } from "../../components/SectionHeader";
import { StatusChip } from "../../components/StatusChip";
import type { MatchResult } from "../../domain/matching/MatchResult";
import { spacing } from "../../theme/tokens";
import { EmptyMatchState } from "./EmptyMatchState";
import { MatchCard } from "./MatchCard";

interface RecommendedMatchesSectionProps {
  readonly error?: string | null;
  readonly filtered?: boolean;
  readonly loading: boolean;
  readonly matches: ReadonlyArray<MatchResult>;
  readonly recommendation: "shipment" | "trip";
  readonly subject: "shipment" | "trip";
  readonly subtitle: string;
  readonly title: string;
}

export function RecommendedMatchesSection({
  error,
  filtered = false,
  loading,
  matches,
  recommendation,
  subject,
  subtitle,
  title,
}: RecommendedMatchesSectionProps) {
  return (
    <View style={styles.section}>
      <SectionHeader
        action={!loading && !error ? <StatusChip label={`${matches.length} found`} tone="info" /> : undefined}
        eyebrow="Recommended matches"
        subtitle={subtitle}
        title={title}
      />
      {loading ? <LoadingState message="Ranking current recommendations..." /> : null}
      {!loading && error ? (
        <Banner message={error} title="Recommendations could not load" variant="error" />
      ) : null}
      {!loading && !error && matches.length === 0 ? (
        <EmptyMatchState filtered={filtered} subject={subject} />
      ) : null}
      {!loading && !error
        ? matches.map((match) => (
            <MatchCard key={match.id} match={match} recommendation={recommendation} />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
});
