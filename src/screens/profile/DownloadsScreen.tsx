import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import {
    getDownloads, removeDownload, getTotalDownloadSize, formatFileSize,
    DownloadedEpisode,
} from '../../services/downloadService';

export default function DownloadsScreen({ navigation }: any) {
    const [downloads, setDownloads] = useState<DownloadedEpisode[]>([]);
    const [totalSize, setTotalSize] = useState(0);

    const load = useCallback(async () => {
        const list = await getDownloads();
        list.sort((a, b) => b.downloadedAt - a.downloadedAt);
        setDownloads(list);
        setTotalSize(await getTotalDownloadSize());
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const handleDelete = (item: DownloadedEpisode) => {
        showAlert(
            'Remove Download',
            `Delete "${item.dramaTitle} - Ep ${item.episodeNumber}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        await removeDownload(item.episodeId);
                        load();
                    },
                },
            ],
        );
    };

    const handlePlay = (item: DownloadedEpisode) => {
        navigation.navigate('EpisodePlayer', {
            dramaId: item.dramaId,
            episodeId: item.episodeId,
            localUri: item.localUri,
            offlineTitle: item.dramaTitle,
            offlineEpisodeNumber: item.episodeNumber,
        });
    };

    const renderItem = ({ item }: { item: DownloadedEpisode }) => {
        const thumb = item.thumbnail
            ? (item.thumbnail.startsWith('http') ? item.thumbnail : `${STORAGE_URL}/${item.thumbnail}`)
            : null;

        return (
            <TouchableOpacity style={styles.card} onPress={() => handlePlay(item)} activeOpacity={0.7}>
                <View style={styles.thumbWrap}>
                    {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.thumb} />
                    ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                            <Ionicons name="film-outline" size={28} color={COLORS.textMuted} />
                        </View>
                    )}
                    <View style={styles.playOverlay}>
                        <Ionicons name="play-circle" size={32} color="#fff" />
                    </View>
                </View>
                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>{item.dramaTitle}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        Episode {item.episodeNumber}{item.title ? ` · ${item.title}` : ''}
                    </Text>
                    <Text style={styles.size}>{formatFileSize(item.fileSize)}</Text>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash-outline" size={22} color={COLORS.error} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {downloads.length > 0 && (
                <View style={styles.header}>
                    <Text style={styles.headerText}>
                        {downloads.length} episode{downloads.length !== 1 ? 's' : ''} · {formatFileSize(totalSize)}
                    </Text>
                </View>
            )}

            <FlatList
                data={downloads}
                keyExtractor={(item) => String(item.episodeId)}
                renderItem={renderItem}
                contentContainerStyle={downloads.length === 0 ? styles.emptyContainer : styles.list}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="download-outline" size={64} color={COLORS.textMuted} />
                        <Text style={styles.emptyTitle}>No Downloads</Text>
                        <Text style={styles.emptyText}>
                            Download episodes to watch offline
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: '#222',
    },
    headerText: { color: COLORS.textMuted, fontSize: 13 },
    list: { paddingVertical: SPACING.sm },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    thumbWrap: { position: 'relative' },
    thumb: {
        width: 120,
        height: 68,
        borderRadius: 6,
        backgroundColor: '#1a1a1a',
    },
    thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: { flex: 1, marginLeft: SPACING.sm },
    title: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
    subtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
    size: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
    deleteBtn: { padding: SPACING.sm },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems: 'center' },
    emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginTop: SPACING.md },
    emptyText: { color: COLORS.textMuted, fontSize: 14, marginTop: SPACING.xs },
});
