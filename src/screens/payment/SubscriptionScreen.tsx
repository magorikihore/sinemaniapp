import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { subscriptionService } from '../../services/contentService';
import { SubscriptionPlan } from '../../types';

interface Props {
    navigation: any;
}

export default function SubscriptionScreen({ navigation }: Props) {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [current, setCurrent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<number | null>(null);

    useEffect(() => {
        Promise.all([
            subscriptionService.getPlans().catch(() => ({ data: [] })),
            subscriptionService.getCurrent().catch(() => ({ data: null })),
        ]).then(([plansRes, curRes]) => {
            setPlans(plansRes.data?.data || plansRes.data || []);
            setCurrent(curRes.data);
        }).finally(() => setLoading(false));
    }, []);

    // Refresh current subscription when screen gains focus
    useFocusEffect(useCallback(() => {
        subscriptionService.getCurrent().catch(() => ({ data: null }))
            .then(res => setCurrent(res.data));
    }, []));

    const handleSubscribe = async (plan: SubscriptionPlan) => {
        const isCurrentPlan = current?.plan_id === plan.id;
        if (isCurrentPlan) {
            showAlert(
                'Already Active',
                `You already have an active ${current.plan?.name || 'VIP'} plan until ${new Date(current.ends_at).toLocaleDateString()}.`
            );
            return;
        }
        if (current) {
            showAlert(
                'Switch Plan',
                `You currently have the ${current.plan?.name || 'VIP'} plan. Switching to ${plan.name} will cancel your current plan and start the new one immediately.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Switch Plan',
                        onPress: () => navigation.navigate('Payment', {
                            type: 'subscription',
                            planId: plan.id,
                            amount: plan.price,
                            title: `${plan.name} Subscription`,
                        }),
                    },
                ]
            );
            return;
        }
        navigation.navigate('Payment', {
            type: 'subscription',
            planId: plan.id,
            amount: plan.price,
            title: `${plan.name} Subscription`,
        });
    };

    const handleCancel = () => {
        showAlert('Cancel Subscription', 'Are you sure you want to cancel?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
                    try {
                        await subscriptionService.cancel();
                        setCurrent(null);
                        showAlert('Cancelled', 'Your subscription has been cancelled');
                    } catch (err: any) {
                        showAlert('Error', err.response?.data?.message || 'Could not cancel');
                    }
                },
            },
        ]);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}>
            {/* Current Plan */}
            {current && (
                <View style={styles.currentCard}>
                    <Text style={styles.currentLabel}>Current Plan</Text>
                    <Text style={styles.currentPlan}>{current.plan?.name || 'VIP'}</Text>
                    <Text style={styles.currentMeta}>
                        Expires: {current.ends_at ? new Date(current.ends_at).toLocaleDateString() : 'Active'}
                    </Text>
                    <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                        <Text style={styles.cancelBtnText}>Cancel Subscription</Text>
                    </TouchableOpacity>
                </View>
            )}

            <Text style={styles.heading}>Choose a Plan</Text>
            <Text style={styles.subheading}>Unlock all VIP episodes & ad-free experience</Text>

            {plans.map((plan) => {
                const isActive = current?.plan_id === plan.id;
                return (
                    <TouchableOpacity
                        key={plan.id}
                        style={[styles.planCard, isActive && styles.planActive]}
                        onPress={() => handleSubscribe(plan)}
                    >
                        <View style={styles.planHeader}>
                            <Text style={styles.planName}>{plan.name}</Text>
                            {plan.is_popular && <Text style={styles.popularBadge}>POPULAR</Text>}
                        </View>
                        <Text style={styles.planPrice}>
                            TZS {Number(plan.price).toLocaleString()}
                            <Text style={styles.planPeriod}> / {plan.duration_type || plan.interval}</Text>
                        </Text>
                        {plan.description && <Text style={styles.planDesc}>{plan.description}</Text>}
                        <View style={styles.planFeatures}>
                            <Text style={styles.featureItem}>✓ All VIP episodes</Text>
                            <Text style={styles.featureItem}>✓ Ad-free experience</Text>
                            <Text style={styles.featureItem}>✓ Download for offline</Text>
                            {plan.coin_bonus ? <Text style={styles.featureItem}>✓ 🪙 {plan.coin_bonus} bonus coins</Text> : null}
                        </View>
                        {isActive ? (
                            <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>✓ Active</Text>
                            </View>
                        ) : current ? (
                            <View style={[styles.subscribeBtnInner, { backgroundColor: '#9333EA' }]}>
                                <Text style={styles.subscribeBtnText}>Switch to This Plan</Text>
                            </View>
                        ) : (
                            <View style={styles.subscribeBtnInner}>
                                <Text style={styles.subscribeBtnText}>Subscribe Now</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    // Current
    currentCard: { backgroundColor: COLORS.vip, borderRadius: 14, padding: SPACING.lg, marginBottom: SPACING.lg },
    currentLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
    currentPlan: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 4 },
    currentMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6 },
    cancelBtn: { marginTop: SPACING.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    cancelBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    // Plans
    heading: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
    subheading: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4, marginBottom: SPACING.lg },
    planCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 2, borderColor: 'transparent' },
    planActive: { borderColor: COLORS.vip },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    planName: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
    popularBadge: { backgroundColor: COLORS.primary, color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
    planPrice: { color: COLORS.coin, fontSize: 28, fontWeight: '700', marginTop: SPACING.sm },
    planPeriod: { fontSize: 14, fontWeight: '400', color: COLORS.textSecondary },
    planDesc: { color: COLORS.textSecondary, fontSize: 13, marginTop: SPACING.xs },
    planFeatures: { marginTop: SPACING.md },
    featureItem: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
    activeBadge: { marginTop: SPACING.md, backgroundColor: COLORS.vip, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    activeBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    subscribeBtnInner: { marginTop: SPACING.md, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    subscribeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
