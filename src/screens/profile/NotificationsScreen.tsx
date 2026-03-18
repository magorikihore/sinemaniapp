import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING } from '../../constants/config';
import { notificationService } from '../../services/contentService';

interface Props {
    navigation: any;
}

export default function NotificationsScreen({ navigation }: Props) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        try {
            const res = await notificationService.getNotifications();
            setNotifications(res.data?.data || res.data || []);
        } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const markAllRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
        } catch { }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <View style={styles.container}>
            {notifications.length > 0 && (
                <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
                    <Text style={styles.markAllText}>Mark all as read</Text>
                </TouchableOpacity>
            )}
            <FlatList
                data={notifications}
                keyExtractor={(n, i) => n.id || String(i)}
                contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 100 }}
                ListEmptyComponent={<Text style={styles.empty}>No notifications</Text>}
                renderItem={({ item }) => {
                    const isRead = !!item.read_at;
                    return (
                        <TouchableOpacity
                            style={[styles.notifCard, !isRead && styles.unread]}
                            onPress={async () => {
                                if (!isRead) {
                                    try { await notificationService.markAsRead(item.id); } catch { }
                                }
                                if (item.data?.drama_id) {
                                    navigation.navigate('DramaDetail', { dramaId: item.data.drama_id });
                                }
                            }}
                        >
                            <Text style={styles.notifTitle}>{item.data?.title || item.title || 'Notification'}</Text>
                            <Text style={styles.notifBody}>{item.data?.message || item.body || ''}</Text>
                            <Text style={styles.notifTime}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
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
    markAllBtn: { alignSelf: 'flex-end', paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
    markAllText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
    notifCard: { backgroundColor: COLORS.surface, borderRadius: 10, padding: SPACING.md, marginBottom: SPACING.xs },
    unread: { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
    notifTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
    notifBody: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
    notifTime: { color: COLORS.textMuted, fontSize: 11, marginTop: 6 },
});
