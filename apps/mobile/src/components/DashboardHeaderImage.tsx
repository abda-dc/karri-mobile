import { Image, ImageSourcePropType, Platform, StyleSheet } from "react-native";

type DashboardHeaderImageProps = {
  accessibilityLabel: string;
  aspectRatio: number;
  source: ImageSourcePropType;
};

export function DashboardHeaderImage({
  accessibilityLabel,
  aspectRatio,
  source,
}: DashboardHeaderImageProps) {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      resizeMode={Platform.OS === "web" ? "contain" : "cover"}
      source={source}
      style={[
        styles.image,
        Platform.OS === "web" && {
          aspectRatio,
          height: undefined,
          maxHeight: 180,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    alignSelf: "stretch",
    borderRadius: 28,
    height: 180,
    maxWidth: "100%",
    overflow: "hidden",
    width: "100%",
  },
});
