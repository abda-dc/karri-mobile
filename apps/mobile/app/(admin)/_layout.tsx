import { Redirect, Slot, router } from "expo-router";
import { useAuthSession } from "../../src/presentation/hooks/useAuthSession";
import { LoadingState } from "../../src/components/LoadingState";
import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { Banner } from "../../src/components/Banner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAdminLayoutController } from "../../src/presentation/hooks/useAdminLayoutController";
import { mobileServices } from "../../src/presentation/services/mobileServices";

export default function AdminLayout() {
  const { user, loading, refreshAuthorization } = useAuthSession();

  const controller = useAdminLayoutController({
    user,
    loading,
    refreshAuthorization,
    signOut: () => mobileServices.auth.signOut(),
    navigateTo: (route) => router.replace(route),
  });

  if (controller.shouldShowSpinner) {
    return (
      <Screen centered>
        <LoadingState message="Verifying administrator credentials..." />
      </Screen>
    );
  }

  if (controller.shouldShowError) {
    return (
      <Screen centered>
        <Card variant="elevated">
          <Banner
            message="Karri could not verify your administrative permissions due to a refresh error. Please check your network connection."
            title="Verification Failed"
            variant="error"
          />
          {controller.signOutError ? (
            <Banner message={controller.signOutError} title="Sign Out Failed" variant="error" />
          ) : null}
          <PrimaryButton
            onPress={() => controller.triggerRefresh()}
            style={{ marginTop: 16 }}
            disabled={controller.signingOut}
          >
            Retry Verification
          </PrimaryButton>
          <PrimaryButton
            variant="ghost"
            onPress={controller.handleSignOut}
            style={{ marginTop: 8 }}
            loading={controller.signingOut}
            disabled={controller.signingOut}
          >
            Sign Out
          </PrimaryButton>
        </Card>
      </Screen>
    );
  }

  if (controller.shouldRedirectToLogin) {
    return <Redirect href="/admin-login" />;
  }

  if (controller.shouldRedirectToAccessDenied) {
    return <Redirect href="/access-denied" />;
  }

  if (controller.shouldRenderSlot) {
    return <Slot />;
  }

  return (
    <Screen centered>
      <LoadingState message="Verifying administrator credentials..." />
    </Screen>
  );
}
