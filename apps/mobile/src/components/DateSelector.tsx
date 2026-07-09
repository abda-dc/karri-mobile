import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, radii, spacing, touchTargets, typography } from "../theme/tokens";

type DateSelectorProps = {
  containerStyle?: StyleProp<ViewStyle>;
  expanded?: boolean;
  helperText?: string;
  label: string;
  minimumDate?: string;
  onChange: (value: string) => void;
  onExpandedChange?: (expanded: boolean) => void;
  required?: boolean;
  value: string;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const shortMonthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function parseIsoDate(value: string): { day: number; monthIndex: number; year: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const daysInSelectedMonth = new Date(year, monthIndex + 1, 0).getDate();

  if (
    !Number.isInteger(year) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > daysInSelectedMonth
  ) {
    return null;
  }

  return { day, monthIndex, year };
}

function getInitialMonth(value: string): { monthIndex: number; year: number } {
  const parsed = parseIsoDate(value);
  if (parsed) return { monthIndex: parsed.monthIndex, year: parsed.year };

  const today = new Date();
  return { monthIndex: today.getMonth(), year: today.getFullYear() };
}

function formatReadableDate(value: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return "Choose a date";
  return `${shortMonthNames[parsed.monthIndex]} ${parsed.day}, ${parsed.year}`;
}

export function DateSelector({
  containerStyle,
  expanded,
  helperText,
  label,
  minimumDate,
  onChange,
  onExpandedChange,
  required = false,
  value,
}: DateSelectorProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getInitialMonth(value));
  const selectedDate = parseIsoDate(value);
  const today = new Date();
  const todayIsoDate = formatIsoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const isExpanded = expanded ?? internalExpanded;

  useEffect(() => {
    const nextMonth = getInitialMonth(value);
    setVisibleMonth(nextMonth);
  }, [value]);

  const days = useMemo(
    () =>
      Array.from(
        { length: new Date(visibleMonth.year, visibleMonth.monthIndex + 1, 0).getDate() },
        (_, index) => index + 1,
      ),
    [visibleMonth],
  );
  const leadingBlankCells = useMemo(
    () => Array.from({ length: new Date(visibleMonth.year, visibleMonth.monthIndex, 1).getDay() }),
    [visibleMonth],
  );

  function setExpanded(nextExpanded: boolean) {
    if (expanded === undefined) {
      setInternalExpanded(nextExpanded);
    }
    onExpandedChange?.(nextExpanded);
  }

  function moveMonth(direction: -1 | 1) {
    setVisibleMonth((current) => {
      const nextMonthIndex = current.monthIndex + direction;
      if (nextMonthIndex < 0) {
        return { monthIndex: 11, year: current.year - 1 };
      }
      if (nextMonthIndex > 11) {
        return { monthIndex: 0, year: current.year + 1 };
      }
      return { ...current, monthIndex: nextMonthIndex };
    });
  }

  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.selector}>
        <Pressable
          accessibilityLabel={`${label}: ${formatReadableDate(value)}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          onPress={() => setExpanded(!isExpanded)}
          style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
        >
          <Text style={value ? styles.value : styles.placeholder}>
            {formatReadableDate(value)}
          </Text>
          <Text style={styles.summaryIndicator}>{isExpanded ? "^" : "v"}</Text>
        </Pressable>
        {isExpanded ? (
          <>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityLabel="Previous month"
                accessibilityRole="button"
                hitSlop={touchTargets.hitSlop}
                onPress={() => moveMonth(-1)}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              >
                <Text style={styles.monthButtonText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.monthTitle}>
                {monthNames[visibleMonth.monthIndex]} {visibleMonth.year}
              </Text>
              <Pressable
                accessibilityLabel="Next month"
                accessibilityRole="button"
                hitSlop={touchTargets.hitSlop}
                onPress={() => moveMonth(1)}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              >
                <Text style={styles.monthButtonText}>{">"}</Text>
              </Pressable>
            </View>
            <View style={styles.weekdayGrid}>
              {weekdayNames.map((weekdayName) => (
                <Text key={weekdayName} style={styles.weekday}>
                  {weekdayName}
                </Text>
              ))}
            </View>
            <View style={styles.dayGrid}>
              {leadingBlankCells.map((_, index) => (
                <View key={`blank-${index}`} style={styles.blankDay} />
              ))}
              {days.map((day) => {
                const isoDate = formatIsoDate(visibleMonth.year, visibleMonth.monthIndex, day);
                const selected = selectedDate
                  ? selectedDate.year === visibleMonth.year &&
                    selectedDate.monthIndex === visibleMonth.monthIndex &&
                    selectedDate.day === day
                  : false;
                const disabled = minimumDate ? isoDate < minimumDate : false;
                const todayVisible = isoDate === todayIsoDate && !selected;

                return (
                  <Pressable
                    accessibilityLabel={`${label}: ${isoDate}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected }}
                    disabled={disabled}
                    key={isoDate}
                    onPress={() => {
                      onChange(isoDate);
                      setExpanded(false);
                    }}
                    style={({ pressed }) => [
                      styles.day,
                      todayVisible && styles.today,
                      selected && styles.selectedDay,
                      disabled && styles.disabledDay,
                      pressed && !disabled && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        todayVisible && styles.todayText,
                        selected && styles.selectedDayText,
                        disabled && styles.disabledDayText,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    ...typography.label,
  },
  required: {
    color: colors.error,
  },
  selector: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  summary: {
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.sm,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  value: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  placeholder: {
    color: colors.muted,
    ...typography.body,
  },
  summaryIndicator: {
    color: colors.primary,
    ...typography.bodyStrong,
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  monthButton: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: touchTargets.minimum,
    minWidth: touchTargets.minimum,
  },
  monthButtonText: {
    color: colors.primary,
    ...typography.bodyStrong,
  },
  monthTitle: {
    color: colors.text,
    flex: 1,
    textAlign: "center",
    ...typography.label,
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  weekdayGrid: {
    flexDirection: "row",
  },
  weekday: {
    color: colors.textSecondary,
    flexBasis: `${100 / 7}%`,
    textAlign: "center",
    ...typography.caption,
    fontWeight: "800",
  },
  blankDay: {
    flexBasis: `${100 / 7}%`,
    minHeight: touchTargets.minimum,
  },
  day: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: `${100 / 7}%`,
    justifyContent: "center",
    minHeight: touchTargets.minimum,
  },
  today: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  selectedDay: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  disabledDay: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.48,
  },
  dayText: {
    color: colors.text,
    ...typography.label,
  },
  todayText: {
    color: colors.primaryDark,
  },
  selectedDayText: {
    color: colors.white,
  },
  disabledDayText: {
    color: colors.muted,
  },
  pressed: {
    opacity: 0.76,
  },
  helper: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
