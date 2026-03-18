import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, STORAGE_URL } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { useAuthStore } from '../../store/authStore';
import {
    coinService, subscriptionService, notificationService,
} from '../../services/contentService';

interface Props {
    navigation: any;
}

export default function ProfileScreen({ navigation }: Props) {
    const { user, isLoggedIn, isGuest, logout, refreshUser } = useAuthStore();
    const [coinBalance, setCoinBalance] = useState(0);
    const [subscription, setSubscription] = useState<any>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (!isLoggedIn) return;
        setLoading(true);
        try {
            await refreshUser();
            const [coinRes, subRes, notifRes] = await Promise.all([
                coinService.getBalance().catch(() => ({ data: { balance: 0 } })),
                subscriptionService.getCurrent().catch(() => ({ data: null })),
                notificationService.getUnreadCount().catch(() => ({ data: { count: 0 } })),
            ]);
            setCoinBalance(coinRes.data?.balance || 0);
            setSubscription(subRes.data);
            setUnreadCount(notifRes.data?.count || 0);
        } catch { } finally {
            setLoading(false);
        }
    }, [isLoggedIn]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    // Refresh profile data when screen gains focus (e.g. after payment)
    useFocusEffect(useCallback(() => {
        if (!isLoggedIn) return;
        refreshUser();
        Promise.all([
            coinService.getBalance().catch(() => ({ data: { balance: 0 } })),
            subscriptionService.getCurrent().catch(() => ({ data: null })),
            notificationService.getUnreadCount().catch(() => ({ data: { count: 0 } })),
        ]).then(([coinRes, subRes, notifRes]) => {
            setCoinBalance(coinRes.data?.balance || 0);
            setSubscription(subRes.data);
            setUnreadCount(notifRes.data?.count || 0);
        });
    }, [isLoggedIn]));

    const handleLogout = () => {
        showAlert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => logout() },
        ]);
    };

    return (
        <ScrollView style={styles.container}>
            {/* User Header */}
            <View style={styles.header}>
                <View style={styles.avatar}>
                    {user?.avatar ? (
                        <Image source={{ uri: `${STORAGE_URL}/${user.avatar}` }} style={styles.avatarImg} contentFit="cover" />
                    ) : (
                        <Ionicons name="person" size={36} color={COLORS.textMuted} />
                    )}
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.name}>{isGuest ? 'Guest Viewer' : (user?.name || 'User')}</Text>
                    <Text style={styles.email}>
                        {isGuest ? 'Sign in to sync your data' : (user?.email || '')}
                    </Text>
                </View>
                {isGuest && (
                    <TouchableOpacity
                        style={styles.signInBtn}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <Text style={styles.signInText}>Sign In</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('CoinStore')}>
                    <Ionicons name="wallet" size={24} color={COLORS.secondary} />
                    <Text style={styles.statValue}>{coinBalance}</Text>
                    <Text style={styles.statLabel}>Coins</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Subscription')}>
                    <Ionicons name="diamond" size={24} color="#9333EA" />
                    <Text style={styles.statValue}>{subscription?.plan?.name || 'Free'}</Text>
                    <Text style={styles.statLabel}>{subscription ? 'VIP Active' : 'Plan'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Notifications')}>
                    <View>
                        <Ionicons name="notifications" size={24} color={COLORS.info} />
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.statValue}>{unreadCount}</Text>
                    <Text style={styles.statLabel}>Notifs</Text>
                </TouchableOpacity>
            </View>

            {/* Menu Sections */}
            <View style={styles.menuSection}>
                <Text style={styles.sectionTitle}>Content</Text>
                <MenuItem
                    icon="time-outline"
                    label="Watch History"
                    onPress={() => navigation.navigate('WatchHistory')}
                />
                <MenuItem
                    icon="download-outline"
                    label="Downloads"
                    subtitle="Watch offline"
                    onPress={() => navigation.navigate('Downloads')}
                />
                <MenuItem
                    icon="gift-outline"
                    label="Daily Reward"
                    subtitle="Claim free coins daily"
                    onPress={() => navigation.navigate('DailyReward')}
                />
            </View>

            <View style={styles.menuSection}>
                <Text style={styles.sectionTitle}>Premium</Text>
                <MenuItem
                    icon="diamond-outline"
                    label="VIP Subscription"
                    subtitle={subscription ? `Active until ${new Date(subscription.ends_at).toLocaleDateString()}` : 'Unlock all episodes'}
                    onPress={() => navigation.navigate('Subscription')}
                    accent="#9333EA"
                />
                <MenuItem
                    icon="wallet-outline"
                    label="Coin Store"
                    subtitle={`Balance: ${coinBalance} coins`}
                    onPress={() => navigation.navigate('CoinStore')}
                    accent={COLORS.secondary}
                />
            </View>

            <View style={styles.menuSection}>
                <Text style={styles.sectionTitle}>Account</Text>
                {isGuest ? (
                    <>
                        <MenuItem
                            icon="log-in-outline"
                            label="Sign In"
                            subtitle="Login with your account"
                            onPress={() => navigation.navigate('Login')}
                            accent={COLORS.primary}
                        />
                        <MenuItem
                            icon="person-add-outline"
                            label="Create Account"
                            subtitle="Register a new account"
                            onPress={() => navigation.navigate('Register')}
                            accent={COLORS.success}
                        />
                    </>
                ) : (
                    <>
                        <MenuItem
                            icon="settings-outline"
                            label="Settings"
                            onPress={() => navigation.navigate('Settings')}
                        />
                        <MenuItem
                            icon="log-out-outline"
                            label="Logout"
                            onPress={handleLogout}
                            accent={COLORS.primary}
                        />
                    </>
                )}
            </View>

            <View style={styles.menuSection}>
                <Text style={styles.sectionTitle}>About</Text>
                <MenuItem
                    icon="information-circle-outline"
                    label="App Version"
                    subtitle="1.0.0"
                    disabled
                />
                <MenuItem
                    icon="shield-checkmark-outline"
                    label="Privacy Policy"
                    disabled
                />
                <MenuItem
                    icon="document-text-outline"
                    label="Terms of Service"
                    disabled
                />
            </View>

            <View style={{ height: 120 }} />
        </ScrollView>
    );
}

function MenuItem({ icon, label, subtitle, onPress, accent, disabled }: {
    icon: string;
    label: string;
    subtitle?: string;
    onPress?: () => void;
    accent?: string;
    disabled?: boolean;
}) {
    return (
        <TouchableOpacity
            style={styles.menuItem}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
        >
            <View style={[styles.menuIconWrap, accent ? { backgroundColor: accent + '18' } : {}]}>
                <Ionicons name={icon as any} size={20} color={accent || COLORS.textSecondary} />
            </View>
            <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{label}</Text>
                {subtitle && <Text style={styles.menuSub}>{subtitle}</Text>}
            </View>
            {!disabled && <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        gap: 14,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: COLORS.border,
    },
    avatarImg: { width: 60, height: 60 },
    userInfo: { flex: 1 },
    name: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
    email: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
    signInBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    signInText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    // Stats
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.md,
        gap: 10,
        marginBottom: SPACING.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    statValue: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
    statLabel: { color: COLORS.textMuted, fontSize: 11 },
    badge: {
        position: 'absolute', top: -4, right: -6,
        backgroundColor: COLORS.primary, borderRadius: 8,
        minWidth: 16, height: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

    // Menu Section
    menuSection: {
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sectionTitle: {
        color: COLORS.textMuted,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 6,
    },

    // Menu Item
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: 16,
        gap: 12,
    },
    menuIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: COLORS.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContent: { flex: 1 },
    menuLabel: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
    menuSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
});
