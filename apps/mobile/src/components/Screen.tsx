import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, layout } from "../theme/tokens";

type ScreenProps = {
  children: ReactNode;
  centered?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  withTabBar?: boolean;
};

export function Screen({
  children,
  centered = false,
  contentStyle,
  scroll = true,
  withTabBar = false,
}: ScreenProps) {
  const contentStyles = [
    styles.content,
    centered && styles.centered,
    withTabBar && styles.withTabBar,
    contentStyle,
  ];

  return (
    <SafeAreaView
      edges={withTabBar ? ["top", "left", "right"] : ["top", "left", "right", "bottom"]}
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardArea}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={contentStyles}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.screen}
          >
            <View style={styles.inner}>{children}</View>
          </ScrollView>
        ) : (
          <View style={contentStyles}>
            <View style={styles.inner}>{children}</View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboardArea: {
    flex: 1,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: layout.screenPaddingBottom,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: layout.screenPaddingTop,
  },
  centered: {
    justifyContent: "center",
  },
  withTabBar: {
    paddingBottom: layout.screenPaddingBottomWithTabBar,
  },
  inner: {
    alignSelf: "center",
    maxWidth: layout.contentMaxWidth,
    width: "100%",
  },
});
