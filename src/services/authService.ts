import api from './api';
import { storage } from '../utils/storage';
import { User, ApiResponse } from '../types';

export const authService = {
    async register(data: { name: string; email: string; password: string; password_confirmation: string }) {
        const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/register', data);
        await this.saveSession(res.data.data);
        return res.data.data;
    },

    async login(data: { email: string; password: string }) {
        const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', data);
        await this.saveSession(res.data.data);
        return res.data.data;
    },

    async guestInit(deviceId: string) {
        const res = await api.post<ApiResponse<{ user: User; token: string; is_new: boolean }>>('/auth/guest/init', {
            device_id: deviceId,
        });
        await this.saveSession(res.data.data);
        return res.data.data;
    },

    async socialLogin(data: { provider: string; token: string; name?: string; email?: string }) {
        const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/social-login', data);
        await this.saveSession(res.data.data);
        return res.data.data;
    },

    async logout() {
        try {
            await api.post('/v1/auth/logout');
        } finally {
            await storage.deleteItem('auth_token');
            await storage.deleteItem('user');
        }
    },

    async getMe() {
        const res = await api.get<ApiResponse<User>>('/v1/auth/me');
        await storage.setItem('user', JSON.stringify(res.data.data));
        return res.data.data;
    },

    async updateFcmToken(fcm_token: string) {
        return api.put('/v1/auth/fcm-token', { fcm_token });
    },

    async forgotPassword(email: string) {
        const res = await api.post('/auth/forgot-password', { email });
        return res.data;
    },

    async resetPassword(data: { email: string; code: string; password: string; password_confirmation: string }) {
        const res = await api.post('/auth/reset-password', data);
        return res.data;
    },

    async getStoredUser(): Promise<User | null> {
        const json = await storage.getItem('user');
        return json ? JSON.parse(json) : null;
    },

    async getToken(): Promise<string | null> {
        return storage.getItem('auth_token');
    },

    async isLoggedIn(): Promise<boolean> {
        const token = await this.getToken();
        return !!token;
    },

    async saveSession(data: { user: User; token: string }) {
        await storage.setItem('auth_token', data.token);
        await storage.setItem('user', JSON.stringify(data.user));
    },
};
