import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/config';

// Screens
import DiscoverScreen from '../screens/home/DiscoverScreen';
import ShortsScreen from '../screens/browse/ShortsScreen';
import MyListScreen from '../screens/profile/MyListScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import DramaDetailScreen from '../screens/drama/DramaDetailScreen';
import EpisodePlayerScreen from '../screens/drama/EpisodePlayerScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import WatchHistoryScreen from '../screens/profile/WatchHistoryScreen';
import NotificationsScreen from '../screens/profile/NotificationsScreen';
import DailyRewardScreen from '../screens/profile/DailyRewardScreen';
import SubscriptionScreen from '../screens/payment/SubscriptionScreen';
import CoinStoreScreen from '../screens/payment/CoinStoreScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import DownloadsScreen from '../screens/profile/DownloadsScreen';
import ReferralScreen from '../screens/profile/ReferralScreen';

export type RootStackParamList = {
    MainTabs: undefined;
    DramaDetail: { dramaId: number };
    EpisodePlayer: { dramaId: number; episodeId?: number; resumePositionMs?: number };
    Login: undefined;
    Register: undefined;
    ForgotPassword: { email?: string } | undefined;
    Settings: undefined;
    WatchHistory: undefined;
    Downloads: undefined;
    Notifications: undefined;
    DailyReward: undefined;
    Subscription: undefined;
    CoinStore: undefined;
    Referral: undefined;
    Payment: { type: 'subscription' | 'coins'; planId?: number; packageId?: number; amount: number; title: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { focused: string; default: string }> = {
    Discover: { focused: 'compass', default: 'compass-outline' },
    Shorts: { focused: 'play-circle', default: 'play-circle-outline' },
    MyList: { focused: 'bookmark', default: 'bookmark-outline' },
    Profile: { focused: 'person-circle', default: 'person-circle-outline' },
};

function MainTabs() {
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 28 : 24);
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    const icons = TAB_ICONS[route.name] || TAB_ICONS.Discover;
                    const iconName = focused ? icons.focused : icons.default;
                    return <Ionicons name={iconName as any} size={28} color={color} />;
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarStyle: {
                    backgroundColor: '#111111',
                    borderTopColor: '#1A1A1A',
                    borderTopWidth: 0.5,
                    height: 62 + bottomPadding,
                    paddingBottom: bottomPadding,
                    paddingTop: 6,
                    elevation: 0,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600' as const,
                    marginTop: 2,
                },
            })}
        >
            <Tab.Screen name="Discover" component={DiscoverScreen} />
            <Tab.Screen name="Shorts" component={ShortsScreen} />
            <Tab.Screen name="MyList" component={MyListScreen} options={{ title: 'My List' }} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

const screenOptions = {
    headerStyle: { backgroundColor: COLORS.background },
    headerTintColor: COLORS.text,
    headerTitleStyle: { fontWeight: '600' as const },
    contentStyle: { backgroundColor: COLORS.background },
};

export function AppNavigator() {
    return (
        <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="DramaDetail" component={DramaDetailScreen} />
            <Stack.Screen
                name="EpisodePlayer"
                component={EpisodePlayerScreen}
                options={{
                    orientation: 'portrait',
                    animation: 'slide_from_bottom',
                    gestureEnabled: false,
                    statusBarHidden: true,
                    navigationBarHidden: true,
                } as any}
            />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: 'Login', presentation: 'modal' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: 'Create Account', presentation: 'modal' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: true, title: 'Reset Password', presentation: 'modal' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings' }} />
            <Stack.Screen name="WatchHistory" component={WatchHistoryScreen} options={{ headerShown: true, title: 'Watch History' }} />
            <Stack.Screen name="Downloads" component={DownloadsScreen} options={{ headerShown: true, title: 'Downloads' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, title: 'Notifications' }} />
            <Stack.Screen name="DailyReward" component={DailyRewardScreen} options={{ headerShown: true, title: 'Daily Reward' }} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ headerShown: true, title: 'VIP Plans' }} />
            <Stack.Screen name="CoinStore" component={CoinStoreScreen} options={{ headerShown: true, title: 'Coin Store' }} />
            <Stack.Screen name="Payment" component={PaymentScreen} options={{ headerShown: true, title: 'Payment' }} />
            <Stack.Screen name="Referral" component={ReferralScreen} options={{ headerShown: true, title: 'Invite Friends' }} />
        </Stack.Navigator>
    );
}
