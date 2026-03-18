import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal,
    Animated, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/config';
import { storage } from '../utils/storage';
import api from '../services/api';

interface Promotion {
    id: number;
    title: string;
    description: string | null;
    image: string | null;
    action_type: string;
    action_value: string | null;
    button_text: string;
    show_once_per_day: boolean;
}

interface Props {
    navigation: any;
}

const { width } = Dimensions.get('window');

export default function PromoPopup({ navigation }: Props) {
    const [promo, setPromo] = useState<Promotion | null>(null);
    const [visible, setVisible] = useState(false);
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        checkAndShowPromo();
    }, []);

    const checkAndShowPromo = async () => {
        try {
            const res = await api.get('/v1/promotions/popup');
            const data = res.data?.data;
            if (!data) return;

            // Check if already dismissed today
            if (data.show_once_per_day) {
                const key = `promo_dismissed_${data.id}`;
                const dismissed = await storage.getItem(key);
                if (dismissed === new Date().toDateString()) {
                    return;
                }
            }

            setPromo(data);
            setVisible(true);

            // Animate in
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }).start();
        } catch {
            // Silently fail — don't bother user
        }
    };

    const dismiss = async () => {
        if (promo?.show_once_per_day) {
            await storage.setItem(`promo_dismissed_${promo.id}`, new Date().toDateString());
        }

        Animated.timing(scaleAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setVisible(false);
            setPromo(null);
        });
    };

    const handleAction = async () => {
        dismiss();

        if (!promo) return;

        // Small delay to let modal close
        setTimeout(() => {
            switch (promo.action_type) {
                case 'subscription':
                    navigation.navigate('Subscription');
                    break;
                case 'coin_store':
                    navigation.navigate('CoinStore');
                    break;
                case 'drama':
                    if (promo.action_value) {
                        navigation.navigate('DramaDetail', { dramaId: Number(promo.action_value) });
                    }
                    break;
                case 'daily_reward':
                    navigation.navigate('DailyReward');
                    break;
                case 'url':
                    // Could open in-app browser
                    break;
            }
        }, 300);
    };

    if (!visible || !promo) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={dismiss}>
            <View style={styles.overlay}>
                <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
                        <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
                    </TouchableOpacity>

                    {/* Image */}
                    {promo.image && (
                        <Image
                            source={{ uri: promo.image }}
                            style={styles.image}
                            contentFit="cover"
                        />
                    )}

                    {/* Content */}
                    <View style={styles.content}>
                        <Text style={styles.title}>{promo.title}</Text>
                        {promo.description && (
                            <Text style={styles.description}>{promo.description}</Text>
                        )}

                        {/* Action button */}
                        <TouchableOpacity style={styles.actionBtn} onPress={handleAction}>
                            <Text style={styles.actionBtnText}>{promo.button_text}</Text>
                        </TouchableOpacity>

                        {/* Dismiss text */}
                        <TouchableOpacity onPress={dismiss}>
                            <Text style={styles.dismissText}>Not now</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        width: width - 48,
        maxWidth: 380,
        overflow: 'hidden',
    },
    closeBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 10,
    },
    image: {
        width: '100%',
        height: 180,
    },
    content: {
        padding: SPACING.lg,
        alignItems: 'center',
    },
    title: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    description: {
        color: COLORS.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        marginTop: SPACING.sm,
        lineHeight: 21,
    },
    actionBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 32,
        marginTop: SPACING.lg,
        width: '100%',
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    dismissText: {
        color: COLORS.textMuted,
        fontSize: 13,
        marginTop: SPACING.md,
    },
});
