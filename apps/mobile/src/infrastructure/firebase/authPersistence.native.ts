import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence } from "firebase/auth";

// Metro selects this file on iOS and Android.
export const firebaseAuthPersistence = getReactNativePersistence(AsyncStorage);
