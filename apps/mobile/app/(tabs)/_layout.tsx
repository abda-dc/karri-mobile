import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ColorValue } from "react-native";
import { colors, layout, radii, typography } from "../../src/theme/tokens";

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  size: number;
};

function tabIcon(outlineName: keyof typeof Ionicons.glyphMap, filledName: keyof typeof Ionicons.glyphMap) {
  return function TabIcon({ color, focused, size }: TabIconProps) {
    return <Ionicons color={color} name={focused ? filledName : outlineName} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarAllowFontScaling: true,
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
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: tabIcon("home-outline", "home"), title: "Home" }}
      />
      <Tabs.Screen
        name="send"
        options={{ tabBarIcon: tabIcon("paper-plane-outline", "paper-plane"), title: "Send" }}
      />
      <Tabs.Screen
        name="travel"
        options={{ tabBarIcon: tabIcon("airplane-outline", "airplane"), title: "Travel" }}
      />
      <Tabs.Screen
        name="tracking"
        options={{ tabBarIcon: tabIcon("location-outline", "location"), title: "Track" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: tabIcon("person-outline", "person"), title: "Profile" }}
      />
    </Tabs>
  );
}
