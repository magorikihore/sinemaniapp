import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Share, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SPACING } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { referralService } from '../../services/contentService';
import { useAuthStore } from '../../store/authStore';

interface Props { navigation: any; }

interface ReferralData {
    referral_code: string;
    share_link: string;
    share_message: string;
    referral_count: number;
    referral_coins_earned: number;
    reward_per_referral: number;
    signup_bonus: number;
}

export default function ReferralScreen({ navigation }: Props) {
    const { refreshUser, user } = useAuthStore();
    const [data, setData] = useState<ReferralData | null>(null);
    const [loading, setLoading] = useState(true);
    const [code, setCode] = useState('');
    const [applying, setApplying] = useState(false);
    const alreadyApplied = !!(user as any)?.referred_by;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await referralService.getMine();
            setData(res.data);
        } catch (e: any) {
            showAlert({ title: 'Error', message: e?.response?.data?.message || 'Failed to load referral info' });
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const copyCode = async () => {
        if (!data) return;
        await Clipboard.setStringAsync(data.referral_code);
        showAlert({ title: 'Copied!', message: `Code ${data.referral_code} copied to clipboard` });
    };

    const shareInvite = async () => {
        if (!data) return;
        try {
            await Share.share({ message: data.share_message });
        } catch { }
    };

    const submitCode = async () => {
        const c = code.trim().toUpperCase();
        if (!c) return;
        setApplying(true);
        try {
            const res = await referralService.apply(c);
            showAlert({ title: '🎉 Success!', message: res.data?.message || 'Referral applied' });
            setCode('');
            await refreshUser();
            await load();
        } catch (e: any) {
            showAlert({ title: 'Could not apply', message: e?.response?.data?.message || 'Invalid code' });
        } finally { setApplying(false); }
    };

    if (loading || !data) {
        return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Hero */}
            <View style={styles.hero}>
                <Text style={styles.heroEmoji}>🎁</Text>
                <Text style={styles.heroTitle}>Invite & Earn</Text>
                <Text style={styles.heroSubtitle}>
                    Earn <Text style={styles.coinHi}>{data.reward_per_referral} coins</Text> for every friend who joins{'\n'}
                    They get <Text style={styles.coinHi}>{data.signup_bonus} coins</Text> on signup
                </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{data.referral_count}</Text>
                    <Text style={styles.statLabel}>Friends Invited</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: COLORS.secondary }]}>{data.referral_coins_earned}</Text>
                    <Text style={styles.statLabel}>Coins Earned</Text>
                </View>
            </View>

            {/* Code box */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>YOUR REFERRAL CODE</Text>
                <View style={styles.codeBox}>
                    <Text style={styles.code}>{data.referral_code}</Text>
                    <TouchableOpacity onPress={copyCode} style={styles.copyBtn}>
                        <Ionicons name="copy-outline" size={20} color={COLORS.primary} />
                        <Text style={styles.copyText}>Copy</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={shareInvite} style={styles.shareBtn}>
                    <Ionicons name="share-social" size={20} color="#fff" />
                    <Text style={styles.shareText}>Share Invite Link</Text>
                </TouchableOpacity>
            </View>

            {/* Apply code */}
            {alreadyApplied ? (
                <View style={[styles.section, styles.appliedBox]}>
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                    <Text style={styles.appliedText}>You've already used a referral code</Text>
                </View>
            ) : (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>HAVE A CODE FROM A FRIEND?</Text>
                    <View style={styles.applyRow}>
                        <TextInput
                            value={code}
                            onChangeText={(t) => setCode(t.toUpperCase())}
                            placeholder="ENTER CODE"
                            placeholderTextColor={COLORS.textMuted}
                            autoCapitalize="characters"
                            maxLength={12}
                            style={styles.input}
                        />
                        <TouchableOpacity
                            onPress={submitCode}
                            disabled={applying || !code.trim()}
                            style={[styles.applyBtn, (!code.trim() || applying) && { opacity: 0.5 }]}
                        >
                            {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyText}>Apply</Text>}
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.helper}>Codes can be applied within 7 days of creating your account</Text>
                </View>
            )}

            {/* How it works */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
                <Step n="1" title="Share your code" desc="Send your code or invite link to friends" />
                <Step n="2" title="They sign up & enter your code" desc={`They get ${data.signup_bonus} free coins instantly`} />
                <Step n="3" title="You earn coins" desc={`${data.reward_per_referral} coins land in your wallet automatically`} />
            </View>
        </ScrollView>
    );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
    return (
        <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
            <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepDesc}>{desc}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
    hero: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, backgroundColor: '#1A0E14' },
    heroEmoji: { fontSize: 56 },
    heroTitle: { fontSize: 26, fontWeight: '700', color: COLORS.text, marginTop: 6 },
    heroSubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    coinHi: { color: COLORS.secondary, fontWeight: '700' },
    statsRow: { flexDirection: 'row', gap: 12, padding: 16 },
    statCard: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, alignItems: 'center' },
    statValue: { fontSize: 28, fontWeight: '700', color: COLORS.primary },
    statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
    section: { paddingHorizontal: 16, marginTop: 16 },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 10 },
    codeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#2A2A2A', borderStyle: 'dashed' },
    code: { fontSize: 26, fontWeight: '700', color: COLORS.text, letterSpacing: 4 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    copyText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
    shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, marginTop: 12 },
    shareText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    applyRow: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 10, paddingHorizontal: 14, color: COLORS.text, fontSize: 16, fontWeight: '600', letterSpacing: 2, borderWidth: 1, borderColor: '#2A2A2A' },
    applyBtn: { backgroundColor: COLORS.success, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, justifyContent: 'center' },
    applyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    helper: { color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
    appliedBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0E1F14', padding: 14, borderRadius: 12 },
    appliedText: { color: COLORS.success, fontWeight: '600', fontSize: 14 },
    step: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
    stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    stepNumText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    stepTitle: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
    stepDesc: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
});
