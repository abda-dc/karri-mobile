import { Tabs } from "expo-router";
import { colors, layout, radii, typography } from "../../src/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarAllowFontScaling: false,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: colors.muted,
        tabBarItemStyle: {
          borderRadius: radii.md,
          marginHorizontal: 2,
          marginVertical: 6,
        },
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          fontWeight: "700",
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          minHeight: layout.tabBarMinHeight,
          paddingHorizontal: 6,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="send" options={{ title: "Send" }} />
      <Tabs.Screen name="travel" options={{ title: "Travel" }} />
      <Tabs.Screen name="tracking" options={{ title: "Track" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
