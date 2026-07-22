import { useState } from "react";
import {
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
} from "react-native";

type DashboardHeaderImageProps = {
  accessibilityLabel: string;
  aspectRatio: number;
  source: ImageSourcePropType;
};

const fallbackNativeHeight = 180;

export function DashboardHeaderImage({
  accessibilityLabel,
  aspectRatio,
  source,
}: DashboardHeaderImageProps) {
  const [nativeWidth, setNativeWidth] = useState(0);

  if (Platform.OS === "web") {
    return (
      <Image
        accessibilityLabel={accessibilityLabel}
        resizeMode="contain"
        source={source}
        style={[styles.webImage, { aspectRatio }]}
      />
    );
  }

  const nativeHeight =
    nativeWidth > 0 ? nativeWidth / aspectRatio : fallbackNativeHeight;

  function handleLayout(event: LayoutChangeEvent) {
    const measuredWidth = Math.round(event.nativeEvent.layout.width);

    if (measuredWidth > 0 && measuredWidth !== nativeWidth) {
      setNativeWidth(measuredWidth);
    }
  }

  return (
    <View
      onLayout={handleLayout}
      style={[styles.nativeFrame, { height: nativeHeight }]}
    >
      <Image
        accessibilityLabel={accessibilityLabel}
        resizeMode="contain"
        source={source}
        style={styles.nativeImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nativeFrame: {
    alignSelf: "stretch",
    borderRadius: 28,
    overflow: "hidden",
    width: "100%",
  },
  nativeImage: {
    height: "100%",
    width: "100%",
  },
  webImage: {
    alignSelf: "stretch",
    borderRadius: 28,
    height: undefined,
    maxHeight: 180,
    maxWidth: "100%",
    overflow: "hidden",
    width: "100%",
  },
});
