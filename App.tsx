import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

// ─── Global font scale: bump every fontSize/lineHeight by 15% for better readability ───
const FONT_SCALE = 1.15;
const __origCreate = StyleSheet.create;
(StyleSheet as any).create = (styles: any) => {
    const out: any = {};
    for (const key of Object.keys(styles)) {
        const s = { ...styles[key] };
        if (typeof s.fontSize === 'number') s.fontSize = Math.round(s.fontSize * FONT_SCALE);
        if (typeof s.lineHeight === 'number') s.lineHeight = Math.round(s.lineHeight * FONT_SCALE);
        out[key] = s;
    }
    return __origCreate(out);
};
// Default Text size if no style provided
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.style = [{ fontSize: Math.round(14 * FONT_SCALE) }, ((Text as any).defaultProps.style)];
import { NavigationContainer, DefaultTheme, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { AppNavigator } from './src/navigation/AppNavigator';
import AppAlert from './src/components/AppAlert';
import PromoPopup from './src/components/PromoPopup';
import { useAuthStore } from './src/store/authStore';
import { COLORS } from './src/constants/config';
import { registerForPushNotifications, setupNotificationChannel } from './src/utils/pushNotifications';

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.primary,
  },
};

export default function App() {
  const { isLoading, checkAuth, isLoggedIn } = useAuthStore();
  const [ready, setReady] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    checkAuth().finally(() => setReady(true));
  }, []);

  // Set up push notifications after auth is ready
  useEffect(() => {
    if (!ready || !isLoggedIn) return;
    setupNotificationChannel();
    registerForPushNotifications();
  }, [ready, isLoggedIn]);

  // Handle notification taps (navigate to relevant screen)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!navigationRef.current) return;

      if (data?.type === 'new_episode' && data?.drama_id) {
        navigationRef.current.navigate('DramaDetail', { dramaId: Number(data.drama_id) });
      } else if (data?.type === 'daily_reward') {
        navigationRef.current.navigate('DailyReward');
      } else if (data?.type === 'promo') {
        if (data?.action_value) {
          navigationRef.current.navigate('DramaDetail', { dramaId: Number(data.action_value) });
        }
      }
    });

    return () => sub.remove();
  }, []);

  if (!ready || isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={DarkTheme} ref={navigationRef}>
          <StatusBar style="light" />
          <AppNavigator />
          <AppAlert />
          <PromoPopup navigation={navigationRef.current} />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
