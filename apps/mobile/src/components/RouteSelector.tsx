import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ethiopianAirlinesRoutes,
  type RouteCountry,
} from "../data/routes/ethiopianAirlinesRoutes";
import { colors, radii, spacing, touchTargets, typography } from "../theme/tokens";

export type RouteSelection = {
  country: string;
  subdivision: string;
  city: string;
};

type RouteSelectorProps = {
  label: string;
  onChange: (value: RouteSelection) => void;
  value: RouteSelection;
};

type PickerProps = {
  label: string;
  options: string[];
  placeholder: string;
  value: string;
  onSelect: (value: string) => void;
};

function InlinePicker({ label, onSelect, options, placeholder, value }: PickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label} *</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={value ? styles.value : styles.placeholder}>{value || placeholder}</Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.options}>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => {
                onSelect(option);
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.option,
                option === value && styles.selectedOption,
                pressed && styles.pressed,
              ]}
            >
              <Text style={option === value ? styles.selectedOptionText : styles.optionText}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function RouteSelector({ label, onChange, value }: RouteSelectorProps) {
  const [selectedSubdivision, setSelectedSubdivision] = useState(value.subdivision);
  const country = useMemo<RouteCountry | undefined>(
    () => ethiopianAirlinesRoutes.find((item) => item.name === value.country),
    [value.country],
  );
  const subdivision = country?.subdivisions?.find((item) => item.name === selectedSubdivision);
  const cities = country?.subdivisions ? subdivision?.cities ?? [] : country?.cities ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{label}</Text>
      <InlinePicker
        label="Country"
        onSelect={(selectedCountry) => {
          setSelectedSubdivision("");
          onChange({ country: selectedCountry, subdivision: "", city: "" });
        }}
        options={ethiopianAirlinesRoutes.map((item) => item.name)}
        placeholder="Select country"
        value={value.country}
      />
      {country?.subdivisions ? (
        <InlinePicker
          label="State / province / region"
          onSelect={(nextSubdivision) => {
            setSelectedSubdivision(nextSubdivision);
            onChange({ ...value, subdivision: nextSubdivision, city: "" });
          }}
          options={country.subdivisions.map((item) => item.name)}
          placeholder="Select region"
          value={selectedSubdivision}
        />
      ) : null}
      {country && (!country.subdivisions || selectedSubdivision) ? (
        <InlinePicker
          label="City"
          onSelect={(city) => onChange({ ...value, subdivision: selectedSubdivision, city })}
          options={cities}
          placeholder="Select city"
          value={value.city}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  heading: { color: colors.primaryDark, ...typography.subheading },
  field: { gap: spacing.xs },
  label: { color: colors.text, ...typography.label },
  trigger: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
  },
  value: { color: colors.text, flex: 1, ...typography.body },
  placeholder: { color: colors.muted, flex: 1, ...typography.body },
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
    justifyContent: "center",
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedOption: { backgroundColor: colors.primarySoft },
  optionText: { color: colors.text, ...typography.body },
  selectedOptionText: { color: colors.primaryDark, ...typography.bodyStrong },
  pressed: { opacity: 0.72 },
});
