import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ActivityIndicator, ScrollView, Animated,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { COLORS, SPACING } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { paymentService } from '../../services/contentService';
import { useAuthStore } from '../../store/authStore';

// Auto-detect operator from phone number prefix
function detectOperator(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    const prefix = cleaned.startsWith('255') ? cleaned.substring(3, 5) : cleaned.substring(1, 3);
    if (['71', '65', '67'].includes(prefix)) return 'Tigo';
    if (['74', '75', '76'].includes(prefix)) return 'Vodacom';
    if (['78', '68'].includes(prefix)) return 'Airtel';
    if (['77', '62'].includes(prefix)) return 'Halotel';
    return 'Unknown';
}

interface Props {
    navigation: any;
    route: { params: { type: 'subscription' | 'coins'; planId?: number; packageId?: number; amount: number; title: string } };
}

export default function PaymentScreen({ navigation, route }: Props) {
    const { type, planId, packageId, amount, title } = route.params;
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

    const [phone, setPhone] = useState('');
    const [operator, setOperator] = useState('');
    const [processing, setProcessing] = useState(false);
    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const [autoPolling, setAutoPolling] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const isMounted = useRef(true);

    // Max auto-poll attempts (3 sec interval × 10 = 30 seconds of auto-checking)
    const MAX_POLLS = 10;
    const POLL_INTERVAL = 3000;

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (pollTimer.current) clearTimeout(pollTimer.current);
            if (countdownTimer.current) clearInterval(countdownTimer.current);
        };
    }, []);

    // Pulse animation for the waiting indicator
    useEffect(() => {
        if (!autoPolling) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [autoPolling, pulseAnim]);

    useEffect(() => {
        setOperator(detectOperator(phone));
    }, [phone]);

    // Auto-poll logic: poll the server every 3 seconds after payment is initiated
    const pollStatus = useCallback(async (ref: string, attempt: number) => {
        if (!isMounted.current) return;
        setPollCount(attempt);
        setCountdown(Math.ceil(POLL_INTERVAL / 1000));

        // Start countdown timer for visual feedback
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        countdownTimer.current = setInterval(() => {
            if (!isMounted.current) return;
            setCountdown(c => {
                if (c <= 1) {
                    if (countdownTimer.current) clearInterval(countdownTimer.current);
                    return 0;
                }
                return c - 1;
            });
        }, 1000);

        try {
            const res = await paymentService.checkStatus(ref);
            if (!isMounted.current) return;
            const status = res.data?.status;

            if (status === 'completed' || status === 'success') {
                setAutoPolling(false);
                if (countdownTimer.current) clearInterval(countdownTimer.current);
                try { await useAuthStore.getState().refreshUser(); } catch {}
                if (type === 'subscription') {
                    showAlert('VIP Activated!', 'Your VIP subscription is now active. Enjoy unlimited access to all episodes!', [
                        { text: 'Go to Profile', onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Discover' }, { name: 'Shorts' }, { name: 'MyList' }, { name: 'Profile' }], index: 3 } }] })) },
                    ], 'success');
                } else {
                    showAlert('Coins Added!', 'Your coins have been added to your account. Happy watching!', [
                        { text: 'OK', onPress: () => navigation.goBack() },
                    ], 'success');
                }
                return;
            }

            if (status === 'failed') {
                setAutoPolling(false);
                if (countdownTimer.current) clearInterval(countdownTimer.current);
                showAlert('Payment Failed', 'The payment was not completed. Please try again.');
                setPaymentId(null);
                return;
            }

            // Still pending — schedule next poll or stop auto-polling
            if (attempt < MAX_POLLS) {
                pollTimer.current = setTimeout(() => {
                    pollStatus(ref, attempt + 1);
                }, POLL_INTERVAL);
            } else {
                // Stop auto-polling, let user manually check
                setAutoPolling(false);
                if (countdownTimer.current) clearInterval(countdownTimer.current);
            }
        } catch {
            // Network error during poll — keep trying unless max reached
            if (attempt < MAX_POLLS) {
                pollTimer.current = setTimeout(() => {
                    pollStatus(ref, attempt + 1);
                }, POLL_INTERVAL);
            } else {
                setAutoPolling(false);
                if (countdownTimer.current) clearInterval(countdownTimer.current);
            }
        }
    }, [navigation]);

    const handlePay = async () => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length < 9) {
            showAlert('Error', 'Please enter a valid phone number');
            return;
        }
        setProcessing(true);
        try {
            let res;
            if (type === 'subscription') {
                if (isLoggedIn) {
                    res = await paymentService.purchaseSubscription({ plan_id: planId!, phone: cleaned });
                } else {
                    res = await paymentService.guestPurchaseSubscription({ plan_id: planId!, phone: cleaned });
                }
            } else {
                if (isLoggedIn) {
                    res = await paymentService.purchaseCoins({ package_id: packageId!, phone: cleaned });
                } else {
                    res = await paymentService.guestPurchaseCoins({ package_id: packageId!, phone: cleaned });
                }
            }
            const ref = res.data?.payment?.reference || res.data?.reference;
            setPaymentId(ref);

            // Start auto-polling immediately
            setAutoPolling(true);
            setPollCount(0);
            // Wait 3 seconds before first poll (give user time to enter PIN)
            pollTimer.current = setTimeout(() => {
                pollStatus(ref, 1);
            }, POLL_INTERVAL);
        } catch (err: any) {
            showAlert('Payment Failed', err.response?.data?.message || 'Could not initiate payment');
        } finally {
            setProcessing(false);
        }
    };

    const checkStatus = async () => {
        if (!paymentId) return;
        setChecking(true);
        try {
            const res = await paymentService.checkStatus(paymentId);
            const status = res.data?.status;
            if (status === 'completed' || status === 'success') {
                try { await useAuthStore.getState().refreshUser(); } catch {}
                if (type === 'subscription') {
                    showAlert('VIP Activated!', 'Your VIP subscription is now active. Enjoy unlimited access to all episodes!', [
                        { text: 'Go to Profile', onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Discover' }, { name: 'Shorts' }, { name: 'MyList' }, { name: 'Profile' }], index: 3 } }] })) },
                    ], 'success');
                } else {
                    showAlert('Coins Added!', 'Your coins have been added to your account. Happy watching!', [
                        { text: 'OK', onPress: () => navigation.goBack() },
                    ], 'success');
                }
            } else if (status === 'failed') {
                showAlert('Payment Failed', 'The payment was not completed. Please try again.');
                setPaymentId(null);
            } else {
                showAlert('Pending', 'Payment is still being processed. Please wait and check again.');
            }
        } catch (err: any) {
            showAlert('Error', err.response?.data?.message || 'Could not check status');
        } finally {
            setChecking(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Purchase Info */}
            <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>{title}</Text>
                <Text style={styles.infoAmount}>TZS {Number(amount).toLocaleString()}</Text>
            </View>

            {!paymentId ? (
                <>
                    {/* Phone Input */}
                    <Text style={styles.label}>Phone Number (Mobile Money)</Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="0712 345 678"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="phone-pad"
                        maxLength={13}
                    />
                    {operator && operator !== 'Unknown' && (
                        <Text style={styles.operatorText}>Operator: {operator}</Text>
                    )}

                    <Text style={styles.note}>
                        You will receive a payment prompt on your phone. Enter your mobile money PIN to complete the payment.
                    </Text>

                    <TouchableOpacity
                        style={[styles.payBtn, processing && styles.payBtnDisabled]}
                        onPress={handlePay}
                        disabled={processing}
                    >
                        {processing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.payBtnText}>Pay TZS {Number(amount).toLocaleString()}</Text>
                        )}
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    {/* Payment Pending */}
                    <View style={styles.pendingBox}>
                        <Animated.Text style={[styles.pendingIcon, { transform: [{ scale: pulseAnim }] }]}>
                            📱
                        </Animated.Text>
                        <Text style={styles.pendingTitle}>Check Your Phone</Text>
                        <Text style={styles.pendingDesc}>
                            A payment prompt has been sent to your phone. Enter your PIN to complete the transaction.
                        </Text>
                    </View>

                    {autoPolling ? (
                        <View style={styles.pollingBox}>
                            <ActivityIndicator size="small" color={COLORS.success} />
                            <Text style={styles.pollingText}>
                                Verifying payment... ({pollCount}/{MAX_POLLS})
                            </Text>
                            {countdown > 0 && (
                                <Text style={styles.countdownText}>
                                    Next check in {countdown}s
                                </Text>
                            )}
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${(pollCount / MAX_POLLS) * 100}%` }]} />
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.checkBtn}
                            onPress={checkStatus}
                            disabled={checking}
                        >
                            {checking ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.checkBtnText}>Check Payment Status</Text>
                            )}
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() => {
                            if (pollTimer.current) clearTimeout(pollTimer.current);
                            if (countdownTimer.current) clearInterval(countdownTimer.current);
                            setAutoPolling(false);
                            setPaymentId(null);
                        }}
                    >
                        <Text style={styles.retryBtnText}>Try Different Number</Text>
                    </TouchableOpacity>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SPACING.md, paddingBottom: 100 },
    // Info
    infoCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.lg },
    infoTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600' },
    infoAmount: { color: COLORS.coin, fontSize: 32, fontWeight: '700', marginTop: SPACING.xs },
    // Form
    label: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 6 },
    input: {
        backgroundColor: COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: SPACING.md,
        paddingVertical: 16, color: COLORS.text, fontSize: 18, borderWidth: 1, borderColor: COLORS.border,
        letterSpacing: 1,
    },
    operatorText: { color: COLORS.success, fontSize: 13, marginTop: 6, fontWeight: '500' },
    note: { color: COLORS.textMuted, fontSize: 13, marginTop: SPACING.md, lineHeight: 20 },
    payBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.lg },
    payBtnDisabled: { opacity: 0.6 },
    payBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    // Pending
    pendingBox: { alignItems: 'center', marginVertical: SPACING.xl },
    pendingIcon: { fontSize: 56 },
    pendingTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: SPACING.md },
    pendingDesc: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22, paddingHorizontal: SPACING.md },
    checkBtn: { backgroundColor: COLORS.success, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
    checkBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    // Auto-polling
    pollingBox: { backgroundColor: COLORS.surface, borderRadius: 14, padding: SPACING.lg, alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.success + '30' },
    pollingText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
    countdownText: { color: COLORS.textMuted, fontSize: 13 },
    progressTrack: { width: '100%', height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginTop: SPACING.xs, overflow: 'hidden' as const },
    progressFill: { height: 4, backgroundColor: COLORS.success, borderRadius: 2 },
    retryBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.md },
    retryBtnText: { color: COLORS.textSecondary, fontSize: 15 },
});
