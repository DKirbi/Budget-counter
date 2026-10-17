/**
 * The app's single budget store, persisted to AsyncStorage.
 * AsyncStorage ships inside Expo Go, so the app runs there without a custom native build.
 * @module store
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBudgetStore } from '@tbc/core';

/** Singleton store. Tests inject their own via `<AppProviders store={…}>`. */
export const appStore = createBudgetStore({ storage: AsyncStorage });
