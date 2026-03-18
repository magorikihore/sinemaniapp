import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Cross-platform storage that works on both native (SecureStore) and web (localStorage).
 */
export const storage = {
    async getItem(key: string): Promise<string | null> {
        if (Platform.OS === 'web') {
            try {
                return localStorage.getItem(key);
            } catch {
                return null;
            }
        }
        return SecureStore.getItemAsync(key);
    },

    async setItem(key: string, value: string): Promise<void> {
        if (Platform.OS === 'web') {
            try {
                localStorage.setItem(key, value);
            } catch { }
            return;
        }
        return SecureStore.setItemAsync(key, value);
    },

    async deleteItem(key: string): Promise<void> {
        if (Platform.OS === 'web') {
            try {
                localStorage.removeItem(key);
            } catch { }
            return;
        }
        return SecureStore.deleteItemAsync(key);
    },
};
