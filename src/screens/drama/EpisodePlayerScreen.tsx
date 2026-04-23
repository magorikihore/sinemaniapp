import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
    Dimensions, ActivityIndicator, StatusBar, Animated, Share, Platform,
    Modal, FlatList, ScrollView, PanResponder, GestureResponderEvent, AppState,
} from 'react-native';
import { useVideoPlayer, VideoView, VideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { contentService, episodeService, watchlistService, interactionService } from '../../services/contentService';
import { Episode } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { saveLastWatched, getDramaResume, clearDramaResume } from '../../components/ContinueWatchingPill';
import { downloadEpisode, isDownloaded, getLocalUri, removeDownload } from '../../services/downloadService';
import { parseSubtitles, findCue, SubtitleCue } from '../../utils/subtitles';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
interface Props {
    navigation: any;
    route: { params: { dramaId: number; episodeId?: number; resumePositionMs?: number; localUri?: string; offlineTitle?: string; offlineEpisodeNumber?: number } };
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const QUALITY_OPTIONS = ['Auto', '1080p', '720p', '480p'];
// Map quality labels to HLS variant subdirectory names
const QUALITY_VARIANT_MAP: Record<string, string> = { '1080p': 'high', '720p': 'mid', '480p': 'low' };

export default function EpisodePlayerScreen({ navigation, route }: Props) {
    const { dramaId, episodeId: initialEpisodeId, resumePositionMs, localUri: offlineLocalUri, offlineTitle, offlineEpisodeNumber } = route.params;
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const user = useAuthStore((s) => s.user);
    const isVip = !!user?.is_vip;
    const hasResumed = useRef(false);
    const resumePos = useRef<number>(resumePositionMs || 0);

    // Prevent screen recording & screenshots while player is mounted (native only)
    useEffect(() => {
        if (Platform.OS === 'web') return;
        let sub: { remove: () => void } | undefined;
        let isActive = true;
        (async () => {
            try {
                const ScreenCapture = await import('expo-screen-capture');
                if (!isActive) return;
                // Prevent screen recording (FLAG_SECURE on Android)
                await ScreenCapture.preventScreenCaptureAsync('episodePlayer');
                // Listen for screenshot attempts
                sub = ScreenCapture.addScreenshotListener(() => {
                    showAlert(
                        'Screenshot Blocked',
                        'Screenshots and screen recording are not allowed while watching content.',
                    );
                });
            } catch {}
        })();
        return () => {
            isActive = false;
            sub?.remove();
            if (Platform.OS !== 'web') {
                import('expo-screen-capture').then(m => m.allowScreenCaptureAsync('episodePlayer')).catch(() => {});
            }
        };
    }, []);

    const [currentEpisodeId, setCurrentEpisodeId] = useState<number | null>(initialEpisodeId || null);
    const [episode, setEpisode] = useState<Episode | null>(null);
    const [loading, setLoading] = useState(true);
    const [locked, setLocked] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [inWatchlist, setInWatchlist] = useState(false);

    // Drama info
    const [dramaTitle, setDramaTitle] = useState('');
    const [downloaded, setDownloaded] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [localVideoUri, setLocalVideoUri] = useState<string | null>(null);
    const [dramaCover, setDramaCover] = useState<string | null>(null);
    const [dramaSynopsis, setDramaSynopsis] = useState('');
    const [captionExpanded, setCaptionExpanded] = useState(false);
    const [synopsisExpanded, setSynopsisExpanded] = useState(false);

    // Current video URL for the player
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const videoUrlRef = useRef<string | null>(null);

    // Prefetched next episode data
    const prefetchedEpisodeRef = useRef<Episode | null>(null);

    // expo-video player — owned by the <VideoStage> child component (keyed
    // by URL) so each new episode gets a brand-new player + native VideoView.
    // The child reports the player back via setPlayer(); the parent uses it
    // for control (play/pause/seek/speed) and event subscriptions.
    const [player, setPlayer] = useState<VideoPlayer | null>(null);
    // Mirror in a ref so closures (PanResponder etc) always see the latest
    const playerRef = useRef<VideoPlayer | null>(null);
    useEffect(() => { playerRef.current = player; }, [player]);

    // Ref for preloaded video URL (warmed via HTTP range request)
    const preloadedVideoUrlRef = useRef<string | null>(null);

    // Pause/resume on screen lock / app background
    const wasPlayingRef = useRef(false);
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (!player) return;
            if (state === 'background' || state === 'inactive') {
                try { wasPlayingRef.current = player.playing; } catch {}
                try { player.pause(); } catch {}
            } else if (state === 'active') {
                if (wasPlayingRef.current) {
                    try { player.play(); } catch {}
                }
            }
        });
        return () => sub.remove();
    }, [player]);

    // Track playing state from expo-video events
    useEffect(() => {
        if (!player) { setIsPlaying(false); return; }
        try { setIsPlaying(player.playing); } catch {}
        const sub = player.addListener('playingChange', (e: any) => {
            setIsPlaying(!!e.isPlaying);
        });
        return () => sub.remove();
    }, [player]);

    // Ref for saveProgress to avoid stale closures in player event listener
    const saveProgressRef = useRef<(posMs: number, durMs: number) => void>(() => {});

    // Track time updates
    useEffect(() => {
        if (!player) return;
        const sub = player.addListener('timeUpdate', (payload: any) => {
            const pos = (payload.currentTime || 0) * 1000; // convert to ms
            let dur = 0;
            try { dur = (player.duration || 0) * 1000; } catch {}
            setPosition(pos);
            setDuration(dur);
            if (dur > 0 && Math.floor(pos / 10000) !== Math.floor((pos - 500) / 10000)) {
                saveProgressRef.current(pos, dur);
            }
        });
        return () => sub.remove();
    }, [player]);

    // Track status changes for loading & resume
    useEffect(() => {
        if (!player) return;
        // Reset resume guard for the new player so seeking still happens once.
        hasResumed.current = false;

        const handleReady = () => {
            setLoading(false);
            if (!hasResumed.current && resumePos.current > 0) {
                hasResumed.current = true;
                try { player.currentTime = resumePos.current / 1000; } catch {}
            }
            try { player.play(); } catch {}
        };

        // The player may have already become ready before this listener was
        // attached (mount happens fast; HLS is sometimes instant). Check
        // synchronously and act if already ready.
        try {
            const s = (player as any).status;
            if (s === 'readyToPlay') handleReady();
        } catch {}

        const sub = player.addListener('statusChange', (payload: any) => {
            if (payload.status === 'readyToPlay') {
                handleReady();
            } else if (payload.status === 'loading') {
                // Still loading, keep spinner visible
            } else if (payload.status === 'error') {
                console.log('Video player error:', JSON.stringify(payload));
                setLoading(false);
            }
        });
        return () => sub.remove();
    }, [player]);

    // Auto-play next episode when current one finishes
    useEffect(() => {
        if (!player) return;
        const sub = player.addListener('playToEnd', () => {
            if (!isSwitchingRef.current) {
                try { nextEpisodeRef.current(); } catch {}
            }
        });
        return () => sub.remove();
    }, [player]);

    // Overlay visibility
    const [showOverlay, setShowOverlay] = useState(true);
    const overlayOpacity = useRef(new Animated.Value(1)).current;
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Modals
    const [showSpeedModal, setShowSpeedModal] = useState(false);
    const [showQualityModal, setShowQualityModal] = useState(false);
    const [showSubtitleModal, setShowSubtitleModal] = useState(false);
    const [currentSpeed, setCurrentSpeed] = useState(1.0);
    const [currentQuality, setCurrentQuality] = useState('Auto');

    // Subtitles
    const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
    const [activeSubtitleUrl, setActiveSubtitleUrl] = useState<string | null>(null);
    const [currentCueText, setCurrentCueText] = useState<string>('');
    const subtitleTracks = episode?.subtitles || [];

    // Reset selected subtitle when episode changes
    useEffect(() => {
        setActiveSubtitleUrl(null);
        setSubtitleCues([]);
        setCurrentCueText('');
    }, [currentEpisodeId]);

    // Fetch + parse selected subtitle file
    useEffect(() => {
        if (!activeSubtitleUrl) {
            setSubtitleCues([]);
            setCurrentCueText('');
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(activeSubtitleUrl);
                const raw = await res.text();
                if (cancelled) return;
                setSubtitleCues(parseSubtitles(raw));
            } catch {
                if (!cancelled) setSubtitleCues([]);
            }
        })();
        return () => { cancelled = true; };
    }, [activeSubtitleUrl]);

    // Update displayed cue based on player position
    useEffect(() => {
        if (!subtitleCues.length) {
            if (currentCueText) setCurrentCueText('');
            return;
        }
        const cue = findCue(subtitleCues, position);
        const next = cue ? cue.text : '';
        if (next !== currentCueText) setCurrentCueText(next);
    }, [position, subtitleCues]);

    // Episode list & info sheet
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [showEpisodeList, setShowEpisodeList] = useState(false);
    const [showInfoSheet, setShowInfoSheet] = useState(false);
    const infoSheetAnim = useRef(new Animated.Value(0)).current;

    // Payment prompt
    const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
    const [promptEpisode, setPromptEpisode] = useState<Episode | null>(null);

    // Series complete + suggestions
    const [showSeriesComplete, setShowSeriesComplete] = useState(false);
    const [seriesCompleteData, setSeriesCompleteData] = useState<any>(null);

    // Fetch drama data (episodes + info), and auto-pick first episode if none specified
    const fetchDramaData = useCallback(async () => {
        if (!dramaId) {
            // No dramaId — still fetch episode if we have one
            setLoading(!!currentEpisodeId);
            return;
        }
        try {
            const dramaRes = await contentService.getDrama(dramaId);
            const drama = dramaRes.data;
            setDramaTitle(drama?.title || '');
            setDramaCover(drama?.cover_image || drama?.banner_image || null);
            setDramaSynopsis(drama?.synopsis || drama?.description || '');
            const epsList = drama?.episodes || [];
            setEpisodes(epsList);

            // If no episodeId was passed, check saved resume for this drama
            if (!initialEpisodeId && epsList.length > 0) {
                const saved = await getDramaResume(dramaId);
                if (saved && epsList.some((e: Episode) => e.id === saved.episodeId)) {
                    // If saved episode is the last and was completed (progress >= 95%), start from beginning
                    const sorted = [...epsList].sort((a: Episode, b: Episode) => a.episode_number - b.episode_number);
                    const lastEp = sorted[sorted.length - 1];
                    if (saved.episodeId === lastEp.id && saved.completed) {
                        await clearDramaResume(dramaId);
                        setCurrentEpisodeId(sorted[0].id);
                        resumePos.current = 0;
                    } else {
                        setCurrentEpisodeId(saved.episodeId);
                        resumePos.current = saved.positionMs || 0;
                    }
                } else {
                    const sorted = [...epsList].sort((a: Episode, b: Episode) => a.episode_number - b.episode_number);
                    setCurrentEpisodeId(sorted[0].id);
                }
            }
        } catch {
            // If we have a local URI (offline playback), skip drama fetch — episode fetch handles it
            if (offlineLocalUri) {
                if (initialEpisodeId) setCurrentEpisodeId(initialEpisodeId);
                setDramaTitle(offlineTitle || '');
                return;
            }
            showAlert('Error', 'Could not load drama');
            navigation.goBack();
        }
    }, [dramaId, initialEpisodeId, offlineLocalUri, offlineTitle]);

    const fetchEpisode = useCallback(async () => {
        if (!currentEpisodeId) return;
        try {
            // Use prefetched data if available, otherwise fetch from API
            let ep: Episode;
            if (prefetchedEpisodeRef.current?.id === currentEpisodeId) {
                ep = prefetchedEpisodeRef.current;
                prefetchedEpisodeRef.current = null;
            } else {
                const res = await episodeService.getEpisode(currentEpisodeId);
                ep = res.data;
            }
            setEpisode(ep);
            const isLocked = !ep.is_free && !ep.is_unlocked;
            setLocked(isLocked);
            setLiked(ep.is_liked || false);
            setLikeCount(ep.like_count || ep.likes_count || 0);
            // For locked episodes, stop loading now (lock screen shows immediately).
            // For unlocked episodes, keep loading until video player fires 'readyToPlay'
            // to prevent a brief "Video not available" flash during the transition.
            if (isLocked) setLoading(false);
        } catch (err) {
            // Offline fallback: if we have a local URI, create a minimal episode object
            if (offlineLocalUri) {
                const stubEpisode: Episode = {
                    id: currentEpisodeId,
                    drama_id: dramaId,
                    title: offlineTitle || 'Downloaded Episode',
                    slug: '',
                    description: null,
                    episode_number: offlineEpisodeNumber || 1,
                    season_number: 1,
                    duration: 0,
                    video_url: null,
                    thumbnail: null,
                    is_free: true,
                    coin_price: 0,
                    view_count: 0,
                    like_count: 0,
                    is_active: true,
                    published_at: null,
                    is_unlocked: true,
                };
                setEpisode(stubEpisode);
                setLocked(false);
                setLocalVideoUri(offlineLocalUri);
            } else {
                setLoading(false);
                showAlert('Error', 'Could not load episode');
                navigation.goBack();
            }
        } finally {
            isSwitchingRef.current = false;
        }
    }, [currentEpisodeId, offlineLocalUri, offlineTitle, offlineEpisodeNumber]);

    // Fetch drama data first
    useEffect(() => { fetchDramaData(); }, [fetchDramaData]);

    // Then fetch episode once we have a currentEpisodeId
    useEffect(() => { if (currentEpisodeId) fetchEpisode(); }, [currentEpisodeId, fetchEpisode]);

    // Prefetch next episode data AND preload video in background
    useEffect(() => {
        if (!currentEpisodeId || !episodes.length || loading || locked) return;
        const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number);
        const idx = sorted.findIndex(e => e.id === currentEpisodeId);
        if (idx < 0 || idx >= sorted.length - 1) return;
        const nextId = sorted[idx + 1].id;

        const preloadVideo = (ep: Episode) => {
            const isLocked = !ep.is_free && !ep.is_unlocked;
            if (isLocked) return;
            const rawUrl = ep.stream_url || ep.video_url || (ep.video_path ? ep.video_path : null);
            const url = rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `${STORAGE_URL}/${rawUrl}`) : null;
            if (url && url !== preloadedVideoUrlRef.current) {
                preloadedVideoUrlRef.current = url;
                // Warm CDN/HTTP cache with a small range request — Cloudflare
                // edges the .ts segments so player.replace() is near-instant.
                fetch(url, { method: 'GET', headers: { Range: 'bytes=0-262143' } }).catch(() => {});
            }
        };

        if (prefetchedEpisodeRef.current?.id === nextId) {
            // Data already prefetched, just preload the video
            preloadVideo(prefetchedEpisodeRef.current);
            return;
        }
        episodeService.getEpisode(nextId).then(res => {
            prefetchedEpisodeRef.current = res.data;
            preloadVideo(res.data);
        }).catch(() => {});
    }, [currentEpisodeId, episodes, loading, locked]);

    // Check watchlist
    useEffect(() => {
        if (isLoggedIn && dramaId) {
            watchlistService.check(dramaId).then(r => {
                setInWatchlist(r.data?.is_watchlisted || false);
            }).catch(() => { });
        }
    }, [isLoggedIn, dramaId]);

    // Auto-hide overlay after 3 seconds
    const scheduleHide = useCallback(() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
            Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setShowOverlay(false));
        }, 3000);
    }, [overlayOpacity]);

    useEffect(() => {
        scheduleHide();
        return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
    }, []);

    const toggleOverlay = () => {
        if (showOverlay) {
            // Overlay visible — tap plays video and hides everything
            try { player?.play(); } catch {}
            if (hideTimer.current) clearTimeout(hideTimer.current);
            Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setShowOverlay(false));
        } else {
            // Overlay hidden — tap pauses and shows everything
            if (isPlaying) {
                try { player?.pause(); } catch {}
            }
            setShowOverlay(true);
            overlayOpacity.setValue(1);
            if (hideTimer.current) clearTimeout(hideTimer.current);
        }
    };

    // Save progress
    const saveProgress = useCallback(async (positionMs: number, durationMs: number) => {
        if (!isLoggedIn || !episode || !currentEpisodeId) return;
        const pct = durationMs > 0 ? Math.round((positionMs / durationMs) * 100) : 0;
        if (pct > 0 && pct !== progress) {
            setProgress(pct);
            try {
                const progressSeconds = Math.floor(positionMs / 1000);
                const completed = pct >= 95;
                await episodeService.updateProgress(currentEpisodeId, progressSeconds, completed);
            } catch { }
        }
    }, [isLoggedIn, episode, progress, currentEpisodeId]);
    useEffect(() => { saveProgressRef.current = saveProgress; }, [saveProgress]);

    // Save last-watched to local storage for continue-watching pill
    useEffect(() => {
        if (!episode || !currentEpisodeId || locked || loading) return;
        saveLastWatched({
            dramaId,
            dramaTitle,
            episodeId: currentEpisodeId,
            episodeNumber: episode.episode_number,
            seasonNumber: episode.season_number,
            thumbnail: episode.thumbnail,
            coverImage: dramaCover,
            progress: progress || 0,
            positionMs: position,
            durationMs: duration,
            timestamp: Date.now(),
        });
    }, [episode, currentEpisodeId, locked, loading, progress, position, duration, dramaId, dramaTitle, dramaCover]);

    const togglePlayPause = () => {
        if (!player) return;
        try {
            if (isPlaying) {
                player.pause();
                // Show overlay when pausing
                setShowOverlay(true);
                overlayOpacity.setValue(1);
                if (hideTimer.current) clearTimeout(hideTimer.current);
            } else {
                player.play();
                // Hide overlay after playing
                scheduleHide();
            }
        } catch {}
    };

    const seekBy = (deltaMs: number) => {
        if (!player || duration <= 0) return;
        try {
            player.seekBy(deltaMs / 1000);
        } catch {}
        scheduleHide();
    };

    const seekToFraction = (fraction: number) => {
        if (!player || duration <= 0) return;
        try {
            const targetSec = Math.max(0, Math.min(fraction * (duration / 1000), duration / 1000));
            player.currentTime = targetSec;
        } catch {}
        scheduleHide();
    };

    // Draggable progress bar — use refs to avoid stale closures in PanResponder
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [scrubFraction, setScrubFraction] = useState(0);
    const trackLayoutRef = useRef({ x: 0, width: 1 });
    const durationRef = useRef(duration);
    durationRef.current = duration;

    const scrubPositionMs = scrubFraction * duration;

    const fractionFromEvent = (e: GestureResponderEvent) => {
        const touchX = e.nativeEvent.pageX - trackLayoutRef.current.x;
        return Math.max(0, Math.min(touchX / trackLayoutRef.current.width, 1));
    };

    const scrubResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            onPanResponderGrant: (e) => {
                setIsScrubbing(true);
                setScrubFraction(fractionFromEvent(e));
            },
            onPanResponderMove: (e) => {
                setScrubFraction(fractionFromEvent(e));
            },
            onPanResponderRelease: (e) => {
                const frac = fractionFromEvent(e);
                setIsScrubbing(false);
                setScrubFraction(frac);
                // Use ref to get current duration (avoids stale closure)
                const dur = durationRef.current;
                if (dur > 0) {
                    const targetSec = Math.max(0, Math.min(frac * (dur / 1000), dur / 1000));
                    try { if (playerRef.current) playerRef.current.currentTime = targetSec; } catch {}
                }
            },
            onPanResponderTerminate: () => {
                setIsScrubbing(false);
            },
        })
    ).current;

    // ── Vertical swipe to navigate episodes ──
    const [swipeHint, setSwipeHint] = useState<'up' | 'down' | null>(null);
    const swipeThreshold = SCREEN_H * 0.10; // 10% of screen to trigger
    const isSwipingRef = useRef(false);
    const isSwitchingRef = useRef(false); // Prevent double episode switch
    // Refs to avoid stale closures in PanResponder
    const nextEpisodeRef = useRef<() => void>(() => {});
    const prevEpisodeRef = useRef<() => void>(() => {});
    const toggleOverlayRef = useRef<() => void>(() => {});
    useEffect(() => { toggleOverlayRef.current = toggleOverlay; });

    // Swipe transition animation
    const swipeTranslateY = useRef(new Animated.Value(0)).current;

    const episodeSwipeResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_e, gs) => {
                return Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5;
            },
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponderCapture: () => false,
            onPanResponderGrant: () => {
                isSwipingRef.current = false;
            },
            onPanResponderMove: (_e, gs) => {
                if (Math.abs(gs.dy) > 15) {
                    isSwipingRef.current = true;
                    // Animate video container with the swipe
                    swipeTranslateY.setValue(gs.dy * 0.3);
                    if (gs.dy < -50) setSwipeHint('up');
                    else if (gs.dy > 50) setSwipeHint('down');
                    else setSwipeHint(null);
                }
            },
            onPanResponderRelease: (_e, gs) => {
                const wasSwiping = isSwipingRef.current;
                isSwipingRef.current = false;
                setSwipeHint(null);

                // If no significant movement, treat as a TAP
                if (!wasSwiping && Math.abs(gs.dx) < 10 && Math.abs(gs.dy) < 10) {
                    try { toggleOverlayRef.current(); } catch {}
                    swipeTranslateY.setValue(0);
                    return;
                }

                const didSwipe = Math.abs(gs.dy) > swipeThreshold && Math.abs(gs.vy) > 0.15;
                if (didSwipe && gs.dy < -swipeThreshold) {
                    // Swipe up → next episode (slide out up)
                    Animated.timing(swipeTranslateY, {
                        toValue: -SCREEN_H,
                        duration: 250,
                        useNativeDriver: true,
                    }).start(() => {
                        swipeTranslateY.setValue(0);
                        try { nextEpisodeRef.current(); } catch {}
                    });
                } else if (didSwipe && gs.dy > swipeThreshold) {
                    // Swipe down → previous episode (slide out down)
                    Animated.timing(swipeTranslateY, {
                        toValue: SCREEN_H,
                        duration: 250,
                        useNativeDriver: true,
                    }).start(() => {
                        swipeTranslateY.setValue(0);
                        try { prevEpisodeRef.current(); } catch {}
                    });
                } else {
                    // Snap back
                    Animated.spring(swipeTranslateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 100,
                        friction: 10,
                    }).start();
                }
            },
            onPanResponderTerminate: () => {
                isSwipingRef.current = false;
                setSwipeHint(null);
                Animated.spring(swipeTranslateY, {
                    toValue: 0,
                    useNativeDriver: true,
                }).start();
            },
        })
    ).current;

    const handleUnlock = async () => {
        if (!currentEpisodeId) return;
        setUnlocking(true);
        try {
            await episodeService.unlockEpisode(currentEpisodeId);
            // Set loading so we don't flash "Video not available" with stale data
            setLoading(true);
            setLocked(false);
            await fetchEpisode();
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Could not unlock episode';
            showAlert('Unlock Failed', msg);
        } finally {
            setUnlocking(false);
        }
    };

    const switchEpisode = useCallback((newEpisodeId: number) => {
        if (isSwitchingRef.current) return; // Prevent double-switch
        isSwitchingRef.current = true;
        // Reset playback state — source will update via useEffect when episode loads
        setPosition(0);
        setDuration(0);
        setProgress(0);
        setIsPlaying(true);
        hasResumed.current = false;
        resumePos.current = 0;
        setLocalVideoUri(null);
        preloadedVideoUrlRef.current = null;
        // Keep loading true so spinner shows briefly until new video is ready
        setLoading(true);
        setEpisode(null);
        setCurrentEpisodeId(newEpisodeId);
    }, []);

    const handleNextEpisode = useCallback(async () => {
        if (!currentEpisodeId) return;
        // Try sorted episodes list first (client-side), fall back to API
        if (episodes.length > 0) {
            const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number);
            const idx = sorted.findIndex(e => e.id === currentEpisodeId);
            if (idx >= 0 && idx < sorted.length - 1) {
                switchEpisode(sorted[idx + 1].id);
                return;
            }
        }
        try {
            const res = await episodeService.getNextEpisode(currentEpisodeId);
            const next = res.data as any;
            if (next?.has_next && next?.episode?.id) {
                switchEpisode(next.episode.id);
            } else if (next?.id) {
                // Legacy format: direct episode object
                switchEpisode(next.id);
            } else if (next?.is_series_complete) {
                setSeriesCompleteData(next);
                setShowSeriesComplete(true);
            } else {
                showAlert('End', 'No more episodes');
            }
        } catch {
            showAlert('End', 'No more episodes');
        }
    }, [episodes, currentEpisodeId, switchEpisode]);

    const handlePrevEpisode = useCallback(() => {
        if (!episodes.length || !currentEpisodeId) return;
        const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number);
        const idx = sorted.findIndex(e => e.id === currentEpisodeId);
        if (idx > 0) {
            switchEpisode(sorted[idx - 1].id);
        }
    }, [episodes, currentEpisodeId, switchEpisode]);

    // Keep refs in sync so PanResponder always calls latest handlers
    useEffect(() => { nextEpisodeRef.current = handleNextEpisode; }, [handleNextEpisode]);
    useEffect(() => { prevEpisodeRef.current = handlePrevEpisode; }, [handlePrevEpisode]);

    const toggleLike = async () => {
        if (!isLoggedIn || !currentEpisodeId) return;
        try {
            await interactionService.toggleEpisodeLike(currentEpisodeId);
            setLiked(!liked);
            setLikeCount(c => liked ? c - 1 : c + 1);
        } catch { }
    };

    const toggleWatchlist = async () => {
        if (!isLoggedIn || !dramaId) return;
        try {
            if (inWatchlist) await watchlistService.remove(dramaId);
            else await watchlistService.add(dramaId);
            setInWatchlist(!inWatchlist);
        } catch { }
    };

    const handleShare = async () => {
        if (!episode) return;
        try {
            await Share.share({
                message: `Watch Episode ${episode.episode_number} on Sinemani!`,
                title: episode.title || `Episode ${episode.episode_number}`,
            });
        } catch { }
    };

    // Check download status and local URI when episode changes
    useEffect(() => {
        if (!episode) return;
        isDownloaded(episode.id).then(setDownloaded);
        getLocalUri(episode.id).then(uri => setLocalVideoUri(uri));
    }, [episode?.id]);

    const handleDownload = async () => {
        if (Platform.OS === 'web') {
            showAlert('Download', 'Downloads are not available on web');
            return;
        }
        if (!episode) return;

        // Only VIP members can download for offline viewing
        if (!isVip) {
            showAlert('VIP Only', 'Offline downloads are available for VIP members only. Subscribe to VIP to download episodes and watch offline.', [
                { text: 'Not Now', style: 'cancel' },
                { text: 'Subscribe', onPress: () => navigation.navigate('Subscription') },
            ]);
            return;
        }

        if (downloaded) {
            showAlert('Downloaded', 'This episode is already downloaded.', [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive', onPress: async () => {
                        await removeDownload(episode.id);
                        setDownloaded(false);
                    },
                },
            ]);
            return;
        }

        // For downloads, prefer the MP4 file (not HLS stream which is just a playlist)
        const mp4Url = episode.video_url || (episode.video_path ? `${STORAGE_URL}/${episode.video_path}` : null);
        // Only fall back to stream_url if it's not an HLS playlist
        const remoteUrl = mp4Url || (episode.stream_url && !episode.stream_url.endsWith('.m3u8') ? episode.stream_url : null);
        if (!remoteUrl) {
            showAlert('Error', 'No downloadable video available');
            return;
        }

        setDownloading(true);
        setDownloadProgress(0);
        try {
            await downloadEpisode(remoteUrl, {
                episodeId: episode.id,
                dramaId,
                dramaTitle,
                episodeNumber: episode.episode_number,
                seasonNumber: episode.season_number,
                title: episode.title || `Episode ${episode.episode_number}`,
                thumbnail: episode.thumbnail,
            }, (progress) => setDownloadProgress(progress));
            setDownloaded(true);
            showAlert('Downloaded', 'Episode saved for offline viewing');
        } catch (e: any) {
            showAlert('Download Failed', e.message || 'Could not download episode');
        } finally {
            setDownloading(false);
        }
    };

    const setSpeed = (speed: number) => {
        setCurrentSpeed(speed);
        setShowSpeedModal(false);
        try { if (player) player.playbackRate = speed; } catch {}
        scheduleHide();
    };

    const setQuality = (quality: string) => {
        setCurrentQuality(quality);
        setShowQualityModal(false);
        scheduleHide();

        if (!episode || locked || localVideoUri || offlineLocalUri) return;

        // Derive the stream base URL from the episode's stream_url (master.m3u8)
        const streamUrl = episode.stream_url || episode.hls_url;
        if (!streamUrl || !streamUrl.includes('master.m3u8')) return;

        const baseDir = streamUrl.replace('/master.m3u8', '');
        let newUrl: string;

        if (quality === 'Auto') {
            // Use master playlist — player adapts automatically
            newUrl = streamUrl.startsWith('http') ? streamUrl : `${STORAGE_URL}/${streamUrl}`;
        } else {
            const variant = QUALITY_VARIANT_MAP[quality];
            if (!variant) return;
            newUrl = `${baseDir.startsWith('http') ? baseDir : `${STORAGE_URL}/${baseDir}`}/${variant}/playlist.m3u8`;
        }

        if (newUrl !== videoUrlRef.current) {
            videoUrlRef.current = newUrl;
            // Setting videoUrl re-keys <VideoStage>, mounting a fresh player
            setLoading(true);
            setVideoUrl(newUrl);
        }
    };

    const selectEpisode = (ep: Episode) => {
        // If episode is locked, show payment prompt instead of playing
        if (!ep.is_free && !ep.is_unlocked) {
            setPromptEpisode(ep);
            setShowPaymentPrompt(true);
            return;
        }
        setShowEpisodeList(false);
        setShowInfoSheet(false);
        if (ep.id !== currentEpisodeId) {
            switchEpisode(ep.id);
        }
    };

    const handlePayWithCoins = async () => {
        if (!promptEpisode) return;
        const epId = promptEpisode.id;
        setShowPaymentPrompt(false);
        setShowEpisodeList(false);
        setShowInfoSheet(false);
        setPromptEpisode(null);
        try {
            setLoading(true);
            await episodeService.unlockEpisode(epId);
            // Fetch the now-unlocked episode directly (avoid stale closure)
            const res = await episodeService.getEpisode(epId);
            const ep = res.data;
            setEpisode(ep);
            setCurrentEpisodeId(epId);
            setLocked(false);
            setLiked(ep.is_liked || false);
            setLikeCount(ep.like_count || ep.likes_count || 0);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Could not unlock episode';
            showAlert('Unlock Failed', msg);
            // Navigate to the locked episode so user sees the lock screen with options
            if (epId !== currentEpisodeId) {
                setCurrentEpisodeId(epId);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoToCoinStore = () => {
        setShowPaymentPrompt(false);
        setPromptEpisode(null);
        navigation.navigate('CoinStore');
    };

    const handleGoToSubscription = () => {
        setShowPaymentPrompt(false);
        setPromptEpisode(null);
        navigation.navigate('Subscription');
    };

    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    // Info sheet animation
    const toggleInfoSheet = () => {
        if (showInfoSheet) {
            Animated.timing(infoSheetAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setShowInfoSheet(false));
        } else {
            setShowInfoSheet(true);
            infoSheetAnim.setValue(0);
            Animated.timing(infoSheetAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    };

    // Current episode position
    const currentEpIndex = episode ? episodes.findIndex(e => e.id === episode.id) : -1;
    const currentEpNum = episode?.episode_number || (currentEpIndex >= 0 ? currentEpIndex + 1 : 1);
    const totalEps = episodes.length;

    // Update video URL when episode changes. The <VideoStage> child component
    // is keyed by URL, so changing videoUrl unmounts the old player+VideoView
    // and mounts a brand-new pair \u2014 fully avoiding the iOS black-screen bug.
    useEffect(() => {
        if (!episode || locked) {
            setVideoUrl(null);
            videoUrlRef.current = null;
            return;
        }
        const rawUrl = episode.stream_url || episode.video_url || (episode.video_path ? episode.video_path : null);
        const remote = rawUrl
            ? (rawUrl.startsWith('http') ? rawUrl : `${STORAGE_URL}/${rawUrl}`)
            : null;
        // Prefer local file (downloaded), then offline URI from nav params, then remote
        const url = localVideoUri || offlineLocalUri || remote;

        if (!url) {
            setVideoUrl(null);
            videoUrlRef.current = null;
            setLoading(false);
            return;
        }

        if (url !== videoUrlRef.current) {
            videoUrlRef.current = url;
            setLoading(true);
            setVideoUrl(url);
        }
    }, [episode, locked, localVideoUri, offlineLocalUri]);

    // Initial-load screen: only show full-screen spinner when we don't even
    // have an episode object yet. Once we have one, render the player layout
    // with a poster placeholder so the user sees content immediately.
    if (!episode) {
        return (
            <View style={styles.center}>
                <StatusBar hidden />
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // Poster shown behind/over the video while it's buffering (first frame
    // not yet rendered). Episode thumbnail is preferred, falls back to drama
    // cover. Built as a full HTTPS URL.
    const posterRaw = episode.thumbnail || dramaCover || null;
    const posterUri = posterRaw
        ? (posterRaw.startsWith('http') ? posterRaw : `${STORAGE_URL}/${posterRaw}`)
        : null;

    return (
        <View style={styles.container}>
            <StatusBar hidden />

            {/* Fullscreen vertical video */}
            <Animated.View
                style={[styles.videoContainer, { transform: [{ translateY: swipeTranslateY }] }]}
            >
                <View style={{ flex: 1 }}>
                    {locked ? (
                        <View style={styles.lockedOverlay}>
                            {/* Back button */}
                            <TouchableOpacity style={styles.lockedBackBtn} onPress={() => navigation.goBack()}>
                                <Ionicons name="chevron-down" size={28} color="#fff" />
                            </TouchableOpacity>

                            <Ionicons name="lock-closed" size={56} color={COLORS.primary} />
                            <Text style={styles.lockTitle}>Episode {episode?.episode_number} is Locked</Text>
                            <Text style={styles.lockDesc}>
                                {(episode?.coin_cost || episode?.coin_price)
                                    ? `This episode costs 🪙 ${episode?.coin_cost || episode?.coin_price} coins to unlock`
                                    : 'You need a VIP subscription to watch this episode'}
                            </Text>

                            {/* Unlock with coins */}
                            {(episode?.coin_cost || episode?.coin_price) ? (
                                <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock} disabled={unlocking}>
                                    {unlocking ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.unlockBtnText}>🪙 Unlock for {episode?.coin_cost || episode?.coin_price} Coins</Text>
                                    )}
                                </TouchableOpacity>
                            ) : null}

                            {/* Buy coins */}
                            <TouchableOpacity style={styles.coinStoreBtn} onPress={() => navigation.navigate('CoinStore')}>
                                <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
                                <Text style={styles.coinStoreBtnText}>Buy More Coins</Text>
                            </TouchableOpacity>

                            {/* Divider */}
                            <View style={styles.lockDivider}>
                                <View style={styles.lockDividerLine} />
                                <Text style={styles.lockDividerText}>OR</Text>
                                <View style={styles.lockDividerLine} />
                            </View>

                            {/* Subscribe */}
                            <TouchableOpacity style={styles.subscribeBtn} onPress={() => navigation.navigate('Subscription')}>
                                <Ionicons name="star" size={18} color="#000" />
                                <Text style={styles.subscribeBtnText}>Subscribe VIP — Unlock All</Text>
                            </TouchableOpacity>
                            <Text style={styles.lockHint}>VIP members watch all episodes for free</Text>
                        </View>
                    ) : videoUrl ? (
                        <VideoStage
                            key={videoUrl}
                            url={videoUrl}
                            onPlayer={setPlayer}
                            posterUri={posterUri}
                            loading={loading}
                        />
                    ) : (
                        <View style={styles.lockedOverlay}>
                            {posterUri ? (
                                <Image
                                    source={{ uri: posterUri }}
                                    style={StyleSheet.absoluteFill}
                                    contentFit="cover"
                                    transition={150}
                                />
                            ) : null}
                            <View style={styles.posterDim} />
                            <ActivityIndicator size="large" color={COLORS.primary} />
                        </View>
                    )}

                    {/* ─── GESTURE CATCHER — sits on top of VideoView to capture taps & swipes ─── */}
                    {!locked && (
                        <View
                            style={StyleSheet.absoluteFill}
                            {...episodeSwipeResponder.panHandlers}
                        />
                    )}

                    {/* ─── OVERLAY (shown on tap) ─── */}
                    {showOverlay && !locked && (
                        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="box-none">

                            {/* ── TOP BAR ── */}
                            <View style={styles.topBar}>
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBtn}>
                                    <Ionicons name="chevron-down" size={28} color="#fff" />
                                </TouchableOpacity>
                                <View style={styles.topCenter}>
                                    <Text style={styles.topTitle} numberOfLines={1}>
                                        Ep {episode?.episode_number}{episode?.title ? ` · ${episode.title}` : ''}
                                    </Text>
                                </View>
                                <View style={{ width: 40 }} />
                            </View>

                            {/* ── CENTER PLAY/PAUSE & NAV ── */}
                            <View style={styles.centerControls}>
                                <TouchableOpacity onPress={handlePrevEpisode} style={styles.skipBtn}>
                                    <Ionicons name="play-skip-back" size={24} color="rgba(255,255,255,0.8)" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => seekBy(-10000)} style={styles.seekBtn}>
                                    <Ionicons name="play-back" size={26} color="rgba(255,255,255,0.9)" />
                                    <Text style={styles.seekLabel}>10</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn}>
                                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => seekBy(10000)} style={styles.seekBtn}>
                                    <Ionicons name="play-forward" size={26} color="rgba(255,255,255,0.9)" />
                                    <Text style={styles.seekLabel}>10</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleNextEpisode} style={styles.skipBtn}>
                                    <Ionicons name="play-skip-forward" size={24} color="rgba(255,255,255,0.8)" />
                                </TouchableOpacity>
                            </View>


                        </Animated.View>
                    )}

                    {/* ── RIGHT SIDE ACTIONS (shown on tap with overlay) ── */}
                    {!locked && showOverlay && (
                        <View style={styles.rightActions}>
                            {/* Episode list */}
                            <TouchableOpacity style={styles.sideBtn} onPress={() => setShowEpisodeList(true)}>
                                <Ionicons name="list" size={28} color="#fff" />
                                <Text style={styles.sideBtnLabel}>
                                    {episodes.length > 0 ? `${episodes.length} Eps` : 'Episodes'}
                                </Text>
                            </TouchableOpacity>

                            {/* Like */}
                            <TouchableOpacity style={styles.sideBtn} onPress={toggleLike}>
                                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? COLORS.primary : '#fff'} />
                                <Text style={styles.sideBtnLabel}>{likeCount || 'Like'}</Text>
                            </TouchableOpacity>

                            {/* Watchlist */}
                            <TouchableOpacity style={styles.sideBtn} onPress={toggleWatchlist}>
                                <Ionicons name={inWatchlist ? 'bookmark' : 'bookmark-outline'} size={28} color={inWatchlist ? COLORS.coin : '#fff'} />
                                <Text style={styles.sideBtnLabel}>{inWatchlist ? 'Saved' : 'Save'}</Text>
                            </TouchableOpacity>

                            {/* Share */}
                            <TouchableOpacity style={styles.sideBtn} onPress={handleShare}>
                                <Ionicons name="share-social-outline" size={28} color="#fff" />
                                <Text style={styles.sideBtnLabel}>Share</Text>
                            </TouchableOpacity>

                            {/* Download — VIP only */}
                            <TouchableOpacity style={styles.sideBtn} onPress={handleDownload} disabled={downloading}>
                                {downloading ? (
                                    <View style={{ alignItems: 'center' }}>
                                        <ActivityIndicator size={24} color={COLORS.primary} />
                                        <Text style={styles.sideBtnLabel}>{Math.round(downloadProgress * 100)}%</Text>
                                    </View>
                                ) : (
                                    <View style={{ alignItems: 'center' }}>
                                        <View>
                                            <Ionicons
                                                name={downloaded ? 'checkmark-circle' : 'download-outline'}
                                                size={28}
                                                color={downloaded ? COLORS.coin : isVip ? '#fff' : '#888'}
                                            />
                                            {!isVip && (
                                                <View style={styles.vipBadge}>
                                                    <Text style={styles.vipBadgeText}>VIP</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.sideBtnLabel, !isVip && { color: '#888' }]}>
                                            {downloaded ? 'Saved' : 'Download'}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Speed */}
                            <TouchableOpacity style={styles.sideBtn} onPress={() => setShowSpeedModal(true)}>
                                <Ionicons name="speedometer-outline" size={24} color="#fff" />
                                <Text style={styles.sideBtnLabel}>{currentSpeed}x</Text>
                            </TouchableOpacity>

                            {/* Subtitles (CC) — only show if tracks exist */}
                            {subtitleTracks.length > 0 && (
                                <TouchableOpacity style={styles.sideBtn} onPress={() => setShowSubtitleModal(true)}>
                                    <Ionicons
                                        name={activeSubtitleUrl ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                                        size={24}
                                        color={activeSubtitleUrl ? COLORS.primary : '#fff'}
                                    />
                                    <Text style={styles.sideBtnLabel}>CC</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                </View>

            {/* Swipe hint */}
            {swipeHint && (
                <View style={styles.swipeHintWrap}>
                    <Ionicons
                        name={swipeHint === 'up' ? 'chevron-up' : 'chevron-down'}
                        size={32}
                        color="#fff"
                    />
                    <Text style={styles.swipeHintText}>
                        {swipeHint === 'up' ? 'Next Episode' : 'Previous Episode'}
                    </Text>
                </View>
            )}
            </Animated.View>

            {/* ── BOTTOM INFO — shown on tap with overlay ── */}
            {!locked && showOverlay && !showInfoSheet && (
                <View style={styles.bottomInfoWrap} pointerEvents="box-none">
                    <View style={styles.bottomInfoContent} pointerEvents="box-none">
                        {/* Drama title */}
                        <Text style={styles.bottomInfoTitle} numberOfLines={1}>
                            {dramaTitle || 'Untitled'}
                        </Text>

                        {/* Episode info */}
                        <Text style={styles.bottomInfoEp}>
                            Ep {currentEpNum} of {totalEps || '?'}{episode?.title ? ` · ${episode.title}` : ''}
                        </Text>

                        {/* Short description */}
                        {(dramaSynopsis || episode?.description) ? (
                            <Text style={styles.bottomInfoDesc} numberOfLines={3}>
                                {dramaSynopsis || episode?.description}
                            </Text>
                        ) : null}

                        {/* Read more → opens info sheet sliding up */}
                        <TouchableOpacity
                            onPress={toggleInfoSheet}
                            style={styles.bottomInfoMoreBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.bottomInfoMoreText}>Read more</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* ── Subtitle overlay (above progress bar, behind side actions) ── */}
            {!locked && currentCueText ? (
                <View style={styles.subtitleOverlayWrap} pointerEvents="none">
                    <Text style={styles.subtitleOverlayText}>{currentCueText}</Text>
                </View>
            ) : null}

            {/* ── TikTok-style progress bar (always visible, above everything) ── */}
            {!locked && (
                <View style={styles.tiktokBarWrap}>
                    {/* Scrub tooltip */}
                    {isScrubbing && (
                        <View style={[
                            styles.scrubTimeTooltip,
                            { left: `${Math.min(Math.max(scrubFraction * 100, 5), 95)}%` },
                        ]}>
                            <Text style={styles.scrubTimeText}>
                                {formatTime(scrubPositionMs)}
                            </Text>
                        </View>
                    )}
                    {/* Track */}
                    <View
                        style={[styles.tiktokTrack, isScrubbing && styles.tiktokTrackActive]}
                        onLayout={(e) => {
                            e.target.measure((_x: number, _y: number, w: number, _h: number, pageX: number) => {
                                trackLayoutRef.current = { x: pageX, width: w };
                            });
                        }}
                        {...scrubResponder.panHandlers}
                    >
                        <View style={[styles.tiktokBg, isScrubbing && styles.tiktokBgActive]} />
                        <View
                            style={[
                                styles.tiktokFill,
                                isScrubbing && styles.tiktokFillActive,
                                { width: `${(isScrubbing ? scrubFraction : (duration > 0 ? position / duration : 0)) * 100}%` },
                            ]}
                        />
                        {isScrubbing && (
                            <View style={[
                                styles.tiktokDot,
                                { left: `${scrubFraction * 100}%` },
                            ]} />
                        )}
                    </View>
                </View>
            )}

            {/* ─── SPEED MODAL ─── */}
            <Modal visible={showSpeedModal} transparent animationType="fade" onRequestClose={() => setShowSpeedModal(false)}>
                <TouchableWithoutFeedback onPress={() => setShowSpeedModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalSheet}>
                                <Text style={styles.modalTitle}>Playback Speed</Text>
                                {PLAYBACK_SPEEDS.map(speed => (
                                    <TouchableOpacity key={speed} style={styles.modalOption} onPress={() => setSpeed(speed)}>
                                        <Text style={[styles.modalOptionText, currentSpeed === speed && styles.modalOptionActive]}>
                                            {speed === 1.0 ? 'Normal' : `${speed}x`}
                                        </Text>
                                        {currentSpeed === speed && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* ─── QUALITY MODAL ─── */}
            <Modal visible={showQualityModal} transparent animationType="fade" onRequestClose={() => setShowQualityModal(false)}>
                <TouchableWithoutFeedback onPress={() => setShowQualityModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalSheet}>
                                <Text style={styles.modalTitle}>Picture Quality</Text>
                                {QUALITY_OPTIONS.map(q => (
                                    <TouchableOpacity key={q} style={styles.modalOption} onPress={() => setQuality(q)}>
                                        <Text style={[styles.modalOptionText, currentQuality === q && styles.modalOptionActive]}>
                                            {q}
                                        </Text>
                                        {currentQuality === q && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* ─── SUBTITLE MODAL ─── */}
            <Modal visible={showSubtitleModal} transparent animationType="fade" onRequestClose={() => setShowSubtitleModal(false)}>
                <TouchableWithoutFeedback onPress={() => setShowSubtitleModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalSheet}>
                                <Text style={styles.modalTitle}>Subtitles</Text>
                                <TouchableOpacity
                                    style={styles.modalOption}
                                    onPress={() => { setActiveSubtitleUrl(null); setShowSubtitleModal(false); }}
                                >
                                    <Text style={[styles.modalOptionText, !activeSubtitleUrl && styles.modalOptionActive]}>
                                        Off
                                    </Text>
                                    {!activeSubtitleUrl && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                                </TouchableOpacity>
                                {subtitleTracks.map((t) => (
                                    <TouchableOpacity
                                        key={t.url}
                                        style={styles.modalOption}
                                        onPress={() => { setActiveSubtitleUrl(t.url); setShowSubtitleModal(false); }}
                                    >
                                        <Text style={[styles.modalOptionText, activeSubtitleUrl === t.url && styles.modalOptionActive]}>
                                            {t.label || t.language || 'Subtitle'}
                                        </Text>
                                        {activeSubtitleUrl === t.url && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* ─── EPISODE LIST MODAL ─── */}
            <Modal visible={showEpisodeList} transparent animationType="slide" onRequestClose={() => setShowEpisodeList(false)}>
                <View style={styles.episodeModalOverlay}>
                    <View style={styles.episodeSheet}>
                        <View style={styles.episodeSheetHeader}>
                            <Text style={styles.modalTitle}>Episodes ({episodes.length})</Text>
                            <TouchableOpacity onPress={() => setShowEpisodeList(false)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={episodes}
                            keyExtractor={e => String(e.id)}
                            renderItem={({ item: ep }) => {
                                const isCurrent = ep.id === currentEpisodeId;
                                return (
                                    <TouchableOpacity
                                        style={[styles.epItem, isCurrent && styles.epItemActive]}
                                        onPress={() => selectEpisode(ep)}
                                    >
                                        <View style={[styles.epNumCircle, isCurrent && { backgroundColor: COLORS.primary }]}>
                                            <Text style={[styles.epNumText, isCurrent && { color: '#fff' }]}>{ep.episode_number}</Text>
                                        </View>
                                        <View style={styles.epItemInfo}>
                                            <Text style={[styles.epItemTitle, isCurrent && { color: COLORS.primary }]} numberOfLines={1}>
                                                {ep.title || `Episode ${ep.episode_number}`}
                                            </Text>
                                            <Text style={styles.epItemMeta}>
                                                {ep.duration ? `${Math.floor(ep.duration / 60)}min` : ''}
                                                {ep.is_free ? '  · Free' : (ep.coin_cost || ep.coin_price) ? `  · 🪙${ep.coin_cost || ep.coin_price}` : ''}
                                            </Text>
                                        </View>
                                        {isCurrent ? (
                                            <Ionicons name="radio-button-on" size={20} color={COLORS.primary} />
                                        ) : !ep.is_free && !ep.is_unlocked ? (
                                            <Ionicons name="lock-closed" size={18} color={COLORS.textMuted} />
                                        ) : (
                                            <Ionicons name="play-circle-outline" size={20} color={COLORS.textSecondary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* ─── SERIES COMPLETE MODAL ─── */}
            <Modal visible={showSeriesComplete} transparent animationType="fade" onRequestClose={() => setShowSeriesComplete(false)}>
                <TouchableWithoutFeedback onPress={() => setShowSeriesComplete(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.seriesCompleteSheet}>
                                {/* Header */}
                                <View style={styles.seriesCompleteHeader}>
                                    <View style={styles.seriesCompleteBadge}>
                                        <Ionicons name="trophy" size={36} color="#FFD700" />
                                    </View>
                                    <Text style={styles.seriesCompleteTitle}>
                                        {seriesCompleteData?.message || 'Series Complete!'}
                                    </Text>
                                    {seriesCompleteData?.drama && (
                                        <View style={styles.seriesCompleteMeta}>
                                            <Text style={styles.seriesCompleteMetaText}>
                                                {seriesCompleteData.drama.total_episodes} episodes • ⭐ {seriesCompleteData.drama.rating || 'N/A'}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Suggestions */}
                                {seriesCompleteData?.suggestions?.length > 0 && (
                                    <View>
                                        <Text style={styles.suggestionsTitle}>You might also like</Text>
                                        <FlatList
                                            data={seriesCompleteData.suggestions}
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            keyExtractor={(item: any) => String(item.id)}
                                            contentContainerStyle={{ paddingBottom: 4 }}
                                            renderItem={({ item: drama }: { item: any }) => {
                                                const poster = drama.cover_image || drama.poster;
                                                return (
                                                    <TouchableOpacity
                                                        style={styles.suggestionCard}
                                                        activeOpacity={0.8}
                                                        onPress={() => {
                                                            setShowSeriesComplete(false);
                                                            navigation.replace('DramaDetail', { dramaId: drama.id });
                                                        }}
                                                    >
                                                        <Image
                                                            source={{ uri: poster ? `${STORAGE_URL}/${poster}` : 'https://via.placeholder.com/100x140/1a1a2e/666' }}
                                                            style={styles.suggestionPoster}
                                                            contentFit="cover"
                                                        />
                                                        <Text style={styles.suggestionDramaTitle} numberOfLines={2}>{drama.title}</Text>
                                                        {drama.category?.name && (
                                                            <Text style={styles.suggestionCategory}>{drama.category.name}</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            }}
                                        />
                                    </View>
                                )}

                                {/* Close button */}
                                <TouchableOpacity
                                    style={styles.seriesCompleteCloseBtn}
                                    onPress={() => {
                                        setShowSeriesComplete(false);
                                        navigation.navigate('MainTabs', { screen: 'Discover' });
                                    }}
                                >
                                    <Text style={styles.seriesCompleteCloseBtnText}>Discover More</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* ─── PAYMENT PROMPT MODAL ─── */}
            <Modal visible={showPaymentPrompt} transparent animationType="fade" onRequestClose={() => setShowPaymentPrompt(false)}>
                <TouchableWithoutFeedback onPress={() => setShowPaymentPrompt(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.paymentPromptSheet}>
                                <View style={styles.paymentPromptHeader}>
                                    <Ionicons name="lock-closed" size={32} color={COLORS.primary} />
                                    <Text style={styles.paymentPromptTitle}>
                                        Episode {promptEpisode?.episode_number} is Locked
                                    </Text>
                                    <Text style={styles.paymentPromptDesc}>
                                        {(promptEpisode?.coin_cost || promptEpisode?.coin_price)
                                            ? `This episode requires 🪙 ${promptEpisode?.coin_cost || promptEpisode?.coin_price} coins to unlock`
                                            : 'You need a subscription to watch this episode'}
                                    </Text>
                                </View>

                                {/* Option 1: Unlock with coins */}
                                {(promptEpisode?.coin_cost || promptEpisode?.coin_price) ? (
                                    <TouchableOpacity style={styles.paymentOption} onPress={handlePayWithCoins}>
                                        <View style={[styles.paymentOptionIcon, { backgroundColor: 'rgba(255,179,0,0.15)' }]}>
                                            <Ionicons name="flash" size={22} color={COLORS.coin || '#FFB300'} />
                                        </View>
                                        <View style={styles.paymentOptionInfo}>
                                            <Text style={styles.paymentOptionTitle}>Use Coins</Text>
                                            <Text style={styles.paymentOptionMeta}>🪙 {promptEpisode?.coin_cost || promptEpisode?.coin_price} coins</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                                    </TouchableOpacity>
                                ) : null}

                                {/* Option 2: Buy coins */}
                                <TouchableOpacity style={styles.paymentOption} onPress={handleGoToCoinStore}>
                                    <View style={[styles.paymentOptionIcon, { backgroundColor: 'rgba(229,9,20,0.12)' }]}>
                                        <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
                                    </View>
                                    <View style={styles.paymentOptionInfo}>
                                        <Text style={styles.paymentOptionTitle}>Buy Coins</Text>
                                        <Text style={styles.paymentOptionMeta}>Purchase coin packages</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                                </TouchableOpacity>

                                {/* Option 3: Subscribe VIP */}
                                <TouchableOpacity style={styles.paymentOption} onPress={handleGoToSubscription}>
                                    <View style={[styles.paymentOptionIcon, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
                                        <Ionicons name="star" size={22} color="#FFD700" />
                                    </View>
                                    <View style={styles.paymentOptionInfo}>
                                        <Text style={styles.paymentOptionTitle}>Subscribe VIP</Text>
                                        <Text style={styles.paymentOptionMeta}>Unlock all episodes</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.paymentCancelBtn} onPress={() => setShowPaymentPrompt(false)}>
                                    <Text style={styles.paymentCancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>



            {/* ─── INFO BOTTOM SHEET (synopsis + episodes) ─── */}
            {showInfoSheet && (
                <Animated.View
                    style={[
                        styles.infoSheetOverlay,
                        {
                            opacity: infoSheetAnim,
                        },
                    ]}
                >
                    <TouchableWithoutFeedback onPress={toggleInfoSheet}>
                        <View style={styles.infoSheetBackdrop} />
                    </TouchableWithoutFeedback>
                    <Animated.View
                        style={[
                            styles.infoSheetContainer,
                            {
                                transform: [{
                                    translateY: infoSheetAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [SCREEN_H * 0.7, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        {/* Handle bar */}
                        <View style={styles.infoSheetHandle}>
                            <View style={styles.handleBar} />
                        </View>

                        {/* Drama title & episode count */}
                        <View style={styles.infoSheetHeaderRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.infoSheetTitle} numberOfLines={2}>{dramaTitle}</Text>
                                <Text style={styles.infoSheetEpCount}>
                                    Episode {currentEpNum} of {totalEps || '?'}{episode?.title ? ` · ${episode.title}` : ''}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={toggleInfoSheet} style={styles.infoSheetClose}>
                                <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Synopsis */}
                        <View style={styles.synopsisSection}>
                            <Text style={styles.synopsisLabel}>{dramaSynopsis ? 'Synopsis' : 'About'}</Text>
                            <ScrollView style={styles.synopsisScroll} nestedScrollEnabled>
                                <Text style={styles.synopsisText}>
                                    {dramaSynopsis || episode?.description || 'No description available.'}
                                </Text>
                            </ScrollView>
                        </View>

                        {/* Episode list */}
                        <View style={styles.infoEpisodeSection}>
                            <Text style={styles.synopsisLabel}>Episodes ({totalEps})</Text>
                            <FlatList
                                data={episodes}
                                keyExtractor={e => String(e.id)}
                                style={styles.infoEpList}
                                nestedScrollEnabled
                                renderItem={({ item: ep }) => {
                                    const isCurrent = ep.id === currentEpisodeId;
                                    return (
                                        <TouchableOpacity
                                            style={[styles.epItem, isCurrent && styles.epItemActive]}
                                            onPress={() => selectEpisode(ep)}
                                        >
                                            <View style={[styles.epNumCircle, isCurrent && { backgroundColor: COLORS.primary }]}>
                                                <Text style={[styles.epNumText, isCurrent && { color: '#fff' }]}>{ep.episode_number}</Text>
                                            </View>
                                            <View style={styles.epItemInfo}>
                                                <Text style={[styles.epItemTitle, isCurrent && { color: COLORS.primary }]} numberOfLines={1}>
                                                    {ep.title || `Episode ${ep.episode_number}`}
                                                </Text>
                                                <Text style={styles.epItemMeta}>
                                                    {ep.duration ? `${Math.floor(ep.duration / 60)}min` : ''}
                                                    {ep.is_free ? '  · Free' : (ep.coin_cost || ep.coin_price) ? `  · 🪙${ep.coin_cost || ep.coin_price}` : ''}
                                                </Text>
                                            </View>
                                            {isCurrent ? (
                                                <Ionicons name="radio-button-on" size={20} color={COLORS.primary} />
                                            ) : !ep.is_free && !ep.is_unlocked ? (
                                                <Ionicons name="lock-closed" size={18} color={COLORS.textMuted} />
                                            ) : (
                                                <Ionicons name="play-circle-outline" size={20} color={COLORS.textSecondary} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    </Animated.View>
                </Animated.View>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoStage — owns the expo-video player for ONE URL.
//
// This component is keyed by URL in the parent, so each new episode mounts a
// brand-new VideoStage → brand-new useVideoPlayer() → brand-new AVPlayer +
// AVPlayerLayer pair on iOS. This is the only reliable way to avoid the
// "black-screen-with-audio" bug where an existing player's source is swapped
// via player.replace() but the native layer fails to re-attach to the new
// media.
//
// Lifecycle:
//   • mount   → useVideoPlayer creates new player; reports it to parent via
//               onPlayer(p). Parent's useEffects subscribe to its events.
//   • unmount → reports onPlayer(null) so parent drops listeners; expo-video
//               releases the underlying AVPlayer automatically.
// ─────────────────────────────────────────────────────────────────────────────
function VideoStage({
    url,
    onPlayer,
    posterUri,
    loading,
}: {
    url: string;
    onPlayer: (p: VideoPlayer | null) => void;
    posterUri: string | null;
    loading: boolean;
}) {
    const p = useVideoPlayer(url, (player) => {
        player.loop = false;
        player.timeUpdateEventInterval = 0.5;
        // Start playback as soon as the player is created. expo-video will
        // begin playing once the source is ready. This avoids race conditions
        // where the parent’s statusChange listener subscribes too late.
        try { player.play(); } catch {}
    });

    useEffect(() => {
        onPlayer(p);
        return () => onPlayer(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [p]);

    return (
        <>
            <VideoView
                player={p}
                style={styles.video}
                contentFit="cover"
                nativeControls={false}
                allowsPictureInPicture={false}
            />
            {loading && (
                <View pointerEvents="none" style={styles.posterOverlay}>
                    {posterUri ? (
                        <Image
                            source={{ uri: posterUri }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={150}
                        />
                    ) : null}
                    <View style={styles.posterDim} />
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },

    // Video — fill entire screen vertically
    videoContainer: { flex: 1, backgroundColor: '#000', width: SCREEN_W, height: SCREEN_H },
    video: { width: '100%', height: '100%' },

    // Poster placeholder shown over the player while the first frame is buffering
    posterOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    posterDim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },

    // Swipe hint — centered on screen
    swipeHintWrap: {
        position: 'absolute',
        alignSelf: 'center',
        top: '42%',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    swipeHintText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 4,
    },

    // Locked
    lockedOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', paddingHorizontal: 30 },
    lockedBackBtn: {
        position: 'absolute', top: Platform.OS === 'ios' ? 50 : 16, left: 12,
        width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
    },
    lockTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: 16 },
    lockDesc: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
    unlockBtn: { backgroundColor: COLORS.primary, borderRadius: 25, paddingVertical: 14, paddingHorizontal: 32, marginTop: 24, width: '100%', alignItems: 'center' },
    unlockBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    coinStoreBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginTop: 14, paddingVertical: 10,
    },
    coinStoreBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
    lockDivider: {
        flexDirection: 'row', alignItems: 'center', width: '100%',
        marginTop: 20, marginBottom: 16,
    },
    lockDividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)' },
    lockDividerText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', marginHorizontal: 16 },
    subscribeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#FFD700', borderRadius: 25, paddingVertical: 14,
        width: '100%',
    },
    subscribeBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
    lockHint: { color: COLORS.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' },

    // Overlay
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },

    // Top bar
    topBar: {
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        paddingHorizontal: 12, paddingBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    topBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    topCenter: { flex: 1, alignItems: 'center' },
    topTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },

    // Left side actions
    // Left side actions (removed - now all on right)
    leftActions: {
        display: 'none' as any,
    },
    sideBtn: {
        alignItems: 'center',
    },
    sideBtnLabel: {
        color: '#fff', fontSize: 10, marginTop: 3, fontWeight: '500',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    vipBadge: {
        position: 'absolute',
        top: -4,
        right: -10,
        backgroundColor: COLORS.primary,
        borderRadius: 4,
        paddingHorizontal: 3,
        paddingVertical: 1,
    },
    vipBadgeText: {
        color: '#fff',
        fontSize: 7,
        fontWeight: '800',
    },

    // Right side actions (TikTok style - always visible when not locked)
    rightActions: {
        position: 'absolute',
        right: 10,
        bottom: 120,
        alignItems: 'center',
        gap: 18,
        zIndex: 9998,
        elevation: 9998,
    },

    // Center controls
    centerControls: {
        position: 'absolute',
        top: '50%',
        left: 0, right: 0,
        marginTop: -25,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
    },
    playPauseBtn: {
        width: 66, height: 66, borderRadius: 33,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
    },
    seekBtn: {
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center', alignItems: 'center',
    },
    seekLabel: {
        color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700',
        position: 'absolute', bottom: 6,
    },
    skipBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.25)',
        justifyContent: 'center', alignItems: 'center',
    },

    // TikTok-style bottom progress bar
    tiktokBarWrap: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        zIndex: 9999,
        elevation: 9999,
    },

    // Subtitle overlay
    subtitleOverlayWrap: {
        position: 'absolute',
        bottom: 90, left: 16, right: 90,
        zIndex: 9997,
        elevation: 9997,
        alignItems: 'center',
    },
    subtitleOverlayText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        textShadowColor: 'rgba(0,0,0,0.95)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    // Always-visible bottom info (TikTok/Shorts style)
    bottomInfoWrap: {
        position: 'absolute',
        bottom: 14, left: 0, right: 76,
        zIndex: 9998,
        elevation: 9998,
    },
    bottomInfoContent: {
        paddingHorizontal: 16,
        paddingBottom: 4,
    },
    bottomInfoTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.2,
        textShadowColor: 'rgba(0,0,0,0.9)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 5,
    },
    bottomInfoEp: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 4,
        opacity: 0.8,
        textShadowColor: 'rgba(0,0,0,0.9)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 5,
    },
    bottomInfoDesc: {
        color: '#fff',
        fontSize: 13,
        lineHeight: 19,
        marginTop: 6,
        opacity: 0.85,
        textShadowColor: 'rgba(0,0,0,0.9)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 5,
    },
    bottomInfoMoreBtn: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    bottomInfoMoreText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    tiktokTrack: {
        width: '100%',
        height: 28,
        justifyContent: 'flex-end',
    },
    tiktokTrackActive: {
        height: 40,
    },
    tiktokBg: {
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
    },
    tiktokBgActive: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    tiktokFill: {
        position: 'absolute',
        left: 0, bottom: 0,
        height: 4,
        backgroundColor: '#fff',
        borderRadius: 2,
    },
    tiktokFillActive: {
        height: 6,
        backgroundColor: COLORS.primary,
    },
    tiktokDot: {
        position: 'absolute',
        bottom: -6,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: COLORS.primary,
        marginLeft: -8,
        borderWidth: 2,
        borderColor: '#fff',
    },
    scrubTimeTooltip: {
        position: 'absolute',
        bottom: 32,
        marginLeft: -30,
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    scrubTimeText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },

    // Modal shared
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalSheet: {
        backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
    modalOption: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 14, borderBottomWidth: 0.5, borderColor: COLORS.border,
    },
    modalOptionText: { color: COLORS.textSecondary, fontSize: 16 },
    modalOptionActive: { color: COLORS.primary, fontWeight: '600' },

    // Episode list modal
    episodeModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    episodeSheet: {
        backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: SCREEN_H * 0.6, paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    episodeSheetHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
        borderBottomWidth: 0.5, borderColor: COLORS.border,
    },
    epItem: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20,
        borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    },
    epItemActive: { backgroundColor: 'rgba(229,9,20,0.08)' },
    epNumCircle: {
        width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surface,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    epNumText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
    epItemInfo: { flex: 1, marginRight: 8 },
    epItemTitle: { color: COLORS.text, fontSize: 14, fontWeight: '500' },
    epItemMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },



    // Info bottom sheet overlay
    infoSheetOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 30,
    },
    infoSheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    infoSheetContainer: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: SCREEN_H * 0.7,
        backgroundColor: '#1A1A1A',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    infoSheetHandle: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    infoSheetHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 0.5,
        borderColor: COLORS.border,
    },
    infoSheetTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: '700',
    },
    infoSheetEpCount: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '600',
        marginTop: 4,
    },
    infoSheetClose: {
        padding: 4,
        marginLeft: 12,
    },
    synopsisSection: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderColor: COLORS.border,
    },
    synopsisLabel: {
        color: COLORS.textSecondary,
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    synopsisScroll: {
        maxHeight: 100,
    },
    synopsisText: {
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 20,
    },
    infoEpisodeSection: {
        paddingHorizontal: 20,
        paddingTop: 12,
        flex: 1,
    },
    infoEpList: {
        flex: 1,
    },

    // Payment prompt modal
    paymentPromptSheet: {
        backgroundColor: '#1A1A1A', borderTopLeftRadius: 22, borderTopRightRadius: 22,
        paddingHorizontal: 20, paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    paymentPromptHeader: {
        alignItems: 'center', marginBottom: 20,
    },
    paymentPromptTitle: {
        color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 12, textAlign: 'center',
    },
    paymentPromptDesc: {
        color: COLORS.textSecondary, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20,
    },
    paymentOption: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 16,
        borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    },
    paymentOptionIcon: {
        width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
        marginRight: 14,
    },
    paymentOptionInfo: { flex: 1 },
    paymentOptionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
    paymentOptionMeta: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
    paymentCancelBtn: {
        alignItems: 'center', paddingVertical: 16, marginTop: 8,
    },
    paymentCancelText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },

    // Series complete modal
    seriesCompleteSheet: {
        backgroundColor: '#1A1A1A', borderTopLeftRadius: 22, borderTopRightRadius: 22,
        paddingHorizontal: 20, paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: SCREEN_H * 0.75,
    },
    seriesCompleteHeader: {
        alignItems: 'center', marginBottom: 20,
    },
    seriesCompleteBadge: {
        width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,215,0,0.15)',
        justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    },
    seriesCompleteTitle: {
        color: COLORS.text, fontSize: 18, fontWeight: '700', textAlign: 'center', lineHeight: 24,
    },
    seriesCompleteMeta: {
        marginTop: 8, paddingHorizontal: 14, paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    },
    seriesCompleteMetaText: {
        color: COLORS.textMuted, fontSize: 13,
    },
    suggestionsTitle: {
        color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 12,
    },
    suggestionCard: {
        width: 110, marginRight: 12,
    },
    suggestionPoster: {
        width: 110, height: 155, borderRadius: 10, backgroundColor: COLORS.surface,
    },
    suggestionDramaTitle: {
        color: COLORS.text, fontSize: 12, fontWeight: '600', marginTop: 6, lineHeight: 16,
    },
    suggestionCategory: {
        color: COLORS.textMuted, fontSize: 11, marginTop: 2,
    },
    seriesCompleteCloseBtn: {
        alignItems: 'center', paddingVertical: 14, marginTop: 16,
        backgroundColor: COLORS.primary, borderRadius: 12,
    },
    seriesCompleteCloseBtnText: {
        color: '#fff', fontSize: 15, fontWeight: '700',
    },
});
