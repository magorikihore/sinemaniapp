import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { watchlistService } from '../../services/contentService';
import { Drama } from '../../types';

interface Props {
    navigation: any;
}

export default function WatchlistScreen({ navigation }: Props) {
    const [items, setItems] = useState<Drama[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            setError(null);
            const res = await watchlistService.getWatchlist();
            setItems(res.data?.data || res.data || []);
        } catch (err: any) {
            const msg = err?.message === 'Network Error'
                ? 'No internet connection. Please check your network and try again.'
                : 'Something went wrong. Please try again.';
            setError(msg);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const removeItem = async (id: number) => {
        try {
            await watchlistService.remove(id);
            setItems((prev) => prev.filter((d) => d.id !== id));
        } catch { }
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
        <FlatList
            style={styles.container}
            data={items}
            keyExtractor={(d) => String(d.id)}
            contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
            ListEmptyComponent={<Text style={styles.empty}>Your watchlist is empty</Text>}
            renderItem={({ item }) => {
                const poster = item.cover_image || item.poster;
                return (
                    <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('DramaDetail', { dramaId: item.id })}>
                        <Image source={{ uri: poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/80x120' }} style={styles.thumb} contentFit="cover" />
                        <View style={styles.info}>
                            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                            <Text style={styles.meta}>{item.total_episodes || 0} episodes{item.is_vip ? ' • VIP' : ''}</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                            <Text style={styles.removeTxt}>✕</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                );
            }}
        />
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl, fontSize: 15 },
    row: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 10, padding: SPACING.sm, marginBottom: SPACING.sm, alignItems: 'center' },
    thumb: { width: 60, height: 90, borderRadius: 6 },
    info: { flex: 1, marginLeft: SPACING.sm },
    title: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
    meta: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
    removeBtn: { padding: SPACING.sm },
    removeTxt: { color: COLORS.textMuted, fontSize: 18 },
    errorTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: SPACING.md },
    errorText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 6, fontSize: 14 },
    retryBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28, marginTop: SPACING.lg },
    retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
