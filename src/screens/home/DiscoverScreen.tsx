import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, Dimensions, ScrollView,
    RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import RegisterReminderBanner from '../../components/RegisterReminderBanner';
import { contentService } from '../../services/contentService';
import { Drama, Category } from '../../types';
import ContinueWatchingPill, { LastWatched } from '../../components/ContinueWatchingPill';

const { width: SCREEN_W } = Dimensions.get('window');
const POSTER_W = (SCREEN_W - SPACING.md * 2 - SPACING.sm * 2) / 3;

const QUICK_FILTERS = [
    { id: 'hot', label: '🔥 Hot', sort: 'popular' },
    { id: 'new', label: '✨ New', sort: 'newest' },
];

/* ── per-page state ─────────────────────────────────── */
interface PageData {
    dramas: Drama[];
    page: number;
    hasMore: boolean;
    loading: boolean;
    loadingMore: boolean;
    refreshing: boolean;
}

const emptyPage = (): PageData => ({
    dramas: [], page: 1, hasMore: true,
    loading: true, loadingMore: false, refreshing: false,
});

interface FilterItem { id: string; label: string; sort?: string }

/* ── drama card (memoised) ──────────────────────────── */
const DramaCard = React.memo(({ drama, onPress }: { drama: Drama; onPress: (id: number) => void }) => {
    const poster = drama.cover_image || (drama as any).poster;
    return (
        <TouchableOpacity style={styles.card} onPress={() => onPress(drama.id)} activeOpacity={0.8}>
            <View style={styles.posterWrap}>
                <Image
                    source={{ uri: poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/130x195/1a1a2e/666?text=No+Image' }}
                    style={styles.poster}
                    contentFit="cover"
                />
                {drama.is_new_release && (
                    <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
                )}
                {(drama as any).is_vip && (
                    <View style={styles.vipBadge}>
                        <Ionicons name="diamond" size={10} color="#fff" />
                        <Text style={styles.vipBadgeText}>VIP</Text>
                    </View>
                )}
                <View style={styles.epBadge}>
                    <Text style={styles.epBadgeText}>{drama.total_episodes} eps</Text>
                </View>
            </View>
            <Text style={styles.dramaTitle} numberOfLines={2}>{drama.title}</Text>
            <View style={styles.ratingRow}>
                <Ionicons name="star" size={11} color={COLORS.secondary} />
                <Text style={styles.ratingText}>{drama.average_rating?.toFixed(1) || '—'}</Text>
                <Text style={styles.viewsText}>{formatViews(drama.view_count)} views</Text>
            </View>
        </TouchableOpacity>
    );
});

/* ── single category page (memoised) ────────────────── */
const CategoryPage = React.memo(({
    filterId, data, search, onFetch, onOpenDrama, onContentScroll, pageHeight,
}: {
    filterId: string;
    data: PageData;
    search: string;
    onFetch: (fid: string, p: number, q: string, mode: 'init' | 'refresh' | 'more') => void;
    onOpenDrama: (id: number) => void;
    onContentScroll: (y: number) => void;
    pageHeight: number;
}) => {
    const onRefresh = () => onFetch(filterId, 1, search, 'refresh');
    const onEndReached = () => {
        if (!data.loadingMore && data.hasMore) onFetch(filterId, data.page + 1, search, 'more');
    };

    if (data.loading && data.dramas.length === 0) {
        return (
            <View style={[styles.pageContainer, styles.center, pageHeight ? { height: pageHeight } : null]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.pageContainer, pageHeight ? { height: pageHeight } : null]}>
            <FlatList
                data={data.dramas}
                numColumns={3}
                keyExtractor={(d) => String(d.id)}
                contentContainerStyle={styles.gridContainer}
                columnWrapperStyle={{ gap: SPACING.sm }}
                renderItem={({ item }) => <DramaCard drama={item} onPress={onOpenDrama} />}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.4}
                onScroll={(e) => onContentScroll(e.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={data.refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Ionicons name="film-outline" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>No dramas found</Text>
                    </View>
                }
                ListFooterComponent={
                    data.loadingMore
                        ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
                        : <View style={{ height: 100 }} />
                }
            />
        </View>
    );
});

/* ── helpers ─────────────────────────────────────────── */
function formatViews(count: number): string {
    if (!count) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return String(count);
}

/* ── main screen ─────────────────────────────────────── */
interface Props { navigation: any }

export default function DiscoverScreen({ navigation }: Props) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [search, setSearch] = useState('');
    const [pillCollapsed, setPillCollapsed] = useState(false);
    const [pages, setPages] = useState<Record<string, PageData>>({});
    const [pagerHeight, setPagerHeight] = useState(0);

    const chipScrollRef = useRef<ScrollView>(null);
    const chipWRef = useRef<number[]>([]);
    const fetchedRef = useRef(new Set<string>());

    useEffect(() => {
        contentService.getCategories()
            .then((r) => setCategories(r.data || []))
            .catch(() => {});
    }, []);

    const allFilters = useMemo<FilterItem[]>(() => [
        ...QUICK_FILTERS,
        ...categories.map(c => ({ id: String(c.id), label: c.name })),
    ], [categories]);

    /* ── fetch ────────────────────────────────────────── */
    const fetchPage = useCallback((fid: string, p: number, q: string, mode: 'init' | 'refresh' | 'more') => {
        setPages(prev => ({
            ...prev,
            [fid]: {
                ...(prev[fid] || emptyPage()),
                loading: mode === 'init',
                refreshing: mode === 'refresh',
                loadingMore: mode === 'more',
            },
        }));

        const params: any = { page: p, per_page: 18 };
        if (q.trim()) {
            params.search = q.trim();
        } else {
            const qf = QUICK_FILTERS.find(f => f.id === fid);
            if (qf) params.sort = qf.sort;
            else params.category_id = parseInt(fid);
        }

        contentService.getDramas(params)
            .then(res => {
                const items = res.data?.data || res.data || [];
                const lastPage = res.data?.last_page || 1;
                setPages(prev => {
                    const cur = prev[fid] || emptyPage();
                    return {
                        ...prev,
                        [fid]: {
                            dramas: mode === 'more' ? [...cur.dramas, ...items] : items,
                            page: p,
                            hasMore: p < lastPage,
                            loading: false,
                            loadingMore: false,
                            refreshing: false,
                        },
                    };
                });
            })
            .catch(() => {
                setPages(prev => ({
                    ...prev,
                    [fid]: {
                        ...(prev[fid] || emptyPage()),
                        loading: false,
                        loadingMore: false,
                        refreshing: false,
                    },
                }));
            });
    }, []);

    // Lazy-load data when swiping to a new page
    useEffect(() => {
        if (!allFilters.length) return;
        const f = allFilters[activeIndex];
        if (!f || fetchedRef.current.has(f.id)) return;
        fetchedRef.current.add(f.id);
        fetchPage(f.id, 1, '', 'init');
    }, [activeIndex, allFilters, fetchPage]);

    /* ── chip / pager sync ────────────────────────────── */
    const scrollChipsTo = useCallback((idx: number) => {
        let x = 0;
        for (let i = 0; i < idx; i++) x += (chipWRef.current[i] || 80) + 8;
        const w = chipWRef.current[idx] || 80;
        chipScrollRef.current?.scrollTo({ x: Math.max(0, x - SCREEN_W / 2 + w / 2), animated: true });
    }, []);

    const onChipPress = useCallback((idx: number) => {
        setActiveIndex(idx);
        pagerRef2.current?.scrollToIndex({ index: idx, animated: true });
        scrollChipsTo(idx);
    }, [scrollChipsTo]);

    const onPagerScrollEnd = useCallback((e: any) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
        if (idx >= 0 && idx < allFilters.length) {
            setActiveIndex(idx);
            scrollChipsTo(idx);
        }
    }, [allFilters.length, scrollChipsTo]);

    /* ── pill collapse on inner scroll ────────────────── */
    const onContentScroll = useCallback((y: number) => {
        setPillCollapsed(y > 80);
    }, []);

    /* ── search ──────────────────────────────────────── */
    const onSearch = useCallback(() => {
        const f = allFilters[activeIndex];
        if (f) {
            fetchedRef.current.delete(f.id);
            fetchPage(f.id, 1, search, 'init');
            fetchedRef.current.add(f.id);
        }
    }, [allFilters, activeIndex, search, fetchPage]);

    const onClearSearch = useCallback(() => {
        setSearch('');
        const f = allFilters[activeIndex];
        if (f) {
            fetchedRef.current.delete(f.id);
            fetchPage(f.id, 1, '', 'init');
            fetchedRef.current.add(f.id);
        }
    }, [allFilters, activeIndex, fetchPage]);

    /* ── navigation ──────────────────────────────────── */
    const openDrama = useCallback((id: number) =>
        navigation.navigate('EpisodePlayer', { dramaId: id }), [navigation]);

    const onContinuePress = useCallback((data: LastWatched) => {
        navigation.navigate('EpisodePlayer', {
            dramaId: data.dramaId, episodeId: data.episodeId, resumePositionMs: data.positionMs,
        });
    }, [navigation]);

    const pagerRef2 = useRef<FlatList>(null);

    /* ── render ──────────────────────────────────────── */
    return (
        <View style={styles.container}>
            {/* Sign-up reminder for guests (auto-hides for logged-in users) */}
            <RegisterReminderBanner compact />

            {/* Search */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search dramas..."
                        placeholderTextColor={COLORS.textMuted}
                        returnKeyType="search"
                        onSubmitEditing={onSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={onClearSearch}>
                            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Category Chips */}
            <ScrollView
                ref={chipScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipContainer}
                style={styles.chipScrollView}
            >
                {allFilters.map((f, i) => {
                    const active = activeIndex === i;
                    return (
                        <TouchableOpacity
                            key={f.id}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => onChipPress(i)}
                            onLayout={(e) => { chipWRef.current[i] = e.nativeEvent.layout.width; }}
                        >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Horizontal Pager — swipe between categories */}
            <View style={{ flex: 1 }} onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}>
                {pagerHeight > 0 && (
                    <FlatList
                        ref={pagerRef2}
                        data={allFilters}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        keyExtractor={(f) => f.id}
                        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
                        onMomentumScrollEnd={onPagerScrollEnd}
                        extraData={pages}
                        initialNumToRender={1}
                        windowSize={3}
                        renderItem={({ item: f }) => {
                            const pd = pages[f.id] || emptyPage();
                            return (
                                <CategoryPage
                                    filterId={f.id}
                                    data={pd}
                                    search={search}
                                    onFetch={fetchPage}
                                    onOpenDrama={openDrama}
                                    onContentScroll={onContentScroll}
                                    pageHeight={pagerHeight}
                                />
                            );
                        }}
                    />
                )}
            </View>

            <ContinueWatchingPill collapsed={pillCollapsed} onPress={onContinuePress} />
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

    // Search
    searchSection: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceLight,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 44,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        color: COLORS.text,
        fontSize: 15,
    },

    // Tabs
    chipScrollView: {
        flexGrow: 0,
    },
    chipContainer: {
        paddingHorizontal: SPACING.md,
        alignItems: 'center',
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    chipActive: {
        borderBottomColor: COLORS.primary,
    },
    chipText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
    chipTextActive: { color: COLORS.primary, fontWeight: '700' },

    // Page
    pageContainer: { width: SCREEN_W, flex: 1 },

    // Grid
    gridContainer: { paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 20 },
    card: { width: POSTER_W, marginBottom: SPACING.md },
    posterWrap: { position: 'relative' },
    poster: { width: POSTER_W, height: POSTER_W * 1.5, borderRadius: 10 },
    newBadge: {
        position: 'absolute', top: 6, left: 6,
        backgroundColor: COLORS.primary, borderRadius: 4,
        paddingHorizontal: 6, paddingVertical: 2,
    },
    newBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    vipBadge: {
        position: 'absolute', top: 6, right: 6,
        backgroundColor: '#9333EA', borderRadius: 4,
        paddingHorizontal: 5, paddingVertical: 2,
        flexDirection: 'row', alignItems: 'center', gap: 2,
    },
    vipBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    epBadge: {
        position: 'absolute', bottom: 6, right: 6,
        backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4,
        paddingHorizontal: 5, paddingVertical: 2,
    },
    epBadgeText: { color: '#ddd', fontSize: 12, fontWeight: '600' },
    dramaTitle: { color: COLORS.text, fontSize: 14, marginTop: 6, width: POSTER_W, fontWeight: '600' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 3 },
    ratingText: { color: COLORS.secondary, fontSize: 13, fontWeight: '600' },
    viewsText: { color: COLORS.textMuted, fontSize: 12, marginLeft: 4 },

    // Empty
    emptyWrap: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm, fontSize: 15 },
});
