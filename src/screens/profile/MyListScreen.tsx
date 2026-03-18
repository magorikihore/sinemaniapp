import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { watchlistService, watchHistoryService } from '../../services/contentService';
import { Drama, WatchHistory } from '../../types';
import { useAuthStore } from '../../store/authStore';

const { width: SCREEN_W } = Dimensions.get('window');
const POSTER_W = (SCREEN_W - SPACING.md * 2 - SPACING.sm * 2) / 3;

type TabType = 'watchlist' | 'history';

interface Props {
    navigation: any;
}

export default function MyListScreen({ navigation }: Props) {
    const { isLoggedIn, isGuest } = useAuthStore();
    const [activeTab, setActiveTab] = useState<TabType>('watchlist');
    const [watchlist, setWatchlist] = useState<Drama[]>([]);
    const [history, setHistory] = useState<WatchHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!isLoggedIn) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            if (activeTab === 'watchlist') {
                const res = await watchlistService.getWatchlist();
                setWatchlist(res.data?.data || res.data || []);
            } else {
                const res = await watchHistoryService.getHistory();
                setHistory(res.data?.data || res.data || []);
            }
        } catch (err: any) {
            const msg = err?.message === 'Network Error'
                ? 'No internet connection. Please check your network and try again.'
                : err?.response?.data?.message || 'Something went wrong. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isLoggedIn, activeTab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    const openDrama = (id: number) => navigation.navigate('DramaDetail', { dramaId: id });

    const removeFromWatchlist = async (dramaId: number) => {
        try {
            await watchlistService.remove(dramaId);
            setWatchlist(prev => prev.filter(d => d.id !== dramaId));
        } catch { }
    };

    const renderWatchlistItem = ({ item }: { item: Drama }) => {
        const poster = item.cover_image || (item as any).poster;
        return (
            <TouchableOpacity style={styles.card} onPress={() => openDrama(item.id)} activeOpacity={0.8}>
                <View style={styles.posterWrap}>
                    <Image
                        source={{ uri: poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/130x195/1a1a2e/666' }}
                        style={styles.poster}
                        contentFit="cover"
                    />
                    <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => {
                            showAlert('Remove', `Remove "${item.title}" from your list?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => removeFromWatchlist(item.id) },
                            ]);
                        }}
                    >
                        <Ionicons name="bookmark" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.dramaTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.epCount}>{item.total_episodes} eps</Text>
            </TouchableOpacity>
        );
    };

    const renderHistoryItem = ({ item }: { item: WatchHistory }) => {
        if (!item) return null;
        const drama = item.drama;
        const episode = item.episode;
        const poster = drama?.cover_image || (drama as any)?.poster;
        const progress = typeof item.progress === 'number' ? Math.min(Math.max(item.progress, 0), 100) : 0;
        return (
            <TouchableOpacity
                style={styles.historyCard}
                onPress={() => drama?.id && openDrama(drama.id)}
                activeOpacity={0.8}
            >
                <Image
                    source={{ uri: poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/70x100/1a1a2e/666' }}
                    style={styles.historyPoster}
                    contentFit="cover"
                />
                <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle} numberOfLines={1}>{drama?.title || 'Drama'}</Text>
                    <Text style={styles.historyEp}>Episode {episode?.episode_number || '?'}</Text>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                    </View>
                    <Text style={styles.historyDate}>
                        {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => {
                        const epDramaId = drama?.id || item.drama_id;
                        const epId = episode?.id || item.episode_id;
                        if (epId && epDramaId) {
                            navigation.navigate('EpisodePlayer', { dramaId: epDramaId, episodeId: epId });
                        } else if (epDramaId) {
                            navigation.navigate('DramaDetail', { dramaId: epDramaId });
                        }
                    }}
                >
                    <Ionicons name="play-circle" size={36} color={COLORS.primary} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Ionicons name="bookmark" size={26} color={COLORS.primary} />
                <Text style={styles.headerTitle}>My List</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'watchlist' && styles.tabActive]}
                    onPress={() => setActiveTab('watchlist')}
                >
                    <Ionicons
                        name={activeTab === 'watchlist' ? 'bookmark' : 'bookmark-outline'}
                        size={18}
                        color={activeTab === 'watchlist' ? COLORS.primary : COLORS.textMuted}
                    />
                    <Text style={[styles.tabText, activeTab === 'watchlist' && styles.tabTextActive]}>
                        Saved
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'history' && styles.tabActive]}
                    onPress={() => setActiveTab('history')}
                >
                    <Ionicons
                        name={activeTab === 'history' ? 'time' : 'time-outline'}
                        size={18}
                        color={activeTab === 'history' ? COLORS.primary : COLORS.textMuted}
                    />
                    <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                        History
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading && !refreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : error ? (
                <View style={styles.emptyWrap}>
                    <Ionicons name="cloud-offline-outline" size={56} color={COLORS.textMuted} />
                    <Text style={styles.emptyTitle}>Oops!</Text>
                    <Text style={styles.emptyText}>{error}</Text>
                    <TouchableOpacity style={styles.discoverBtn} onPress={fetchData}>
                        <Text style={styles.discoverBtnText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : activeTab === 'watchlist' ? (
                <FlatList
                    key="watchlist-grid"
                    data={watchlist}
                    numColumns={3}
                    keyExtractor={(d) => String(d.id)}
                    contentContainerStyle={styles.gridContainer}
                    columnWrapperStyle={{ gap: SPACING.sm }}
                    renderItem={renderWatchlistItem}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="bookmark-outline" size={56} color={COLORS.textMuted} />
                            <Text style={styles.emptyTitle}>Your list is empty</Text>
                            <Text style={styles.emptyText}>
                                Save dramas to watch them later
                            </Text>
                            <TouchableOpacity
                                style={styles.discoverBtn}
                                onPress={() => navigation.navigate('Discover')}
                            >
                                <Text style={styles.discoverBtnText}>Discover Dramas</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    key="history-list"
                    data={history}
                    keyExtractor={(d, i) => d?.id ? String(d.id) : `history-${i}`}
                    contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 100 }}
                    renderItem={renderHistoryItem}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                    }
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="time-outline" size={56} color={COLORS.textMuted} />
                            <Text style={styles.emptyTitle}>No watch history</Text>
                            <Text style={styles.emptyText}>
                                Start watching dramas to see them here
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.xs,
        gap: 10,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 22,
        fontWeight: '800',
    },

    // Tabs
    tabs: {
        flexDirection: 'row',
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderRadius: 10,
        padding: 3,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    tabActive: {
        backgroundColor: COLORS.surfaceLight,
    },
    tabText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: COLORS.text },

    // Grid
    gridContainer: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 100 },
    card: { width: POSTER_W, marginBottom: SPACING.md },
    posterWrap: { position: 'relative' },
    poster: { width: POSTER_W, height: POSTER_W * 1.5, borderRadius: 10 },
    removeBtn: {
        position: 'absolute', top: 6, right: 6,
        backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
        padding: 4,
    },
    dramaTitle: { color: COLORS.text, fontSize: 12, marginTop: 6, width: POSTER_W, fontWeight: '500' },
    epCount: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },

    // History
    historyCard: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        gap: 12,
        alignItems: 'center',
    },
    historyPoster: { width: 60, height: 85, borderRadius: 8 },
    historyInfo: { flex: 1 },
    historyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
    historyEp: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
    progressBarBg: {
        height: 3, backgroundColor: COLORS.border, borderRadius: 2, marginTop: 6,
    },
    progressBarFill: {
        height: 3, backgroundColor: COLORS.primary, borderRadius: 2,
    },
    historyDate: { color: COLORS.textMuted, fontSize: 10, marginTop: 4 },
    playBtn: { padding: 4 },
    separator: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },

    // Empty
    emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
    emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: SPACING.md },
    emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 6, fontSize: 14 },
    discoverBtn: {
        backgroundColor: COLORS.primary, borderRadius: 10,
        paddingVertical: 12, paddingHorizontal: 28, marginTop: SPACING.lg,
    },
    discoverBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
