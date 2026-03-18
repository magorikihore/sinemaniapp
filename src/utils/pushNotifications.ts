import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '../services/api';

// Configure notification handler (show notification even when app is foregrounded)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Register for push notifications and send token to backend.
 */
export async function registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
    }

    // Get the Expo push token
    try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '825840c1-fbe2-4b0f-9584-4c9e1b44e202',
        });
        const token = tokenData.data;

        // Send token to backend
        try {
            await api.put('/v1/auth/push-token', { push_token: token });
        } catch (err) {
            console.log('Failed to send push token to server', err);
        }

        return token;
    } catch (err) {
        console.log('Failed to get push token', err);
        return null;
    }
}

/**
 * Set up notification channel for Android.
 */
export async function setupNotificationChannel(): Promise<void> {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Sinemani',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#E50914',
            sound: 'default',
        });
    }
}
