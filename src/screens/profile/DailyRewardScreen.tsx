import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { coinService } from '../../services/contentService';

export default function DailyRewardScreen({ navigation }: { navigation: any }) {
    const [info, setInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);

    useEffect(() => {
        coinService.getDailyRewardInfo()
            .then((r) => setInfo(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const claimReward = async () => {
        setClaiming(true);
        try {
            const res = await coinService.claimDailyReward();
            showAlert('Reward Claimed!', res.data?.message || `You received coins!`, undefined, 'success');
            setInfo((prev: any) => prev ? { ...prev, can_claim: false } : prev);
        } catch (err: any) {
            showAlert('Error', err.response?.data?.message || 'Could not claim reward');
        } finally {
            setClaiming(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <View style={styles.container}>
            <Text style={styles.icon}>🎁</Text>
            <Text style={styles.title}>Daily Reward</Text>
            <Text style={styles.desc}>Claim your daily coins reward every day!</Text>

            {info?.streak && (
                <View style={styles.streakBox}>
                    <Text style={styles.streakText}>🔥 {info.streak} day streak!</Text>
                </View>
            )}

            <TouchableOpacity
                style={[styles.claimBtn, !info?.can_claim && styles.claimBtnDisabled]}
                onPress={claimReward}
                disabled={!info?.can_claim || claiming}
            >
                {claiming ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.claimBtnText}>
                        {info?.can_claim ? '🪙 Claim Reward' : '✅ Already Claimed Today'}
                    </Text>
                )}
            </TouchableOpacity>

            {info?.next_claim_at && !info.can_claim && (
                <Text style={styles.nextText}>Next reward available tomorrow</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.lg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    icon: { fontSize: 72 },
    title: { color: COLORS.text, fontSize: 26, fontWeight: '700', marginTop: SPACING.md },
    desc: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', marginTop: SPACING.sm },
    streakBox: { backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: SPACING.lg },
    streakText: { color: COLORS.coin, fontSize: 18, fontWeight: '700' },
    claimBtn: { backgroundColor: COLORS.coin, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 40, marginTop: SPACING.xl },
    claimBtnDisabled: { backgroundColor: COLORS.surfaceLight },
    claimBtnText: { color: '#000', fontSize: 17, fontWeight: '700' },
    nextText: { color: COLORS.textMuted, fontSize: 13, marginTop: SPACING.md },
});
