import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { useAuthStore } from '../../store/authStore';
import { FieldErrors, validateRegister } from '../../utils/authValidation';

interface Props {
    navigation: any;
}

export default function RegisterScreen({ navigation }: Props) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});
    const [loading, setLoading] = useState(false);
    const register = useAuthStore((s) => s.register);
    const socialLogin = useAuthStore((s) => s.socialLogin);

    const goToAppAfterAuth = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
        });
    };

    const clearError = (field: keyof FieldErrors) => {
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    const handleRegister = async () => {
        const nextErrors = validateRegister(name, email, password, confirmPassword);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setLoading(true);
        try {
            const result = await register(name.trim(), email.trim(), password, confirmPassword);
            if (result?.converted && result.bonusCoins > 0) {
                showAlert('Welcome!', `Your account is ready. We kept all your coins & history and added +${result.bonusCoins} bonus coins!`);
            } else if (result?.bonusCoins > 0) {
                showAlert('Welcome!', `You earned ${result.bonusCoins} bonus coins!`);
            }
            goToAppAfterAuth();
        } catch (err: any) {
            const apiErrors = err.response?.data?.errors;
            if (apiErrors) {
                const fieldErrors: FieldErrors = {};
                for (const [key, messages] of Object.entries(apiErrors)) {
                    const list = Array.isArray(messages) ? messages : [String(messages)];
                    if (list[0]) fieldErrors[key] = String(list[0]);
                }
                if (Object.keys(fieldErrors).length > 0) {
                    setErrors((prev) => ({ ...prev, ...fieldErrors }));
                } else {
                    showAlert('Registration Failed', Object.values(apiErrors).flat().join('\n'));
                }
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
            goToAppAfterAuth();
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
                    <Image
                        source={require('../../../assets/splash.png')}
                        style={styles.logo}
                        contentFit="contain"
                    />
                    <Text style={styles.subtitle}>Join Sinemani and start watching</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={[styles.input, errors.name && styles.inputError]}
                        value={name}
                        onChangeText={(value) => {
                            setName(value);
                            clearError('name');
                        }}
                        placeholder="Your name"
                        placeholderTextColor={COLORS.textMuted}
                        autoCapitalize="words"
                    />
                    {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={[styles.input, errors.email && styles.inputError]}
                        value={email}
                        onChangeText={(value) => {
                            setEmail(value);
                            clearError('email');
                        }}
                        placeholder="you@example.com"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={[styles.input, errors.password && styles.inputError]}
                        value={password}
                        onChangeText={(value) => {
                            setPassword(value);
                            clearError('password');
                        }}
                        placeholder="Min 8 characters"
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry
                    />
                    {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                        style={[styles.input, errors.confirmPassword && styles.inputError]}
                        value={confirmPassword}
                        onChangeText={(value) => {
                            setConfirmPassword(value);
                            clearError('confirmPassword');
                        }}
                        placeholder="Repeat password"
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry
                    />
                    {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

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
    logo: { width: 220, height: 240 },
    subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center' },
    form: { width: '100%' },
    label: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6, marginTop: SPACING.md },
    input: {
        backgroundColor: COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: SPACING.md,
        paddingVertical: 14, color: COLORS.text, fontSize: 16, borderWidth: 1, borderColor: COLORS.border,
    },
    inputError: { borderColor: COLORS.error },
    errorText: { color: COLORS.error, fontSize: 12, marginTop: 6 },
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
