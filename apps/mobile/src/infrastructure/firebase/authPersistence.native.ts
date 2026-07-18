import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence } from "firebase/auth";

export const firebaseAuthPersistence =
  getReactNativePersistence(AsyncStorage);
