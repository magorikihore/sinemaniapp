import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING } from '../../constants/config';
import { showAlert } from '../../components/AppAlert';
import { profileService } from '../../services/contentService';
import { useAuthStore } from '../../store/authStore';

interface Props {
    navigation: any;
}

export default function SettingsScreen({ navigation }: Props) {
    const { user, refreshUser, logout } = useAuthStore();
    const [name, setName] = useState(user?.name || '');
    const [saving, setSaving] = useState(false);

    // Change password
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [changingPw, setChangingPw] = useState(false);

    const handleUpdateProfile = async () => {
        if (!name.trim()) { showAlert('Error', 'Name is required'); return; }
        setSaving(true);
        try {
            await profileService.update({ name: name.trim() });
            await refreshUser();
            showAlert('Success', 'Profile updated');
        } catch (err: any) {
            showAlert('Error', err.response?.data?.message || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPw || !newPw) { showAlert('Error', 'Fill all password fields'); return; }
        if (newPw !== confirmPw) { showAlert('Error', 'Passwords do not match'); return; }
        if (newPw.length < 8) { showAlert('Error', 'Password must be at least 8 characters'); return; }
        setChangingPw(true);
        try {
            await profileService.changePassword({
                current_password: currentPw,
                password: newPw,
                password_confirmation: confirmPw,
            });
            showAlert('Success', 'Password changed');
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
        } catch (err: any) {
            showAlert('Error', err.response?.data?.message || 'Password change failed');
        } finally {
            setChangingPw(false);
        }
    };

    const handleDeleteAccount = () => {
        showAlert(
            'Delete Account',
            'This action is permanent and cannot be undone. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                            await profileService.deleteAccount();
                            logout();
                        } catch (err: any) {
                            showAlert('Error', err.response?.data?.message || 'Could not delete account');
                        }
                    },
                },
            ],
        );
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Profile</Text>
                <Text style={styles.label}>Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={COLORS.textMuted} />
                <Text style={styles.label}>Email</Text>
                <TextInput style={[styles.input, styles.disabled]} value={user?.email || ''} editable={false} />
                <TouchableOpacity style={styles.btn} onPress={handleUpdateProfile} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Changes</Text>}
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Change Password</Text>
                <TextInput style={styles.input} value={currentPw} onChangeText={setCurrentPw} placeholder="Current password" placeholderTextColor={COLORS.textMuted} secureTextEntry />
                <TextInput style={styles.input} value={newPw} onChangeText={setNewPw} placeholder="New password" placeholderTextColor={COLORS.textMuted} secureTextEntry />
                <TextInput style={styles.input} value={confirmPw} onChangeText={setConfirmPw} placeholder="Confirm new password" placeholderTextColor={COLORS.textMuted} secureTextEntry />
                <TouchableOpacity style={styles.btn} onPress={handleChangePassword} disabled={changingPw}>
                    {changingPw ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Change Password</Text>}
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Danger Zone</Text>
                <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount}>
                    <Text style={styles.dangerBtnText}>Delete Account</Text>
                </TouchableOpacity>
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
    section: { marginBottom: SPACING.xl },
    sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: SPACING.md },
    label: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4, marginTop: SPACING.sm },
    input: {
        backgroundColor: COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: SPACING.md,
        paddingVertical: 14, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: COLORS.border,
        marginBottom: SPACING.xs,
    },
    disabled: { opacity: 0.5 },
    btn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.md },
    btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    dangerBtn: { borderWidth: 2, borderColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    dangerBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
});
