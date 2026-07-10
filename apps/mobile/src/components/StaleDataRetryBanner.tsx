import { StyleSheet, View } from "react-native";
import { Banner } from "./Banner";
import { PrimaryButton } from "./PrimaryButton";
import { spacing } from "../theme/tokens";

type BaseStaleDataRetryBannerProps = {
  message: string;
  title: string;
  variant: "error" | "warning";
};

type StaleDataRetryBannerProps =
  | (BaseStaleDataRetryBannerProps & {
      onRetry: () => void;
      retryLabel: string;
    })
  | (BaseStaleDataRetryBannerProps & {
      onRetry?: undefined;
      retryLabel?: undefined;
    });

export function StaleDataRetryBanner({
  message,
  onRetry,
  retryLabel,
  title,
  variant,
}: StaleDataRetryBannerProps) {
  return (
    <View style={styles.container}>
      <Banner message={message} title={title} variant={variant} />
      {onRetry ? (
        <PrimaryButton onPress={onRetry} variant="secondary">
          {retryLabel}
        </PrimaryButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
});
