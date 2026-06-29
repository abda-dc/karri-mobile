import type { Persistence } from "firebase/auth";
import "firebase/auth";

type ReactNativePersistenceStorage = {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
};

// Firebase 12's runtime resolves the React Native Auth entry through Metro,
// but the umbrella package's generic TypeScript entry omits this RN-only API.
declare module "firebase/auth" {
  export function getReactNativePersistence(
    storage: ReactNativePersistenceStorage,
  ): Persistence;
}
