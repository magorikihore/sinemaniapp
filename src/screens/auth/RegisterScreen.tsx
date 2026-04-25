import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

interface Props {
    navigation: any;
}

export default function RegisterScreen({ navigation }: Props) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const register = useAuthStore((s) => s.register);
    const socialLogin = useAuthStore((s) => s.socialLogin);

    const handleRegister = async () => {
        if (!name.trim() || !email.trim() || !password.trim()) {
            showAlert('Error', 'Please fill all fields');
            return;
        }
        if (password !== confirmPassword) {
            showAlert('Error', 'Passwords do not match');
            return;
        }
        if (password.length < 8) {
            showAlert('Error', 'Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            const result = await register(name.trim(), email.trim(), password, confirmPassword);
            if (result?.converted && result.bonusCoins > 0) {
                showAlert('Welcome!', `Your account is ready. We kept all your coins & history and added +${result.bonusCoins} bonus coins!`);
            } else if (result?.bonusCoins > 0) {
                showAlert('Welcome!', `You earned ${result.bonusCoins} bonus coins!`);
            }
        } catch (err: any) {
            const errors = err.response?.data?.errors;
            if (errors) {
                const msg = Object.values(errors).flat().join('\n');
                showAlert('Registration Failed', msg);
            } else {
                showAlert('Error', err.response?.data?.message || 'Registration failed');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        if (Platform.OS !== 'ios') {
            showAlert('Not available', 'Apple Sign-in is only available on iOS');
            return;
        }
        try {
            setLoading(true);
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });
            const identityToken = credential.identityToken;
            if (!identityToken) {
                showAlert('Error', 'Apple Sign-in failed: no identity token');
                return;
            }
            await socialLogin({ provider: 'apple', token: identityToken, name: credential.fullName?.givenName, email: credential.email });
        } catch (err: any) {
            if (err.code === 'ERR_CANCELED') {
                // User cancelled
            } else {
                showAlert('Apple Sign-in Failed', err.message || 'Could not sign in with Apple');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join Sinemani and start watching</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Your name"
                        placeholderTextColor={COLORS.textMuted}
                        autoCapitalize="words"
                    />

                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Min 8 characters"
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry
                    />

                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Repeat password"
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnText}>Create Account</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkBox}>
                        <Text style={styles.linkText}>
                            Already have an account? <Text style={styles.linkBold}>Sign In</Text>
                        </Text>
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                        <>
                            <View style={styles.dividerBox}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.dividerLine} />
                            </View>
                            <TouchableOpacity
                                style={[styles.appleBtn, loading && styles.btnDisabled]}
                                onPress={handleAppleLogin}
                                disabled={loading}
                            >
                                <Ionicons name="logo-apple" size={20} color="#fff" />
                                <Text style={styles.appleBtnText}>Sign up with Apple</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
    header: { alignItems: 'center', marginBottom: SPACING.xl },
    title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
    subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
    form: { width: '100%' },
    label: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6, marginTop: SPACING.md },
    input: {
        backgroundColor: COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: SPACING.md,
        paddingVertical: 14, color: COLORS.text, fontSize: 16, borderWidth: 1, borderColor: COLORS.border,
    },
    btn: {
        backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 16,
        alignItems: 'center', marginTop: SPACING.lg,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    linkBox: { alignItems: 'center', marginTop: SPACING.lg },
    linkText: { color: COLORS.textSecondary, fontSize: 14 },
    linkBold: { color: COLORS.primary, fontWeight: '600' },
    dividerBox: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.lg },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    dividerText: { marginHorizontal: SPACING.md, color: COLORS.textMuted, fontSize: 12 },
    appleBtn: {
        backgroundColor: '#000', borderRadius: 10, paddingVertical: 14,
        alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10,
    },
    appleBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
