import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { StatusChip } from "../../components/StatusChip";
import type { Booking } from "../../domain/booking/Booking";
import { colors, spacing, typography } from "../../theme/tokens";
import { getRecommendedAction } from "./operationalPresentation";

interface NextActionCardProps {
  readonly booking: Booking;
  readonly currentUserId: string;
}

export function NextActionCard({ booking, currentUserId }: NextActionCardProps) {
  const action = getRecommendedAction(booking);
  const currentRole = booking.senderId === currentUserId ? "sender" : "traveler";
  const isYours = action.owner === currentRole || action.owner === "none";

  return (
    <Card padding="compact" variant="soft">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Recommended next action</Text>
        <StatusChip
          label={action.owner === "none" ? "Optional" : isYours ? "Your turn" : `${action.owner}'s turn`}
          tone={isYours ? "active" : "neutral"}
        />
      </View>
      <Text style={styles.title}>{action.title}</Text>
      <Text style={styles.explanation}>{action.explanation}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  eyebrow: {
    color: colors.primary,
    ...typography.overline,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  explanation: {
    color: colors.textSecondary,
    ...typography.body,
  },
});
