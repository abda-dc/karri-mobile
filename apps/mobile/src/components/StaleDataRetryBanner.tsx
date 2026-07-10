import { Banner } from "./Banner";
import { PrimaryButton } from "./PrimaryButton";

type StaleDataRetryBannerProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  title: string;
  variant: "error" | "warning";
};

export function StaleDataRetryBanner({
  message,
  onRetry,
  retryLabel,
  title,
  variant,
}: StaleDataRetryBannerProps) {
  return (
    <>
      <Banner message={message} title={title} variant={variant} />
      {onRetry ? (
        <PrimaryButton onPress={onRetry} variant="secondary">
          {retryLabel}
        </PrimaryButton>
      ) : null}
    </>
  );
}
