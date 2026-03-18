import api from './api';
import { Drama, Episode, HomeData, Category, Comment, ApiResponse, PaginatedResponse, WatchHistory, CoinPackage, SubscriptionPlan, Subscription, CoinTransaction, Notification, MobilePayment } from '../types';

// â”€â”€ Home & Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const contentService = {
    async getHome() {
        const res = await api.get<ApiResponse<HomeData>>('/v1/home');
        return res.data;
    },

    async getDramas(params?: { page?: number; category_id?: number; search?: string; sort?: string }) {
        const res = await api.get<ApiResponse<PaginatedResponse<Drama>>>('/v1/dramas', { params });
        return res.data;
    },

    async getFeatured() {
        const res = await api.get<ApiResponse<Drama[]>>('/v1/dramas/featured');
        return res.data;
    },

    async getTrending() {
        const res = await api.get<ApiResponse<Drama[]>>('/v1/dramas/trending');
        return res.data;
    },

    async getNewReleases() {
        const res = await api.get<ApiResponse<Drama[]>>('/v1/dramas/new-releases');
        return res.data;
    },

    async getDrama(id: number) {
        const res = await api.get<ApiResponse<Drama>>(`/v1/dramas/${id}`);
        return res.data;
    },

    async getCategories() {
        const res = await api.get<ApiResponse<Category[]>>('/v1/categories');
        return res.data;
    },

    async getCategoryDramas(categoryId: number) {
        const res = await api.get<ApiResponse<Category>>(`/v1/categories/${categoryId}`);
        return res.data;
    },
};

// â”€â”€ Episodes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const episodeService = {
    async getEpisode(id: number) {
        const res = await api.get<ApiResponse<Episode>>(`/v1/episodes/${id}`);
        return res.data;
    },

    async getNextEpisode(id: number) {
        const res = await api.get<ApiResponse<Episode>>(`/v1/episodes/${id}/next`);
        return res.data;
    },

    async unlockEpisode(id: number) {
        const res = await api.post<ApiResponse<Episode>>(`/v1/episodes/${id}/unlock`);
        return res.data;
    },

    async updateProgress(id: number, progress_seconds: number, completed: boolean = false) {
        return api.post(`/v1/episodes/${id}/progress`, { progress_seconds, completed });
    },

    async getComments(episodeId: number, page: number = 1) {
        const res = await api.get<ApiResponse<PaginatedResponse<Comment>>>(`/v1/episodes/${episodeId}/comments`, { params: { page } });
        return res.data;
    },

    async addComment(episodeId: number, content: string) {
        const res = await api.post<ApiResponse<Comment>>(`/v1/episodes/${episodeId}/comments`, { content });
        return res.data;
    },

    async deleteComment(commentId: number) {
        return api.delete(`/v1/comments/${commentId}`);
    },
};

// â”€â”€ Watch History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const watchHistoryService = {
    async getHistory(page: number = 1) {
        const res = await api.get<ApiResponse<PaginatedResponse<WatchHistory>>>('/v1/watch-history', { params: { page } });
        return res.data;
    },

    async getContinueWatching() {
        const res = await api.get<ApiResponse<WatchHistory[]>>('/v1/continue-watching');
        return res.data;
    },

    async remove(id: number) {
        return api.delete(`/v1/watch-history/${id}`);
    },

    async clearAll() {
        return api.delete('/v1/watch-history');
    },
};

// â”€â”€ Watchlist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const watchlistService = {
    async getWatchlist(page: number = 1) {
        const res = await api.get<ApiResponse<PaginatedResponse<Drama>>>('/v1/watchlist', { params: { page } });
        return res.data;
    },

    async add(dramaId: number) {
        return api.post(`/v1/watchlist/${dramaId}`);
    },

    async remove(dramaId: number) {
        return api.delete(`/v1/watchlist/${dramaId}`);
    },

    async check(dramaId: number) {
        const res = await api.get<ApiResponse<{ is_watchlisted: boolean }>>(`/v1/watchlist/${dramaId}/check`);
        return res.data;
    },
};

// â”€â”€ Likes & Ratings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const interactionService = {
    async toggleDramaLike(dramaId: number) {
        return api.post(`/v1/dramas/${dramaId}/like`);
    },

    async toggleEpisodeLike(episodeId: number) {
        return api.post(`/v1/episodes/${episodeId}/like`);
    },

    async rateDrama(dramaId: number, score: number, review?: string) {
        return api.post(`/v1/dramas/${dramaId}/rate`, { score, review });
    },

    async toggleCommentLike(commentId: number) {
        return api.post(`/v1/comments/${commentId}/like`);
    },
};

// â”€â”€ Subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const subscriptionService = {
    async getPlans() {
        const res = await api.get<ApiResponse<SubscriptionPlan[]>>('/v1/subscriptions/plans');
        return res.data;
    },

    async getCurrent() {
        const res = await api.get<ApiResponse<Subscription | null>>('/v1/subscriptions/current');
        return res.data;
    },

    async getHistory() {
        const res = await api.get<ApiResponse<Subscription[]>>('/v1/subscriptions/history');
        return res.data;
    },

    async subscribe(plan_id: number) {
        return api.post('/v1/subscriptions/subscribe', { plan_id });
    },

    async cancel() {
        return api.post('/v1/subscriptions/cancel');
    },
};

// â”€â”€ Payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const paymentService = {
    async purchaseCoins(data: { package_id: number; phone: string }) {
        const res = await api.post('/v1/payments/purchase-coins', data);
        return res.data;
    },

    async purchaseSubscription(data: { plan_id: number; phone: string }) {
        const res = await api.post('/v1/payments/purchase-subscription', data);
        return res.data;
    },

    async checkStatus(reference: string) {
        const res = await api.get<ApiResponse<MobilePayment>>(`/v1/payments/${reference}/status`);
        return res.data;
    },

    async getHistory(page: number = 1) {
        const res = await api.get<ApiResponse<PaginatedResponse<MobilePayment>>>('/v1/payments/history', { params: { page } });
        return res.data;
    },

    // Guest payments (no auth required)
    async guestPurchaseCoins(data: { package_id: number; phone: string }) {
        const res = await api.post('/v1/guest/payments/purchase-coins', data);
        return res.data;
    },

    async guestPurchaseSubscription(data: { plan_id: number; phone: string }) {
        const res = await api.post('/v1/guest/payments/purchase-subscription', data);
        return res.data;
    },
};

// â”€â”€ Coins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const coinService = {
    async getBalance() {
        const res = await api.get<ApiResponse<{ balance: number }>>('/v1/coins/balance');
        return res.data;
    },

    async getTransactions(page: number = 1) {
        const res = await api.get<ApiResponse<PaginatedResponse<CoinTransaction>>>('/v1/coins/transactions', { params: { page } });
        return res.data;
    },

    async getPackages() {
        const res = await api.get<ApiResponse<CoinPackage[]>>('/v1/coins/packages');
        return res.data;
    },

    async claimDailyReward() {
        const res = await api.post<ApiResponse<{ coins: number; balance: number }>>('/v1/coins/daily-reward');
        return res.data;
    },

    async getDailyRewardInfo() {
        const res = await api.get<ApiResponse<{ available: boolean; amount: number; streak: number }>>('/v1/coins/daily-reward/info');
        return res.data;
    },

    async claimAdReward(adNetwork: string = 'admob', adUnitId: string = 'rewarded') {
        const res = await api.post<ApiResponse<{ coins_earned: number; coin_balance: number }>>('/v1/coins/ad-reward', {
            ad_network: adNetwork,
            ad_unit_id: adUnitId,
        });
        return res.data;
    },
};

// â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const notificationService = {
    async getNotifications(page: number = 1) {
        const res = await api.get<ApiResponse<PaginatedResponse<Notification>>>('/v1/notifications', { params: { page } });
        return res.data;
    },

    async getUnreadCount() {
        const res = await api.get<ApiResponse<{ count: number }>>('/v1/notifications/unread-count');
        return res.data;
    },

    async markAsRead(id: string) {
        return api.put(`/v1/notifications/${id}/read`);
    },

    async markAllAsRead() {
        return api.put('/v1/notifications/read-all');
    },
};

// â”€â”€ Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const profileService = {
    async update(data: { name?: string; username?: string; phone?: string; gender?: string }) {
        const res = await api.put('/v1/profile', data);
        return res.data;
    },

    async changePassword(data: { current_password: string; password: string; password_confirmation: string }) {
        return api.put('/v1/profile/password', data);
    },

    async deleteAccount() {
        return api.delete('/v1/profile');
    },
};

// â”€â”€ Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const reportService = {
    async submit(data: { reportable_type: string; reportable_id: number; reason: string; description?: string }) {
        return api.post('/v1/reports', data);
    },
};
