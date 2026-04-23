export interface User {
    id: number;
    name: string;
    username: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    gender: string | null;
    coin_balance: number;
    is_active: boolean;
    is_vip: boolean;
    vip_expires_at: string | null;
    last_login_at: string | null;
    created_at: string;
}

export interface Drama {
    id: number;
    title: string;
    slug: string;
    synopsis: string | null;
    description: string | null;
    cover_image: string | null;
    banner_image: string | null;
    category_id: number;
    category?: Category;
    tags?: Tag[];
    content_rating: string;
    language: string;
    country: string | null;
    release_year: number | null;
    director: string | null;
    cast: string[] | null;
    trailer_url: string | null;
    total_episodes: number;
    view_count: number;
    like_count: number;
    average_rating: number;
    coin_price: number;
    is_free: boolean;
    is_featured: boolean;
    is_trending: boolean;
    is_new_release: boolean;
    status: 'draft' | 'published' | 'completed' | 'suspended';
    published_at: string | null;
    episodes?: Episode[];
    is_liked?: boolean;
    is_watchlisted?: boolean;
    user_rating?: number | null;
}

export interface Episode {
    id: number;
    drama_id: number;
    drama?: Drama;
    title: string;
    slug: string;
    description: string | null;
    episode_number: number;
    season_number: number;
    duration: number;
    video_url: string | null;
    video_path?: string | null;
    stream_url?: string | null;
    hls_url?: string | null;
    thumbnail: string | null;
    is_free: boolean;
    coin_price: number;
    coin_cost?: number;
    view_count: number;
    like_count: number;
    likes_count?: number;
    is_active: boolean;
    is_locked?: boolean;
    published_at: string | null;
    is_unlocked?: boolean;
    is_liked?: boolean;
    watch_progress?: number;
    subtitles?: { language: string; label: string; url: string; format?: 'srt' | 'vtt' }[];
}

export interface Category {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    image: string | null;
    is_active: boolean;
    dramas_count?: number;
}

export interface Tag {
    id: number;
    name: string;
    slug: string;
}

export interface Banner {
    id: number;
    title: string;
    image: string;
    link_type: 'drama' | 'url' | 'category';
    link_value: string;
    is_active: boolean;
}

export interface SubscriptionPlan {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    interval: 'weekly' | 'monthly' | 'yearly';
    duration_days: number;
    price: number;
    original_price: number;
    currency: string;
    coin_bonus: number;
    daily_coin_bonus: number;
    is_popular: boolean;
    is_active: boolean;
    features: string[];
    savings_percent?: number;
    price_per_day?: number;
}

export interface Subscription {
    id: number;
    subscription_plan_id: number;
    plan?: SubscriptionPlan;
    status: 'active' | 'cancelled' | 'expired' | 'refunded';
    starts_at: string;
    ends_at: string;
    auto_renew: boolean;
    days_remaining?: number;
}

export interface CoinPackage {
    id: number;
    name: string;
    description: string | null;
    coins: number;
    bonus_coins: number;
    price: number;
    currency: string;
    is_popular: boolean;
    is_active: boolean;
    total_coins?: number;
}

export interface CoinTransaction {
    id: number;
    reference: string;
    type: 'credit' | 'debit';
    amount: number;
    balance_before: number;
    balance_after: number;
    source: string;
    description: string;
    created_at: string;
}

export interface Comment {
    id: number;
    user: { id: number; name: string; avatar: string | null };
    content: string;
    like_count: number;
    is_liked?: boolean;
    created_at: string;
}

export interface WatchHistory {
    id: number;
    drama_id: number;
    episode_id: number;
    drama: Drama;
    episode: Episode;
    progress: number;
    duration: number;
    completed: boolean;
    updated_at: string;
}

export interface Notification {
    id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, any>;
    read_at: string | null;
    created_at: string;
}

export interface MobilePayment {
    reference: string;
    phone: string;
    operator: string;
    amount: number;
    currency: string;
    payment_type: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired' | 'success';
    created_at: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data: T;
}

export interface HomeData {
    banners: Banner[];
    continue_watching: WatchHistory[];
    featured: Drama[];
    trending: Drama[];
    new_releases: Drama[];
    upcoming: Drama[];
    categories: Category[];
    for_you: Drama[];
}
