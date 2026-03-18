import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    FlatList, ActivityIndicator, Dimensions, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { contentService, episodeService, watchlistService, interactionService } from '../../services/contentService';
import { Drama, Episode } from '../../types';
import { useAuthStore } from '../../store/authStore';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
    navigation: any;
    route: { params: { dramaId: number } };
}

export default function DramaDetailScreen({ navigation, route }: Props) {
    const { dramaId } = route.params;
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

    const [drama, setDrama] = useState<Drama | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [inWatchlist, setInWatchlist] = useState(false);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);

    const fetchDrama = useCallback(async () => {
        try {
            const res = await contentService.getDrama(dramaId);
            const d = res.data;
            setDrama(d);
            setEpisodes(d.episodes || []);
            setLikeCount(d.likes_count || 0);
            setLiked(d.is_liked || false);
            if (isLoggedIn) {
                try {
                    const wl = await watchlistService.check(dramaId);
                    setInWatchlist(wl.data?.is_watchlisted || false);
                } catch { }
            }
        } catch (err) {
            showAlert('Error', 'Could not load drama');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }, [dramaId, isLoggedIn]);

    useEffect(() => { fetchDrama(); }, [fetchDrama]);

    const toggleWatchlist = async () => {
        if (!isLoggedIn) { showAlert('Login Required', 'Please login to use watchlist'); return; }
        try {
            if (inWatchlist) await watchlistService.remove(dramaId);
            else await watchlistService.add(dramaId);
            setInWatchlist(!inWatchlist);
        } catch { }
    };

    const toggleLike = async () => {
        if (!isLoggedIn) { showAlert('Login Required', 'Please login to like'); return; }
        try {
            const res = await interactionService.toggleDramaLike(dramaId);
            setLiked(!liked);
            setLikeCount((c) => liked ? c - 1 : c + 1);
        } catch { }
    };

    const handleShare = async () => {
        if (!drama) return;
        try {
            await Share.share({ message: `Watch "${drama.title}" on Sinemani!`, title: drama.title });
        } catch { }
    };

    const playEpisode = (ep: Episode) => {
        if (ep.is_locked && !ep.is_free) {
            if (!isLoggedIn) {
                showAlert('Login Required', 'Please login to watch this episode');
                return;
            }
            navigation.navigate('EpisodePlayer', { episodeId: ep.id, dramaId });
        } else {
            navigation.navigate('EpisodePlayer', { episodeId: ep.id, dramaId });
        }
    };

    if (loading || !drama) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    const poster = drama.cover_image || drama.poster;

    return (
        <ScrollView style={styles.container}>
            {/* Hero Image */}
            <View style={styles.hero}>
                <Image
                    source={{ uri: poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/400x250' }}
                    style={styles.heroImg}
                    contentFit="cover"
                />
                <LinearGradient colors={['transparent', COLORS.background]} style={styles.heroGradient} />
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.body}>
                {/* Title & Meta */}
                <Text style={styles.title}>{drama.title}</Text>
                <View style={styles.metaRow}>
                    {drama.release_year && <Text style={styles.metaText}>{drama.release_year}</Text>}
                    {drama.content_rating && <Text style={styles.ratingBadge}>{drama.content_rating}</Text>}
                    {drama.total_episodes && <Text style={styles.metaText}>{drama.total_episodes} episodes</Text>}
                    {drama.is_vip && <Text style={styles.vipBadge}>VIP</Text>}
                </View>

                {/* Rating */}
                {drama.average_rating ? (
                    <View style={styles.ratingRow}>
                        <Text style={styles.starText}>⭐ {Number(drama.average_rating).toFixed(1)}</Text>
                        <Text style={styles.ratingCount}>({drama.ratings_count || 0} ratings)</Text>
                    </View>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
                        <Text style={styles.actionIcon}>{liked ? '❤️' : '🤍'}</Text>
                        <Text style={styles.actionLabel}>{likeCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={toggleWatchlist}>
                        <Text style={styles.actionIcon}>{inWatchlist ? '✅' : '➕'}</Text>
                        <Text style={styles.actionLabel}>{inWatchlist ? 'Listed' : 'Watchlist'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                        <Text style={styles.actionIcon}>📤</Text>
                        <Text style={styles.actionLabel}>Share</Text>
                    </TouchableOpacity>
                </View>

                {/* Play CTA */}
                {episodes.length > 0 && (
                    <TouchableOpacity style={styles.playBtn} onPress={() => playEpisode(episodes[0])}>
                        <Text style={styles.playBtnText}>▶  Play Episode 1</Text>
                    </TouchableOpacity>
                )}

                {/* Description */}
                {drama.synopsis && (
                    <View style={styles.descBox}>
                        <Text style={styles.sectionLabel}>Synopsis</Text>
                        <Text style={styles.descText}>{drama.synopsis}</Text>
                    </View>
                )}

                {/* Categories & Tags */}
                {(drama.categories?.length || drama.tags?.length) ? (
                    <View style={styles.tagsRow}>
                        {drama.categories?.map((c: any) => (
                            <Text key={`cat-${c.id}`} style={styles.tag}>{c.name}</Text>
                        ))}
                        {drama.tags?.map((t: any) => (
                            <Text key={`tag-${t.id}`} style={[styles.tag, styles.tagAlt]}>#{t.name}</Text>
                        ))}
                    </View>
                ) : null}

                {/* Episodes List */}
                <Text style={styles.sectionLabel}>Episodes ({episodes.length})</Text>
                {episodes.map((ep) => (
                    <TouchableOpacity key={ep.id} style={styles.epRow} onPress={() => playEpisode(ep)}>
                        <Image
                            source={{ uri: ep.thumbnail ? `${STORAGE_URL}/${ep.thumbnail}` : (poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/100x60') }}
                            style={styles.epThumb}
                            contentFit="cover"
                        />
                        <View style={styles.epInfo}>
                            <Text style={styles.epTitle} numberOfLines={1}>
                                Ep {ep.episode_number} {ep.title ? `- ${ep.title}` : ''}
                            </Text>
                            <Text style={styles.epMeta}>
                                {ep.duration ? `${Math.floor(ep.duration / 60)}min` : ''}
                                {ep.is_free ? '  Free' : ep.coin_cost ? `  🪙 ${ep.coin_cost}` : ''}
                            </Text>
                        </View>
                        <View style={styles.epRight}>
                            {ep.is_locked && !ep.is_free ? (
                                <Text style={styles.lockIcon}>🔒</Text>
                            ) : (
                                <Text style={styles.playIcon}>▶</Text>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    // Hero
    hero: { width: SCREEN_W, height: 280, position: 'relative' },
    heroImg: { width: '100%', height: '100%' },
    heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
    backBtn: { position: 'absolute', top: 50, left: SPACING.md, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    backText: { color: '#fff', fontSize: 20 },
    // Body
    body: { paddingHorizontal: SPACING.md, marginTop: -20 },
    title: { color: COLORS.text, fontSize: 24, fontWeight: 'bold' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
    metaText: { color: COLORS.textSecondary, fontSize: 13 },
    ratingBadge: { backgroundColor: COLORS.surfaceLight, color: COLORS.textSecondary, fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
    vipBadge: { backgroundColor: COLORS.vip, color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
    starText: { color: COLORS.coin, fontSize: 15, fontWeight: '600' },
    ratingCount: { color: COLORS.textMuted, fontSize: 12 },
    // Actions
    actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
    actionBtn: { alignItems: 'center' },
    actionIcon: { fontSize: 22 },
    actionLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
    // Play
    playBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.md },
    playBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    // Desc
    descBox: { marginTop: SPACING.md },
    sectionLabel: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.sm },
    descText: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22 },
    // Tags
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
    tag: { backgroundColor: COLORS.surface, color: COLORS.textSecondary, fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
    tagAlt: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
    // Episodes
    epRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 10, padding: SPACING.sm, marginBottom: SPACING.xs },
    epThumb: { width: 100, height: 60, borderRadius: 6 },
    epInfo: { flex: 1, marginLeft: SPACING.sm },
    epTitle: { color: COLORS.text, fontSize: 14, fontWeight: '500' },
    epMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
    epRight: { paddingLeft: SPACING.sm },
    lockIcon: { fontSize: 18 },
    playIcon: { fontSize: 18, color: COLORS.primary },
});
