import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { watchHistoryService } from '../../services/contentService';

interface Props {
    navigation: any;
}

export default function WatchHistoryScreen({ navigation }: Props) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            setError(null);
            const res = await watchHistoryService.getHistory();
            setItems(res.data?.data || res.data || []);
        } catch (err: any) {
            const msg = err?.message === 'Network Error'
                ? 'No internet connection. Please check your network and try again.'
                : 'Something went wrong. Please try again.';
            setError(msg);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const clearAll = () => {
        showAlert('Clear History', 'Remove all watch history?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear', style: 'destructive', onPress: async () => {
                    try {
                        await watchHistoryService.clearAll();
                        setItems([]);
                    } catch { }
                }
            },
        ]);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    if (error) {
        return (
            <View style={[styles.center, { paddingHorizontal: SPACING.xl }]}>
                <Ionicons name="cloud-offline-outline" size={56} color={COLORS.textMuted} />
                <Text style={styles.errorTitle}>Oops!</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetch}>
                    <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {items.length > 0 && (
                <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
                    <Text style={styles.clearText}>Clear All</Text>
                </TouchableOpacity>
            )}
            <FlatList
                data={items}
                keyExtractor={(h, i) => String(h.id || i)}
                contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
                ListEmptyComponent={<Text style={styles.empty}>No watch history</Text>}
                renderItem={({ item }) => {
                    if (!item) return null;
                    const progress = typeof item.progress === 'number' ? Math.min(Math.max(item.progress, 0), 100) : 0;
                    return (
                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => {
                                const epDramaId = item.drama?.id || item.drama_id;
                                const epId = item.episode?.id || item.episode_id;
                                if (epId && epDramaId) {
                                    navigation.navigate('EpisodePlayer', { dramaId: epDramaId, episodeId: epId });
                                } else if (epDramaId) {
                                    navigation.navigate('DramaDetail', { dramaId: epDramaId });
                                }
                            }}
                        >
                            <Image
                                source={{ uri: item.episode?.thumbnail ? `${STORAGE_URL}/${item.episode.thumbnail}` : 'https://via.placeholder.com/100x60' }}
                                style={styles.thumb}
                                contentFit="cover"
                            />
                            <View style={styles.info}>
                                <Text style={styles.title} numberOfLines={1}>{item.drama?.title || 'Drama'}</Text>
                                <Text style={styles.meta}>Ep {item.episode?.episode_number || '?'} • {progress}%</Text>
                                <View style={styles.progressBg}>
                                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl, fontSize: 15 },
    clearBtn: { alignSelf: 'flex-end', paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
    clearText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
    row: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 10, padding: SPACING.sm, marginBottom: SPACING.sm, alignItems: 'center' },
    thumb: { width: 100, height: 60, borderRadius: 6 },
    info: { flex: 1, marginLeft: SPACING.sm },
    title: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
    meta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
    progressBg: { height: 3, backgroundColor: COLORS.border, borderRadius: 2, marginTop: 4 },
    progressFill: { height: 3, backgroundColor: COLORS.primary, borderRadius: 2 },
    errorTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: SPACING.md },
    errorText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 6, fontSize: 14 },
    retryBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28, marginTop: SPACING.lg },
    retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
