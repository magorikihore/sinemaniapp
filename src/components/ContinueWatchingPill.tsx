import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Animated,
    Dimensions, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, STORAGE_URL } from '../constants/config';
import { storage } from '../utils/storage';

const SCREEN_W = Dimensions.get('window').width;
const PILL_W = SCREEN_W - SPACING.md * 2;
const COLLAPSED_W = 52;

export interface LastWatched {
    dramaId: number;
    dramaTitle: string;
    episodeId: number;
    episodeNumber: number;
    seasonNumber: number;
    thumbnail: string | null;
    coverImage: string | null;
    progress: number; // 0-100
    positionMs: number; // playback position in milliseconds
    durationMs: number; // total duration in milliseconds
    timestamp: number;
}

// Helper to save last watched to storage
export async function saveLastWatched(data: LastWatched) {
    await storage.setItem('last_watched', JSON.stringify(data));
    // Also save per-drama resume point (mark completed if progress >= 95%)
    const completed = data.progress >= 95;
    await saveDramaResume(data.dramaId, data.episodeId, data.positionMs, completed);
}

export async function clearLastWatched() {
    await storage.deleteItem('last_watched');
}

export async function getLastWatched(): Promise<LastWatched | null> {
    const json = await storage.getItem('last_watched');
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
}

// Per-drama resume: remembers episode + position for each drama
export async function saveDramaResume(dramaId: number, episodeId: number, positionMs: number, completed: boolean = false) {
    const key = `drama_resume_${dramaId}`;
    await storage.setItem(key, JSON.stringify({ episodeId, positionMs, completed }));
}

export async function clearDramaResume(dramaId: number) {
    const key = `drama_resume_${dramaId}`;
    await storage.deleteItem(key);
}

export async function getDramaResume(dramaId: number): Promise<{ episodeId: number; positionMs: number; completed?: boolean } | null> {
    const key = `drama_resume_${dramaId}`;
    const json = await storage.getItem(key);
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
}

function formatTime(ms: number): string {
    if (!ms || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

interface Props {
    collapsed: boolean;
    onPress: (data: LastWatched) => void;
}

export default function ContinueWatchingPill({ collapsed, onPress }: Props) {
    const [data, setData] = useState<LastWatched | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const slideAnim = useRef(new Animated.Value(0)).current; // 0 = expanded, 1 = collapsed

    // Load last watched on mount
    useEffect(() => {
        getLastWatched().then(setData);
    }, []);

    // Re-check when screen gets focus (pill might update)
    useEffect(() => {
        const interval = setInterval(() => {
            getLastWatched().then(d => {
                if (d && d.timestamp !== data?.timestamp) setData(d);
            });
        }, 2000);
        return () => clearInterval(interval);
    }, [data?.timestamp]);

    // Animate collapse/expand
    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: collapsed ? 1 : 0,
            useNativeDriver: false,
            tension: 80,
            friction: 12,
        }).start();
    }, [collapsed]);

    if (!data || dismissed) return null;

    const handleDismiss = async () => {
        setDismissed(true);
        await clearLastWatched();
    };

    const pillWidth = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [PILL_W, COLLAPSED_W],
    });

    const contentOpacity = slideAnim.interpolate({
        inputRange: [0, 0.4],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const iconOpacity = slideAnim.interpolate({
        inputRange: [0.6, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const thumb = data.thumbnail || data.coverImage;
    const thumbUri = thumb ? `${STORAGE_URL}/${thumb}` : null;

    return (
        <Animated.View style={[styles.container, { width: pillWidth }]}>
            {/* Collapsed state: cover image with play overlay */}
            <Animated.View style={[styles.collapsedIcon, { opacity: iconOpacity }]} pointerEvents={collapsed ? 'auto' : 'none'}>
                <TouchableOpacity style={styles.collapsedBtn} onPress={() => onPress(data)}>
                    {thumbUri ? (
                        <Image source={{ uri: thumbUri }} style={styles.collapsedThumb} contentFit="cover" />
                    ) : (
                        <View style={[styles.collapsedThumb, styles.thumbPlaceholder]}>
                            <Ionicons name="film" size={20} color={COLORS.textMuted} />
                        </View>
                    )}
                    <View style={styles.collapsedPlayOverlay}>
                        <Ionicons name="play" size={18} color="#fff" />
                    </View>
                </TouchableOpacity>
            </Animated.View>

            {/* Expanded state: full pill */}
            <Animated.View style={[styles.expandedContent, { opacity: contentOpacity }]} pointerEvents={collapsed ? 'none' : 'auto'}>
                <TouchableOpacity style={styles.pillTouchable} activeOpacity={0.85} onPress={() => onPress(data)}>
                    {/* Thumbnail */}
                    {thumbUri ? (
                        <Image source={{ uri: thumbUri }} style={styles.thumb} contentFit="cover" />
                    ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                            <Ionicons name="film" size={20} color={COLORS.textMuted} />
                        </View>
                    )}

                    {/* Info */}
                    <View style={styles.info}>
                        <Text style={styles.title} numberOfLines={1}>{data.dramaTitle}</Text>
                        <Text style={styles.sub}>Ep {data.episodeNumber} • {formatTime(data.positionMs)} / {formatTime(data.durationMs)}</Text>
                        {/* Progress bar */}
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.min(data.progress, 100)}%` }]} />
                        </View>
                    </View>

                    {/* Play button */}
                    <Ionicons name="play-circle" size={36} color={COLORS.primary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>

                {/* Dismiss X */}
                <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 95 : 75,
        left: SPACING.md,
        height: 64,
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        zIndex: 100,
    },
    collapsedIcon: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    collapsedBtn: {
        width: COLLAPSED_W,
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
    },
    collapsedThumb: {
        width: COLLAPSED_W,
        height: 64,
        borderRadius: 14,
    },
    collapsedPlayOverlay: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    expandedContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    pillTouchable: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    thumb: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    thumbPlaceholder: {
        backgroundColor: COLORS.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
        marginLeft: 10,
    },
    title: {
        color: COLORS.text,
        fontSize: 13,
        fontWeight: '700',
    },
    sub: {
        color: COLORS.textSecondary,
        fontSize: 11,
        marginTop: 1,
    },
    progressTrack: {
        height: 3,
        backgroundColor: COLORS.surfaceLight,
        borderRadius: 2,
        marginTop: 5,
        overflow: 'hidden',
    },
    progressFill: {
        height: 3,
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },
    dismissBtn: {
        position: 'absolute',
        top: 4,
        right: 6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
