import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    Animated, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/config';

const { width: SCREEN_W } = Dimensions.get('window');

/* ─────────── Types ─────────── */
type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface AlertButton {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
}

interface AlertConfig {
    type?: AlertType;
    title: string;
    message?: string;
    buttons?: AlertButton[];
}

/* ─────────── Global event bus ─────────── */
type Listener = (config: AlertConfig) => void;
let _listener: Listener | null = null;

/** Drop-in replacement for Alert.alert — shows the custom popup */
export function showAlert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type?: AlertType,
) {
    const inferredType = type || inferType(title, message, buttons);
    _listener?.({ type: inferredType, title, message, buttons });
}

function inferType(title: string, message?: string, buttons?: AlertButton[]): AlertType {
    const t = (title + (message || '')).toLowerCase();
    if (buttons?.some(b => b.style === 'destructive')) return 'confirm';
    if (t.includes('success') || t.includes('✅') || t.includes('🎉') || t.includes('updated') || t.includes('changed') || t.includes('saved') || t.includes('cancelled')) return 'success';
    if (t.includes('fail') || t.includes('error') || t.includes('could not') || t.includes('not available') || t.includes('blocked')) return 'error';
    if (t.includes('pending') || t.includes('wait') || t.includes('required') || t.includes('login')) return 'warning';
    return 'info';
}

/* ─────────── Icon & colour per type ─────────── */
const TYPE_CONFIG: Record<AlertType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    success: { icon: 'checkmark-circle', color: COLORS.success },
    error:   { icon: 'close-circle',     color: COLORS.error },
    warning: { icon: 'warning',          color: COLORS.warning },
    info:    { icon: 'information-circle', color: COLORS.info },
    confirm: { icon: 'help-circle',       color: COLORS.warning },
};

/* ─────────── Component ─────────── */
export default function AppAlert() {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertConfig | null>(null);
    const scaleAnim = useState(() => new Animated.Value(0))[0];
    const opacityAnim = useState(() => new Animated.Value(0))[0];

    const show = useCallback((cfg: AlertConfig) => {
        setConfig(cfg);
        setVisible(true);
        scaleAnim.setValue(0.7);
        opacityAnim.setValue(0);
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                damping: 15,
                stiffness: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, [scaleAnim, opacityAnim]);

    const hide = useCallback((onPress?: () => void) => {
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 0.7,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setVisible(false);
            setConfig(null);
            onPress?.();
        });
    }, [scaleAnim, opacityAnim]);

    useEffect(() => {
        _listener = show;
        return () => { _listener = null; };
    }, [show]);

    if (!visible || !config) return null;

    const alertType = config.type || 'info';
    const { icon, color } = TYPE_CONFIG[alertType];
    const buttons = config.buttons?.length
        ? config.buttons
        : [{ text: 'OK', style: 'default' as const }];

    const hasDestructive = buttons.some(b => b.style === 'destructive');
    const hasCancel = buttons.some(b => b.style === 'cancel');

    return (
        <Modal transparent visible animationType="none" statusBarTranslucent>
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={() => {
                    const cancelBtn = buttons.find(b => b.style === 'cancel');
                    hide(cancelBtn?.onPress);
                }}
            >
                <Animated.View
                    style={[
                        styles.card,
                        {
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <TouchableOpacity activeOpacity={1}>
                        {/* Coloured accent strip */}
                        <View style={[styles.accentStrip, { backgroundColor: color }]} />

                        {/* Icon */}
                        <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                            <Ionicons name={icon} size={40} color={color} />
                        </View>

                        {/* Title */}
                        <Text style={styles.title}>{config.title.replace(/^✅\s*|^🎉\s*|^🎁\s*/g, '')}</Text>

                        {/* Message */}
                        {config.message ? (
                            <Text style={styles.message}>{config.message}</Text>
                        ) : null}

                        {/* Buttons */}
                        <View style={[styles.buttonRow, buttons.length === 1 && styles.buttonRowSingle]}>
                            {buttons.map((btn, i) => {
                                const isCancel = btn.style === 'cancel';
                                const isDestructive = btn.style === 'destructive';
                                const isPrimary = !isCancel && !isDestructive && !hasDestructive;

                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={[
                                            styles.button,
                                            buttons.length === 1 && styles.buttonFull,
                                            isCancel && styles.buttonCancel,
                                            isDestructive && styles.buttonDestructive,
                                            isPrimary && styles.buttonPrimary,
                                            (!isCancel && !isDestructive && hasDestructive) && styles.buttonPrimary,
                                        ]}
                                        onPress={() => hide(btn.onPress)}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.buttonText,
                                                isCancel && styles.buttonTextCancel,
                                                isDestructive && styles.buttonTextDestructive,
                                                (isPrimary || (!isCancel && !isDestructive && hasDestructive)) && styles.buttonTextPrimary,
                                            ]}
                                        >
                                            {btn.text}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
}

/* ─────────── Styles ─────────── */
const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
    },
    card: {
        width: Math.min(SCREEN_W - 48, 360),
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 24,
            },
            android: { elevation: 24 },
        }),
    },
    accentStrip: {
        height: 4,
        width: '100%',
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginTop: SPACING.lg,
    },
    title: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: SPACING.md,
        paddingHorizontal: SPACING.lg,
    },
    message: {
        color: COLORS.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        marginTop: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        lineHeight: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: SPACING.lg,
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        gap: SPACING.sm,
    },
    buttonRowSingle: {
        justifyContent: 'center',
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonFull: {
        flex: 0,
        minWidth: '60%',
        alignSelf: 'center',
    },
    buttonPrimary: {
        backgroundColor: COLORS.primary,
    },
    buttonCancel: {
        backgroundColor: COLORS.surfaceLight,
    },
    buttonDestructive: {
        backgroundColor: COLORS.error + '18',
        borderWidth: 1,
        borderColor: COLORS.error + '40',
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '700',
    },
    buttonTextPrimary: {
        color: '#FFFFFF',
    },
    buttonTextCancel: {
        color: COLORS.textSecondary,
    },
    buttonTextDestructive: {
        color: COLORS.error,
    },
});
