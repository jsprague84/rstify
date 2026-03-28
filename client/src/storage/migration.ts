import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, secureStorage } from './mmkv';

const MIGRATION_KEY = 'mmkv_migration_complete';

export async function migrateToMmkv(): Promise<void> {
  if (storage.getBoolean(MIGRATION_KEY)) {
    return; // Already migrated
  }

  try {
    // Migrate auth token from SecureStore
    const token = await SecureStore.getItemAsync('rstify_token');
    if (token) {
      secureStorage.set('rstify_token', token);
    }

    // Migrate server URL from SecureStore
    const serverUrl = await SecureStore.getItemAsync('rstify_server_url');
    if (serverUrl) {
      secureStorage.set('rstify_server_url', serverUrl);
    }

    // Migrate theme preference from AsyncStorage
    const themeMode = await AsyncStorage.getItem('theme_mode');
    if (themeMode) {
      storage.set('theme_mode', themeMode);
    }

    // Mark migration complete
    storage.set(MIGRATION_KEY, true);

    // Clean up old stores (best-effort)
    try {
      await SecureStore.deleteItemAsync('rstify_token');
      await SecureStore.deleteItemAsync('rstify_server_url');
      await AsyncStorage.removeItem('theme_mode');
    } catch {
      // Cleanup failure is non-critical
    }
  } catch (error) {
    console.warn('MMKV migration failed, will retry on next launch:', error);
  }
}
