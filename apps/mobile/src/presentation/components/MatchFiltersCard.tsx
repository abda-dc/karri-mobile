import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { TextField } from "../../components/TextField";
import { colors, spacing, typography } from "../../theme/tokens";

export interface MatchDiscoveryFilters {
  readonly eligibleOnly: boolean;
  readonly maximumResults: number;
  readonly minimumScore: number;
  readonly packageCategory: string;
  readonly verifiedOnly: boolean;
}

export const defaultMatchDiscoveryFilters: MatchDiscoveryFilters = {
  eligibleOnly: true,
  maximumResults: 3,
  minimumScore: 0,
  packageCategory: "",
  verifiedOnly: false,
};

export function hasActiveMatchFilters(filters: MatchDiscoveryFilters): boolean {
  return (
    filters.minimumScore !== defaultMatchDiscoveryFilters.minimumScore ||
    filters.maximumResults !== defaultMatchDiscoveryFilters.maximumResults ||
    filters.verifiedOnly !== defaultMatchDiscoveryFilters.verifiedOnly ||
    filters.eligibleOnly !== defaultMatchDiscoveryFilters.eligibleOnly ||
    Boolean(filters.packageCategory.trim())
  );
}

interface MatchFiltersCardProps {
  readonly applying?: boolean;
  readonly filters: MatchDiscoveryFilters;
  readonly onApply: (filters: MatchDiscoveryFilters) => void;
}

export function MatchFiltersCard({
  applying = false,
  filters,
  onApply,
}: MatchFiltersCardProps) {
  const [minimumScore, setMinimumScore] = useState(`${filters.minimumScore}`);
  const [maximumResults, setMaximumResults] = useState(`${filters.maximumResults}`);
  const [packageCategory, setPackageCategory] = useState(filters.packageCategory);
  const [verifiedOnly, setVerifiedOnly] = useState(filters.verifiedOnly);
  const [eligibleOnly, setEligibleOnly] = useState(filters.eligibleOnly);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMinimumScore(`${filters.minimumScore}`);
    setMaximumResults(`${filters.maximumResults}`);
    setPackageCategory(filters.packageCategory);
    setVerifiedOnly(filters.verifiedOnly);
    setEligibleOnly(filters.eligibleOnly);
  }, [filters]);

  function apply() {
    const score = Number(minimumScore);
    const limit = Number(maximumResults);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError("Minimum score must be from 0 to 100.");
      return;
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      setError("Maximum results must be a whole number from 1 to 10.");
      return;
    }
    setError(null);
    onApply({
      eligibleOnly,
      maximumResults: limit,
      minimumScore: score,
      packageCategory: packageCategory.trim(),
      verifiedOnly,
    });
  }

  function reset() {
    setError(null);
    onApply(defaultMatchDiscoveryFilters);
  }

  return (
    <Card padding="compact" variant="soft">
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Discovery filters</Text>
        <Text style={styles.title}>Refine recommendations</Text>
      </View>

      <View style={styles.fields}>
        <TextField
          containerStyle={styles.field}
          keyboardType="number-pad"
          label="Minimum score"
          maxLength={3}
          onChangeText={setMinimumScore}
          value={minimumScore}
        />
        <TextField
          containerStyle={styles.field}
          keyboardType="number-pad"
          label="Maximum results"
          maxLength={2}
          onChangeText={setMaximumResults}
          value={maximumResults}
        />
      </View>
      <TextField
        helperText="Optional exact category, such as documents or clothing."
        label="Package category"
        maxLength={80}
        onChangeText={setPackageCategory}
        value={packageCategory}
      />

      <FilterSwitch
        label="Verified only"
        description="Requires identity verification when that status is visible."
        onValueChange={setVerifiedOnly}
        value={verifiedOnly}
      />
      <FilterSwitch
        label="Eligible only"
        description="Hides matches blocked by route, capacity, or selected requirements."
        onValueChange={setEligibleOnly}
        value={eligibleOnly}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <PrimaryButton loading={applying} onPress={apply}>Apply filters</PrimaryButton>
        <PrimaryButton disabled={applying} variant="ghost" onPress={reset}>Reset</PrimaryButton>
      </View>
    </Card>
  );
}

interface FilterSwitchProps {
  readonly description: string;
  readonly label: string;
  readonly onValueChange: (value: boolean) => void;
  readonly value: boolean;
}

function FilterSwitch({ description, label, onValueChange, value }: FilterSwitchProps) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={styles.switchDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        thumbColor={colors.white}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xxs },
  eyebrow: { color: colors.primary, ...typography.overline },
  title: { color: colors.text, ...typography.subheading },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  field: { flex: 1, minWidth: 140 },
  switchRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  switchCopy: { flex: 1, gap: spacing.xxs },
  switchLabel: { color: colors.text, ...typography.label },
  switchDescription: { color: colors.textSecondary, ...typography.caption },
  error: { color: colors.error, ...typography.caption },
  actions: { gap: spacing.xs },
});
