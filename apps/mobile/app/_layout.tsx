import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useLocalNotificationRouting } from "../src/presentation/hooks/useLocalNotificationRouting";
import { colors } from "../src/theme/tokens";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  useLocalNotificationRouting();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          animation: "slide_from_right",
          contentStyle: { backgroundColor: colors.background },
          gestureEnabled: true,
          headerShown: false,
        }}
      />
    </>
  );
}
