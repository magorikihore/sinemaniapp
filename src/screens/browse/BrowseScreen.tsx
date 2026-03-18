import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { contentService } from '../../services/contentService';
import { Drama, Category } from '../../types';

const { width: SCREEN_W } = Dimensions.get('window');
const POSTER_W = (SCREEN_W - SPACING.md * 2 - SPACING.sm * 2) / 3;

interface Props {
    navigation: any;
}

export default function BrowseScreen({ navigation }: Props) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [dramas, setDramas] = useState<Drama[]>([]);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<number | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        contentService.getCategories().then((r) => setCategories(r.data || [])).catch(() => { });
    }, []);

    const fetchDramas = useCallback(async (p: number, catId: number | null, q: string, append: boolean) => {
        if (p === 1) setLoading(true);
        else setLoadingMore(true);
        try {
            const params: any = { page: p };
            if (catId) params.category_id = catId;
            if (q.trim()) params.search = q.trim();
            const res = await contentService.getDramas(params);
            const items = res.data?.data || res.data || [];
            const lastPage = res.data?.last_page || 1;
            setDramas(prev => append ? [...prev, ...items] : items);
            setHasMore(p < lastPage);
            setPage(p);
        } catch (err) {
            console.log('Browse fetch error', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => { fetchDramas(1, activeCategory, search, false); }, [activeCategory]);

    const onSearch = () => fetchDramas(1, activeCategory, search, false);

    const onEndReached = () => {
        if (!loadingMore && hasMore) fetchDramas(page + 1, activeCategory, search, true);
    };

    const openDrama = (id: number) => navigation.navigate('DramaDetail', { dramaId: id });

    const renderDrama = ({ item }: { item: Drama }) => {
        const poster = item.cover_image || item.poster;
        return (
            <TouchableOpacity style={styles.card} onPress={() => openDrama(item.id)} activeOpacity={0.8}>
                <Image
                    source={{ uri: poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/130x195' }}
                    style={styles.poster}
                    contentFit="cover"
                />
                <Text style={styles.dramaTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.metaRow}>
                    {item.is_vip && <Text style={styles.vipBadge}>VIP</Text>}
                    {item.total_episodes ? <Text style={styles.eps}>{item.total_episodes} eps</Text> : null}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Search Bar */}
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search dramas..."
                    placeholderTextColor={COLORS.textMuted}
                    returnKeyType="search"
                    onSubmitEditing={onSearch}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
                    <Text style={styles.searchBtnText}>🔍</Text>
                </TouchableOpacity>
            </View>

            {/* Categories */}
            <FlatList
                data={[{ id: 0, name: 'All' } as Category, ...categories]}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(c) => String(c.id)}
                contentContainerStyle={{ paddingHorizontal: SPACING.md, marginBottom: SPACING.sm }}
                renderItem={({ item: cat }) => {
                    const active = cat.id === 0 ? activeCategory === null : activeCategory === cat.id;
                    return (
                        <TouchableOpacity
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => setActiveCategory(cat.id === 0 ? null : cat.id)}
                        >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
                        </TouchableOpacity>
                    );
                }}
            />

            {/* Dramas Grid */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={dramas}
                    numColumns={3}
                    keyExtractor={(d) => String(d.id)}
                    contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 100 }}
                    columnWrapperStyle={{ gap: SPACING.sm }}
                    renderItem={renderDrama}
                    onEndReached={onEndReached}
                    onEndReachedThreshold={0.4}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No dramas found</Text>
                    }
                    ListFooterComponent={
                        loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.md }} /> : null
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.sm },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    // Search
    searchRow: { flexDirection: 'row', paddingHorizontal: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.xs },
    searchInput: {
        flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: SPACING.md,
        paddingVertical: 12, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: COLORS.border,
    },
    searchBtn: { backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
    searchBtnText: { fontSize: 18 },
    // Chips
    chip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: COLORS.surface, marginRight: SPACING.xs, borderWidth: 1, borderColor: COLORS.border,
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.textSecondary, fontSize: 13 },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    // Grid
    card: { width: POSTER_W, marginBottom: SPACING.md },
    poster: { width: POSTER_W, height: POSTER_W * 1.5, borderRadius: 8 },
    dramaTitle: { color: COLORS.text, fontSize: 12, marginTop: 4, width: POSTER_W },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
    vipBadge: { backgroundColor: COLORS.vip, color: '#fff', fontSize: 9, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
    eps: { color: COLORS.textMuted, fontSize: 11 },
    emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl, fontSize: 15 },
});
