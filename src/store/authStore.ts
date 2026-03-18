import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { User } from '../types';
import { authService } from '../services/authService';
import { storage } from '../utils/storage';

interface AuthState {
    user: User | null;
    isLoggedIn: boolean;
    isGuest: boolean;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    refreshUser: () => Promise<void>;
    initGuest: () => Promise<void>;
}

async function getDeviceId(): Promise<string> {
    if (Platform.OS === 'android') {
        return Application.getAndroidId() || 'android-unknown';
    }
    if (Platform.OS === 'ios') {
        return (await Application.getIosIdForVendorAsync()) || 'ios-unknown';
    }
    // Web / fallback — use a stored random ID
    let id = await storage.getItem('device_id');
    if (!id) {
        id = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        await storage.setItem('device_id', id);
    }
    return id;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isLoggedIn: false,
    isGuest: false,
    isLoading: true,

    setUser: (user) => set({ user, isLoggedIn: !!user }),

    login: async (email, password) => {
        const data = await authService.login({ email, password });
        await storage.setItem('is_guest', 'false');
        set({ user: data.user, isLoggedIn: true, isGuest: false });
    },

    register: async (name, email, password) => {
        const data = await authService.register({
            name,
            email,
            password,
            password_confirmation: password,
        });
        await storage.setItem('is_guest', 'false');
        set({ user: data.user, isLoggedIn: true, isGuest: false });
    },

    logout: async () => {
        await authService.logout();
        await storage.deleteItem('is_guest');
        set({ user: null, isLoggedIn: false, isGuest: false });
        // Re-init as guest
        await get().initGuest();
    },

    initGuest: async () => {
        try {
            // Check if we already have a valid session
            const existingToken = await authService.getToken();
            if (existingToken) {
                try {
                    const user = await authService.getMe();
                    const isGuest = (await storage.getItem('is_guest')) === 'true';
                    set({ user, isLoggedIn: true, isGuest, isLoading: false });
                    return;
                } catch {
                    // Token expired, clear and re-init via device ID
                    await storage.deleteItem('auth_token');
                }
            }

            // Use device ID to get or create guest account
            const deviceId = await getDeviceId();
            const data = await authService.guestInit(deviceId);
            await storage.setItem('is_guest', 'true');
            set({ user: data.user, isLoggedIn: true, isGuest: true, isLoading: false });
        } catch (err) {
            console.log('Guest init failed', err);
            set({ isLoading: false, isGuest: true });
        }
    },

    checkAuth: async () => {
        try {
            const token = await authService.getToken();
            if (token) {
                const user = await authService.getMe();
                const isGuest = (await storage.getItem('is_guest')) === 'true';
                set({ user, isLoggedIn: true, isGuest, isLoading: false });
            } else {
                await get().initGuest();
            }
        } catch {
            await storage.deleteItem('auth_token');
            await get().initGuest();
        }
    },

    refreshUser: async () => {
        try {
            const user = await authService.getMe();
            set({ user });
        } catch { }
    },
}));
