import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { contentService } from '../../services/contentService';
import { Drama } from '../../types';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
    navigation: any;
}

export default function ShortsScreen({ navigation }: Props) {
    const [dramas, setDramas] = useState<Drama[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDramas = useCallback(async (p: number, append: boolean) => {
        if (p === 1) setLoading(true);
        else setLoadingMore(true);
        try {
            const res = await contentService.getDramas({ page: p, per_page: 20, sort: 'newest' } as any);
            const items = res.data?.data || res.data || [];
            const lastPage = res.data?.last_page || 1;
            setDramas(prev => append ? [...prev, ...items] : items);
            setHasMore(p < lastPage);
            setPage(p);
        } catch (err) {
            console.log('Shorts fetch error', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchDramas(1, false); }, []);

    const onRefresh = () => { setRefreshing(true); fetchDramas(1, false); };
    const onEndReached = () => { if (!loadingMore && hasMore) fetchDramas(page + 1, true); };

    const openDrama = (id: number) => navigation.navigate('EpisodePlayer', { dramaId: id });

    const renderItem = ({ item, index }: { item: Drama; index: number }) => {
        const poster = item.cover_image || item.banner_image || (item as any).poster;
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => openDrama(item.id)}
                activeOpacity={0.85}
            >
                <Image
                    source={{ uri: poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/100x140/1a1a2e/666?text=' + encodeURIComponent(item.title.slice(0,1)) }}
                    style={styles.poster}
                    contentFit="cover"
                />
                <View style={styles.info}>
                    <View style={styles.titleRow}>
                        <Text style={styles.rank}>#{index + 1}</Text>
                        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    </View>
                    <Text style={styles.synopsis} numberOfLines={2}>
                        {item.synopsis || 'A thrilling short drama series'}
                    </Text>
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name="film-outline" size={13} color={COLORS.textMuted} />
                            <Text style={styles.metaText}>{item.total_episodes} episodes</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="eye-outline" size={13} color={COLORS.textMuted} />
                            <Text style={styles.metaText}>{formatViews(item.view_count)}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="star" size={13} color={COLORS.secondary} />
                            <Text style={[styles.metaText, { color: COLORS.secondary }]}>
                                {item.average_rating?.toFixed(1) || '—'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.tagRow}>
                        {item.category?.name && (
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{item.category.name}</Text>
                            </View>
                        )}
                        {item.is_free && (
                            <View style={[styles.tag, { backgroundColor: '#22C55E22', borderColor: '#22C55E' }]}>
                                <Text style={[styles.tagText, { color: '#22C55E' }]}>FREE</Text>
                            </View>
                        )}
                        {(item as any).is_vip && (
                            <View style={[styles.tag, { backgroundColor: '#9333EA22', borderColor: '#9333EA' }]}>
                                <Ionicons name="diamond" size={10} color="#9333EA" />
                                <Text style={[styles.tagText, { color: '#9333EA' }]}>VIP</Text>
                            </View>
                        )}
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Ionicons name="play-circle" size={28} color={COLORS.primary} />
                <Text style={styles.headerTitle}>All Short Dramas</Text>
            </View>

            <FlatList
                data={dramas}
                keyExtractor={(d) => String(d.id)}
                renderItem={renderItem}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.4}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Ionicons name="film-outline" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>No dramas available yet</Text>
                    </View>
                }
                ListFooterComponent={
                    loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.md }} /> : null
                }
            />
        </View>
    );
}

function formatViews(count: number): string {
    if (!count) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return String(count);
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.sm,
        gap: 10,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 22,
        fontWeight: '800',
    },

    // Card
    card: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        gap: 12,
    },
    poster: {
        width: 85,
        height: 120,
        borderRadius: 10,
    },
    info: {
        flex: 1,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    rank: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '800',
        minWidth: 25,
    },
    title: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
    },
    synopsis: {
        color: COLORS.textSecondary,
        fontSize: 13,
        marginTop: 4,
        lineHeight: 18,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 14,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    metaText: {
        color: COLORS.textMuted,
        fontSize: 12,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 6,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceLight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    tagText: {
        color: COLORS.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    separator: {
        height: 1,
        backgroundColor: COLORS.border,
        marginHorizontal: SPACING.md,
    },

    // Empty
    emptyWrap: { alignItems: 'center', paddingTop: 100 },
    emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm, fontSize: 15 },
});
