import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../../constants/config';
import { coinService } from '../../services/contentService';
import { CoinPackage } from '../../types';

interface Props {
    navigation: any;
}

export default function CoinStoreScreen({ navigation }: Props) {
    const [packages, setPackages] = useState<CoinPackage[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(() => {
        Promise.all([
            coinService.getPackages().catch(() => ({ data: [] as any })),
            coinService.getBalance().catch(() => ({ data: { balance: 0 } })),
        ]).then(([pkgRes, balRes]) => {
            setPackages(pkgRes.data?.data || pkgRes.data || []);
            setBalance(balRes.data?.balance || 0);
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Refresh balance every time screen comes into focus (e.g. after payment)
    useFocusEffect(useCallback(() => {
        coinService.getBalance().catch(() => ({ data: { balance: 0 } }))
            .then(res => setBalance(res.data?.balance || 0));
    }, []));

    const buyPackage = (pkg: CoinPackage) => {
        navigation.navigate('Payment', {
            type: 'coins',
            packageId: pkg.id,
            amount: pkg.price,
            title: `${pkg.coins} Coins`,
        });
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <View style={styles.container}>
            {/* Balance */}
            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Your Balance</Text>
                <Text style={styles.balanceValue}>🪙 {balance}</Text>
            </View>

            <Text style={styles.heading}>Buy Coins</Text>

            <FlatList
                data={packages}
                numColumns={2}
                keyExtractor={(p) => String(p.id)}
                contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 100 }}
                columnWrapperStyle={{ gap: SPACING.sm }}
                renderItem={({ item: pkg }) => (
                    <TouchableOpacity style={styles.pkgCard} onPress={() => buyPackage(pkg)}>
                        <Text style={styles.coinAmount}>🪙 {pkg.coins}</Text>
                        {pkg.bonus_coins ? <Text style={styles.bonus}>+{pkg.bonus_coins} bonus</Text> : null}
                        <Text style={styles.price}>TZS {Number(pkg.price).toLocaleString()}</Text>
                        {pkg.is_popular && <Text style={styles.popularTag}>BEST VALUE</Text>}
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    balanceCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: SPACING.lg, margin: SPACING.md, alignItems: 'center' },
    balanceLabel: { color: COLORS.textSecondary, fontSize: 13 },
    balanceValue: { color: COLORS.coin, fontSize: 32, fontWeight: '700', marginTop: 4 },
    heading: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginLeft: SPACING.md, marginBottom: SPACING.sm },
    pkgCard: {
        flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: SPACING.md,
        alignItems: 'center', marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
    },
    coinAmount: { fontSize: 24, fontWeight: '700', color: COLORS.coin },
    bonus: { color: COLORS.success, fontSize: 12, fontWeight: '600', marginTop: 2 },
    price: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginTop: SPACING.sm },
    popularTag: { backgroundColor: COLORS.primary, color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: SPACING.xs, overflow: 'hidden' },
});
