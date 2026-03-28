import { createMMKV } from 'react-native-mmkv';

// Default storage for preferences, cache, UI state
export const storage = createMMKV({
  id: 'rstify-default',
});

// Encrypted storage for auth tokens and sensitive data
// TODO: In a future pass, derive encryption key from OS keychain instead of hardcoding
export const secureStorage = createMMKV({
  id: 'rstify-secure',
  encryptionKey: 'rstify-secure-v1',
});

// Zustand persist middleware adapter for MMKV
export const mmkvStateStorage = {
  getItem: (name: string): string | null => {
    return storage.getString(name) ?? null;
  },
  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },
  removeItem: (name: string): void => {
    storage.remove(name);
  },
};
