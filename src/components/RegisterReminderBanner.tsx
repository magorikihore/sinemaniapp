import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../constants/config';
import { useAuthStore } from '../store/authStore';

interface Props {
    /** Compact pill style for inside scrollable lists */
    compact?: boolean;
    /** Override the bonus number shown */
    bonusCoins?: number;
}

/**
 * Banner shown to guest users prompting them to register.
 * Hides itself entirely if the user is logged in (not a guest).
 */
export default function RegisterReminderBanner({ compact = false, bonusCoins = 100 }: Props) {
    const { isGuest, isLoggedIn } = useAuthStore();
    const navigation = useNavigation<any>();

    if (!isLoggedIn || !isGuest) return null;

    if (compact) {
        return (
            <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.compactBox}>
                <Ionicons name="gift" size={18} color={COLORS.secondary} />
                <Text style={styles.compactText}>Sign up & get <Text style={styles.compactBold}>+{bonusCoins} coins</Text></Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.text} />
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.box}>
            <View style={styles.iconWrap}>
                <Ionicons name="gift-outline" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title}>Save your progress</Text>
                <Text style={styles.subtitle}>Create an account to keep your coins, watchlist & history. Get <Text style={styles.bonus}>+{bonusCoins} bonus coins</Text> on signup.</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.btn}>
                <Text style={styles.btnText}>Sign Up</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    box: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1F0E14',
        borderRadius: 14,
        padding: 12,
        marginHorizontal: 12,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: COLORS.primary + '55',
    },
    iconWrap: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    title: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
    subtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
    bonus: { color: COLORS.secondary, fontWeight: '700' },
    btn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    compactBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#1F0E14',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginHorizontal: 12,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: COLORS.primary + '55',
        alignSelf: 'flex-start',
    },
    compactText: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
    compactBold: { color: COLORS.secondary, fontWeight: '700' },
});
