import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { useAuthStore } from '../../store/authStore';

interface Props {
    navigation: any;
}

export default function LoginScreen({ navigation }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const login = useAuthStore((s) => s.login);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            showAlert('Error', 'Please enter email and password');
            return;
        }
        setLoading(true);
        try {
            await login(email.trim(), password);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Login failed. Check your credentials.';
            showAlert('Login Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {/* Logo */}
                <View style={styles.logoBox}>
                    <Text style={styles.logoText}>🎬</Text>
                    <Text style={styles.appName}>Sinemani</Text>
                    <Text style={styles.tagline}>Unlimited Short Dramas</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
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
                        placeholder="Enter your password"
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword', { email })} style={styles.linkBox}>
                        <Text style={styles.linkText}>Forgot password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkBox}>
                        <Text style={styles.linkText}>
                            Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('MainTabs')} style={styles.skipBox}>
                        <Text style={styles.skipText}>Browse as Guest →</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
    logoBox: { alignItems: 'center', marginBottom: SPACING.xl },
    logoText: { fontSize: 64 },
    appName: { fontSize: 32, fontWeight: 'bold', color: COLORS.text, marginTop: SPACING.sm },
    tagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
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
    skipBox: { alignItems: 'center', marginTop: SPACING.md },
    skipText: { color: COLORS.textMuted, fontSize: 14 },
});
