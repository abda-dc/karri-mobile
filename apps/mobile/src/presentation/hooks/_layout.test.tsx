import { vi } from "vitest";

// Define global variables required by Expo modules
(globalThis as any).__DEV__ = true;

// Mock native packages and components before importing layout
vi.mock("expo-router", () => ({
  Redirect: () => null,
  Slot: () => null,
  router: { replace: vi.fn() },
}));

vi.mock("react-native", () => ({
  StyleSheet: { create: () => ({}) },
  Text: () => null,
  View: () => null,
}));

vi.mock("../../components/LoadingState", () => ({ LoadingState: () => null }));
vi.mock("../../components/Screen", () => ({ Screen: () => null }));
vi.mock("../../components/Card", () => ({ Card: () => null }));
vi.mock("../../components/Banner", () => ({ Banner: () => null }));
vi.mock("../../components/PrimaryButton", () => ({ PrimaryButton: () => null }));

vi.mock("../services/mobileServices", () => ({
  mobileServices: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

import { describe, it, expect } from "vitest";
import AdminLayout from "../../../app/(admin)/_layout";
import { useAdminLayoutController } from "./useAdminLayoutController";
import { Slot } from "expo-router";

vi.mock("./useAuthSession", () => ({
  useAuthSession: vi.fn(() => ({
    user: null,
    loading: false,
    refreshAuthorization: vi.fn(),
  })),
}));

vi.mock("./useAdminLayoutController", () => ({
  useAdminLayoutController: vi.fn(),
}));

describe("AdminLayout Component Gating", () => {
  it("does not render Slot when all controller states are false", () => {
    vi.mocked(useAdminLayoutController).mockReturnValueOnce({
      shouldRenderSlot: false,
      shouldShowSpinner: false,
      shouldShowError: false,
      shouldRedirectToLogin: false,
      shouldRedirectToAccessDenied: false,
      signOutError: null,
      signingOut: false,
      triggerRefresh: vi.fn(),
      handleSignOut: vi.fn(),
    });

    const element = AdminLayout();
    expect(element.type).not.toBe(Slot);
  });
});
