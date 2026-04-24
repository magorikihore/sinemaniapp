import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { authService } from '../../services/authService';

interface Props { navigation: any; route?: any; }

export default function ForgotPasswordScreen({ navigation, route }: Props) {
    const [step, setStep] = useState<'email' | 'reset'>('email');
    const [email, setEmail] = useState(route?.params?.email || '');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const sendCode = async () => {
        if (!email.trim()) return showAlert({ title: 'Email required', message: 'Enter your email address.' });
        setLoading(true);
        try {
            const res = await authService.forgotPassword(email.trim().toLowerCase());
            showAlert({ title: 'Check your email', message: res.message || 'If that email is registered, a code has been sent.' });
            setStep('reset');
        } catch (e: any) {
            showAlert({ title: 'Error', message: e?.response?.data?.message || 'Failed to send code' });
        } finally { setLoading(false); }
    };

    const resendCode = async () => {
        setResending(true);
        try {
            await authService.forgotPassword(email.trim().toLowerCase());
            showAlert({ title: 'Resent', message: 'A new code has been sent.' });
        } catch (e: any) {
            showAlert({ title: 'Error', message: e?.response?.data?.message || 'Failed to resend' });
        } finally { setResending(false); }
    };

    const submitReset = async () => {
        if (code.length !== 6) return showAlert({ title: 'Code required', message: 'Enter the 6-digit code from your email.' });
        if (password.length < 6) return showAlert({ title: 'Password too short', message: 'Use at least 6 characters.' });
        if (password !== confirm) return showAlert({ title: 'Mismatch', message: 'Passwords do not match.' });
        setLoading(true);
        try {
            const res = await authService.resetPassword({
                email: email.trim().toLowerCase(),
                code,
                password,
                password_confirmation: confirm,
            });
            showAlert({ title: 'Success', message: res.message || 'Password reset. Please log in.' });
            navigation.replace('Login');
        } catch (e: any) {
            showAlert({ title: 'Error', message: e?.response?.data?.message || 'Reset failed' });
        } finally { setLoading(false); }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.iconBox}>
                    <Ionicons name="lock-closed-outline" size={56} color={COLORS.primary} />
                </View>

                {step === 'email' ? (
                    <>
                        <Text style={styles.title}>Forgot Password?</Text>
                        <Text style={styles.subtitle}>Enter your email and we'll send you a 6-digit reset code.</Text>

                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="you@example.com"
                            placeholderTextColor={COLORS.textMuted}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            style={styles.input}
                        />

                        <TouchableOpacity onPress={sendCode} disabled={loading} style={[styles.btn, loading && { opacity: 0.6 }]}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Code</Text>}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.title}>Enter Code</Text>
                        <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

                        <Text style={styles.label}>6-Digit Code</Text>
                        <TextInput
                            value={code}
                            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                            placeholder="000000"
                            placeholderTextColor={COLORS.textMuted}
                            keyboardType="number-pad"
                            maxLength={6}
                            style={[styles.input, { letterSpacing: 8, textAlign: 'center', fontSize: 22 }]}
                        />

                        <Text style={styles.label}>New Password</Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="At least 6 characters"
                            placeholderTextColor={COLORS.textMuted}
                            secureTextEntry
                            style={styles.input}
                        />

                        <Text style={styles.label}>Confirm Password</Text>
                        <TextInput
                            value={confirm}
                            onChangeText={setConfirm}
                            placeholder="Re-enter password"
                            placeholderTextColor={COLORS.textMuted}
                            secureTextEntry
                            style={styles.input}
                        />

                        <TouchableOpacity onPress={submitReset} disabled={loading} style={[styles.btn, loading && { opacity: 0.6 }]}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={resendCode} disabled={resending} style={styles.linkBtn}>
                            <Text style={styles.linkText}>{resending ? 'Sending…' : "Didn't get it? Resend"}</Text>
                        </TouchableOpacity>
                    </>
                )}

                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkBtn}>
                    <Text style={styles.linkText}>Back to Login</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scroll: { padding: 24, paddingTop: 32 },
    iconBox: { alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 24, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
    subtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
    label: { fontSize: 13, color: COLORS.textMuted, marginTop: 14, marginBottom: 6, fontWeight: '600' },
    input: { backgroundColor: '#1A1A1A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: '#2A2A2A' },
    btn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 24 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    linkBtn: { alignItems: 'center', paddingVertical: 14 },
    linkText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});
