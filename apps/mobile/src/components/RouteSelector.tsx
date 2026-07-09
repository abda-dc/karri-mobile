import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  airportRouteOptions,
  type AirportRouteOption,
} from "../data/routes/airports";
import { colors, radii, spacing, touchTargets, typography } from "../theme/tokens";

export type RouteSelection = {
  country: string;
  subdivision: string;
  city: string;
};

export const defaultOriginRoute: RouteSelection = {
  city: "Washington, DC",
  country: "United States",
  subdivision: "",
};

type RouteSelectorProps = {
  label: string;
  onChange: (value: RouteSelection) => void;
  value: RouteSelection;
};

function getAirportLabel(option: AirportRouteOption): string {
  return `${option.code} - ${option.airportName}`;
}

function getAirportSubtitle(option: AirportRouteOption): string {
  return `${option.city}, ${option.country}`;
}

function findSelectedAirport(value: RouteSelection): AirportRouteOption | undefined {
  return airportRouteOptions.find(
    (option) => option.city === value.city && option.country === value.country,
  );
}

export function RouteSelector({ label, onChange, value }: RouteSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedAirport = useMemo(() => findSelectedAirport(value), [value]);
  const selectedLabel = selectedAirport
    ? getAirportLabel(selectedAirport)
    : value.city && value.country
      ? `${value.city}, ${value.country}`
      : "";
  const selectedAccessibilityLabel = selectedAirport
    ? `${getAirportLabel(selectedAirport)}, ${getAirportSubtitle(selectedAirport)}`
    : value.city && value.country
      ? `${value.city}, ${value.country}`
      : "no airport selected";

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{label}</Text>
      <Pressable
        accessibilityHint={
          open ? "Double tap to collapse airport options." : "Double tap to choose an airport."
        }
        accessibilityLabel={`${label} airport, ${selectedAccessibilityLabel}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <View style={styles.triggerText}>
          <Text numberOfLines={1} style={selectedLabel ? styles.value : styles.placeholder}>
            {selectedLabel || "Select airport"}
          </Text>
          {selectedAirport ? (
            <Text numberOfLines={1} style={styles.selectedSubtitle}>
              {getAirportSubtitle(selectedAirport)}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>{open ? "^" : "v"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.options}>
          {airportRouteOptions.map((option) => {
            const selected = option === selectedAirport;

            return (
              <Pressable
                accessibilityLabel={`${label}: ${getAirportLabel(option)}, ${getAirportSubtitle(
                  option,
                )}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.code}
                onPress={() => {
                  onChange({
                    city: option.city,
                    country: option.country,
                    subdivision: "",
                  });
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.selectedOption,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={selected ? styles.selectedOptionText : styles.optionText}>
                  {getAirportLabel(option)}
                </Text>
                <Text style={styles.optionSubtitle}>{getAirportSubtitle(option)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  heading: { color: colors.primaryDark, ...typography.subheading },
  trigger: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  triggerText: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  value: { color: colors.text, ...typography.bodyStrong },
  placeholder: { color: colors.muted, ...typography.body },
  selectedSubtitle: { color: colors.textSecondary, ...typography.caption },
  chevron: { color: colors.primary, ...typography.caption },
  options: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  option: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xxs,
    justifyContent: "center",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedOption: { backgroundColor: colors.primarySoft },
  optionText: { color: colors.text, ...typography.bodyStrong },
  selectedOptionText: { color: colors.primaryDark, ...typography.bodyStrong },
  optionSubtitle: { color: colors.textSecondary, ...typography.caption },
  pressed: { opacity: 0.72 },
});
