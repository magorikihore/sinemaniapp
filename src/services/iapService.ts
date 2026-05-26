import {
    initConnection,
    endConnection,
    fetchProducts,
    requestPurchase,
    purchaseUpdatedListener,
    purchaseErrorListener,
    finishTransaction,
    ErrorCode,
    type Purchase,
    type PurchaseError,
    type Product,
} from 'react-native-iap';
import { Platform } from 'react-native';
import api from './api';

/**
 * IAP service for Google Play / Apple consumable coin purchases.
 */
class IapService {
    private isInitialised = false;
    private purchaseSub: { remove: () => void } | null = null;
    private errorSub: { remove: () => void } | null = null;
    private onCreditedHandler: ((coinBalance: number) => void) | null = null;
    private onErrorHandler: ((message: string) => void) | null = null;

    async init(): Promise<void> {
        if (Platform.OS !== 'ios') return;
        if (this.isInitialised) return;
        try {
            await initConnection();
            this.isInitialised = true;
            this.attachListeners();
        } catch (e: any) {
            console.warn('[IAP] init failed', e?.message ?? e);
            throw e;
        }
    }

    async shutdown(): Promise<void> {
        if (Platform.OS !== 'ios') return;
        this.purchaseSub?.remove();
        this.errorSub?.remove();
        this.purchaseSub = null;
        this.errorSub = null;
        if (this.isInitialised) {
            await endConnection().catch(() => {});
            this.isInitialised = false;
        }
    }

    onCredited(handler: (coinBalance: number) => void) {
        this.onCreditedHandler = handler;
    }

    onError(handler: (message: string) => void) {
        this.onErrorHandler = handler;
    }

    async fetchCoinProducts(skus: string[]): Promise<Product[]> {
        if (Platform.OS !== 'ios') return [];
        if (!this.isInitialised) await this.init();
        if (!skus.length) return [];
        try {
            const result = await fetchProducts({ skus, type: 'in-app' });
            return (result ?? []) as Product[];
        } catch (e: any) {
            console.warn('[IAP] fetchProducts failed', e?.message ?? e);
            return [];
        }
    }

    async buyCoins(sku: string): Promise<void> {
        if (Platform.OS !== 'ios') {
            throw new Error('Store purchase is iOS only. Use M-Pesa on Android.');
        }
        if (!this.isInitialised) await this.init();
        await requestPurchase({
            request: {
                ios: { sku },
            },
            type: 'in-app',
        });
    }

    private attachListeners() {
        this.purchaseSub = purchaseUpdatedListener(async (purchase: Purchase) => {
            try {
                const provider = 'apple';
                const receipt = purchase.purchaseToken ?? '';
                const productId =
                    (purchase as any).productId ?? (purchase.ids?.[0] ?? '');
                const transactionId = purchase.transactionId ?? purchase.id;

                if (!receipt || !productId) {
                    throw new Error('Missing receipt or productId');
                }

                const res = await api.post('/v1/coins/verify-iap', {
                    provider,
                    product_id: productId,
                    receipt,
                    transaction_id: transactionId,
                });

                const coinBalance = res.data?.data?.coin_balance ?? 0;

                // Consumables: finish + consume so they can be bought again.
                await finishTransaction({ purchase, isConsumable: true });

                this.onCreditedHandler?.(coinBalance);
            } catch (e: any) {
                const msg =
                    e?.response?.data?.message ??
                    e?.message ??
                    'Purchase verification failed';
                console.warn('[IAP] verify failed', msg);
                this.onErrorHandler?.(msg);
                // Do NOT finishTransaction on server failure — retry next launch.
            }
        });

        this.errorSub = purchaseErrorListener((error: PurchaseError) => {
            if (error.code === ErrorCode.UserCancelled) return;
            console.warn('[IAP] purchase error', error);
            this.onErrorHandler?.(error.message ?? 'Purchase failed');
        });
    }
}

export const iapService = new IapService();
