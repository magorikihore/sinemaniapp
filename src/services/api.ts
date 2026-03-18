import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { showAlert } from '../components/AppAlert';
import { storage } from '../utils/storage';
import { API_BASE_URL } from '../constants/config';

// Cooldown to prevent multiple network error popups from parallel requests
let _lastNetworkAlertTime = 0;
const NETWORK_ALERT_COOLDOWN = 5000; // 5 seconds

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Request interceptor — attach auth token
api.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        const token = await storage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — handle 401 and network errors
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        if (error.response?.status === 401) {
            await storage.deleteItem('auth_token');
            await storage.deleteItem('user');
        }

        // Network error (no internet, DNS failure, timeout)
        const now = Date.now();
        if (!error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK')) {
            if (now - _lastNetworkAlertTime > NETWORK_ALERT_COOLDOWN) {
                _lastNetworkAlertTime = now;
                showAlert(
                    'No Internet Connection',
                    'Please check your internet connection and try again. Make sure you are connected to Wi-Fi or mobile data.',
                    [{ text: 'OK' }],
                    'error',
                );
            }
        } else if (error.code === 'ECONNABORTED') {
            if (now - _lastNetworkAlertTime > NETWORK_ALERT_COOLDOWN) {
                _lastNetworkAlertTime = now;
                showAlert(
                    'Connection Timeout',
                    'The server is taking too long to respond. Please check your internet connection and try again.',
                    [{ text: 'OK' }],
                    'warning',
                );
            }
        }

        return Promise.reject(error);
    }
);

export default api;
