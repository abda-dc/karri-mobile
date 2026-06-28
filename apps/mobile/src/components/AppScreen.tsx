import { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "../theme/tokens";

type AppScreenProps = {
  children: ReactNode;
};

export function AppScreen({ children }: AppScreenProps) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: "center",
  },
  inner: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
});
