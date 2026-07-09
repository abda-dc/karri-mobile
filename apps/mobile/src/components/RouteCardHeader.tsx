import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import { StatusChip } from "./StatusChip";

type StatusTone = "active" | "info" | "neutral" | "success" | "warning";

type RouteCardHeaderProps = {
  destinationCity: string;
  destinationCountry: string;
  originCity: string;
  originCountry: string;
  status: string;
  statusTone?: StatusTone;
};

export function RouteCardHeader({
  destinationCity,
  destinationCountry,
  originCity,
  originCountry,
  status,
  statusTone = "neutral",
}: RouteCardHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.route}>
        <View style={styles.stop}>
          <Text numberOfLines={2} style={styles.originCity}>
            {originCity}
          </Text>
          <Text numberOfLines={2} style={styles.country}>
            {originCountry}
          </Text>
        </View>

        <View
          accessibilityElementsHidden
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.connector}
        >
          <View style={styles.connectorLine} />
          <Text style={styles.connectorArrow}>{">"}</Text>
        </View>

        <View style={styles.stop}>
          <Text numberOfLines={2} style={styles.destinationCity}>
            {destinationCity}
          </Text>
          <Text numberOfLines={2} style={styles.country}>
            {destinationCountry}
          </Text>
        </View>
      </View>

      <StatusChip label={status} tone={statusTone} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  route: {
    alignSelf: "stretch",
    gap: spacing.xs,
    minWidth: 0,
  },
  stop: {
    gap: spacing.xxs,
    minWidth: 0,
  },
  originCity: {
    color: colors.textSecondary,
    flexShrink: 1,
    ...typography.label,
  },
  destinationCity: {
    color: colors.text,
    flexShrink: 1,
    ...typography.subheading,
  },
  country: {
    color: colors.muted,
    flexShrink: 1,
    ...typography.caption,
  },
  connector: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  connectorLine: {
    backgroundColor: colors.borderStrong,
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  connectorArrow: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "800",
  },
});
