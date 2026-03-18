import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
    Dimensions, RefreshControl, ActivityIndicator, ImageBackground, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { contentService, watchHistoryService } from '../../services/contentService';
import { Drama, Banner, Episode } from '../../types';
import { useAuthStore } from '../../store/authStore';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
    navigation: any;
}

export default function HomeScreen({ navigation }: Props) {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [featured, setFeatured] = useState<Drama[]>([]);
    const [trending, setTrending] = useState<Drama[]>([]);
    const [newReleases, setNewReleases] = useState<Drama[]>([]);
    const [continueWatching, setContinueWatching] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const [homeRes, trendingRes, newRes] = await Promise.all([
                contentService.getHome(),
                contentService.getTrending(),
                contentService.getNewReleases(),
            ]);
            const home = homeRes.data;
            setBanners(home?.banners || []);
            setFeatured(home?.featured || []);
            setTrending(trendingRes.data?.data || trendingRes.data || []);
            setNewReleases(newRes.data?.data || newRes.data || []);
            if (isLoggedIn) {
                try {
                    const cw = await watchHistoryService.getContinueWatching();
                    setContinueWatching(cw.data || []);
                } catch { }
            }
        } catch (err: any) {
            const msg = err?.message === 'Network Error'
                ? 'No internet connection. Please check your network and try again.'
                : 'Something went wrong. Pull down to refresh.';
            setError(msg);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isLoggedIn]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    const openDrama = (id: number) => navigation.navigate('DramaDetail', { dramaId: id });

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.center}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            >
                <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textMuted} />
                <Text style={styles.errorTitle}>Oops!</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
                    <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
            {/* Banners */}
            {banners.length > 0 && (
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                    {banners.map((b) => (
                        <TouchableOpacity
                            key={b.id}
                            activeOpacity={0.9}
                            onPress={() => b.drama_id && openDrama(b.drama_id)}
                            style={styles.bannerWrap}
                        >
                            <Image
                                source={{ uri: b.image ? `${STORAGE_URL}/${b.image}` : 'https://via.placeholder.com/400x200' }}
                                style={styles.bannerImg}
                                contentFit="cover"
                            />
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.85)']}
                                style={styles.bannerGradient}
                            >
                                <Text style={styles.bannerTitle} numberOfLines={2}>{b.title}</Text>
                                {b.subtitle ? <Text style={styles.bannerSub} numberOfLines={1}>{b.subtitle}</Text> : null}
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Continue Watching */}
            {continueWatching.length > 0 && (
                <SectionRow
                    title="Continue Watching"
                    data={continueWatching}
                    onPress={(item: any) => navigation.navigate('EpisodePlayer', { episodeId: item.episode?.id || item.episode_id })}
                    renderItem={(item: any) => (
                        <View>
                            <Image
                                source={{ uri: item.episode?.thumbnail ? `${STORAGE_URL}/${item.episode.thumbnail}` : 'https://via.placeholder.com/160x90' }}
                                style={styles.cwThumb}
                                contentFit="cover"
                            />
                            <View style={[styles.progressBar, { width: `${(item.progress || 0)}%` as any }]} />
                            <Text style={styles.cwTitle} numberOfLines={1}>{item.drama?.title || 'Episode'}</Text>
                            <Text style={styles.cwSub} numberOfLines={1}>Ep {item.episode?.episode_number}</Text>
                        </View>
                    )}
                />
            )}

            {/* Featured */}
            {featured.length > 0 && (
                <SectionRow
                    title="Featured"
                    data={featured}
                    onPress={(item: Drama) => openDrama(item.id)}
                    renderItem={(item: Drama) => <DramaCard drama={item} />}
                />
            )}

            {/* Trending */}
            {trending.length > 0 && (
                <SectionRow
                    title="🔥 Trending"
                    data={trending}
                    onPress={(item: Drama) => openDrama(item.id)}
                    renderItem={(item: Drama) => <DramaCard drama={item} />}
                />
            )}

            {/* New Releases */}
            {newReleases.length > 0 && (
                <SectionRow
                    title="New Releases"
                    data={newReleases}
                    onPress={(item: Drama) => openDrama(item.id)}
                    renderItem={(item: Drama) => <DramaCard drama={item} />}
                />
            )}

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

/* ---- Reusable Components ---- */

function DramaCard({ drama }: { drama: Drama }) {
    const poster = drama.cover_image || drama.poster;
    return (
        <View>
            <Image
                source={{ uri: poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/130x195' }}
                style={styles.poster}
                contentFit="cover"
            />
            <Text style={styles.dramaTitle} numberOfLines={1}>{drama.title}</Text>
            <View style={styles.metaRow}>
                {drama.is_vip && <Text style={styles.vipBadge}>VIP</Text>}
                {drama.total_episodes ? (
                    <Text style={styles.epCount}>{drama.total_episodes} eps</Text>
                ) : null}
            </View>
        </View>
    );
}

function SectionRow({ title, data, onPress, renderItem }: {
    title: string;
    data: any[];
    onPress: (item: any) => void;
    renderItem: (item: any) => React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <FlatList
                data={data}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, i) => `${item.id || i}`}
                contentContainerStyle={{ paddingHorizontal: SPACING.md }}
                ItemSeparatorComponent={() => <View style={{ width: SPACING.sm }} />}
                renderItem={({ item }) => (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => onPress(item)}>
                        {renderItem(item)}
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

/* ---- Styles ---- */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    // Banner
    bannerWrap: { width: SCREEN_W, height: 220 },
    bannerImg: { width: '100%', height: '100%' },
    bannerGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.md, paddingTop: 40 },
    bannerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    bannerSub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
    // Continue Watching
    cwThumb: { width: 160, height: 90, borderRadius: 8 },
    progressBar: { height: 3, backgroundColor: COLORS.primary, borderRadius: 2, marginTop: 2 },
    cwTitle: { color: COLORS.text, fontSize: 12, marginTop: 4, width: 160 },
    cwSub: { color: COLORS.textMuted, fontSize: 11 },
    // Section
    section: { marginTop: SPACING.lg },
    sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginLeft: SPACING.md, marginBottom: SPACING.sm },
    // Drama card
    poster: { width: 130, height: 195, borderRadius: 8 },
    dramaTitle: { color: COLORS.text, fontSize: 12, marginTop: 6, width: 130 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
    vipBadge: { backgroundColor: COLORS.vip, color: '#fff', fontSize: 9, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
    epCount: { color: COLORS.textMuted, fontSize: 11 },
    // Error
    errorTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: SPACING.md },
    errorText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 6, fontSize: 14, paddingHorizontal: SPACING.xl },
    retryBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28, marginTop: SPACING.lg },
    retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
