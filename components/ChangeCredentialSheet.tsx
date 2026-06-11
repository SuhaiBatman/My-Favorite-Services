import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { User } from '@supabase/supabase-js';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { useFullScreenSheetTopInset } from '../hooks/use-full-screen-sheet-top-inset';
import { Button } from './Button';
import {
  cancelPendingCredentialChange,
  confirmEmailChange,
  confirmPhoneChange,
  type ConfirmedContact,
  requestEmailChange,
  requestPhoneChange,
  resendEmailVerification,
  resendPhoneVerification,
  sendReauthenticationOtp,
  userHasPasswordIdentity,
  verifyPasswordReauth,
  verifyReauthenticationOtp,
} from '../lib/accountCredentials';
import { formatPhoneNumber, isValidEmail, phoneDigits } from '../lib/phone';

type CredentialType = 'email' | 'phone';

type Step = 'reauth' | 'new_value' | 'verify_new';

type ChangeCredentialSheetProps = {
  visible: boolean;
  type: CredentialType;
  user: User | null;
  confirmedContact: ConfirmedContact;
  onClose: () => void;
  onSuccess: (type: CredentialType, value: string) => void;
  onDismiss?: () => void;
};

export function ChangeCredentialSheet({
  visible,
  type,
  user,
  confirmedContact,
  onClose,
  onSuccess,
  onDismiss,
}: ChangeCredentialSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const topInset = useFullScreenSheetTopInset();

  const [step, setStep] = useState<Step>('reauth');
  const [password, setPassword] = useState('');
  const [reauthOtp, setReauthOtp] = useState('');
  const [reauthOtpSent, setReauthOtpSent] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [verifyOtp, setVerifyOtp] = useState('');
  const [pendingE164, setPendingE164] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmedRef = useRef(confirmedContact);
  confirmedRef.current = confirmedContact;

  const usesPassword = userHasPasswordIdentity(user);

  const title = useMemo(() => {
    if (step === 'reauth') return 'Verify it\u2019s you';
    if (step === 'new_value') return type === 'email' ? 'New email' : 'New phone number';
    return type === 'email' ? 'Verify new email' : 'Verify new phone';
  }, [step, type]);

  const subtitle = useMemo(() => {
    if (step === 'reauth') {
      return usesPassword
        ? 'Enter your current password before changing your account details.'
        : 'We\u2019ll send a verification code to your current email.';
    }
    if (step === 'new_value') {
      return type === 'email'
        ? 'We\u2019ll send a verification code to your new email. It won\u2019t change until you confirm.'
        : 'We\u2019ll text a verification code to your new number. It won\u2019t change until you confirm.';
    }
    return type === 'email'
      ? `Enter the 6-digit code sent to ${newValue.trim()}. Your email stays ${confirmedContact.email} until verified.`
      : `Enter the 6-digit code sent to ${newValue.trim()}. Your number stays ${confirmedContact.phone || 'unchanged'} until verified.`;
  }, [step, type, usesPassword, newValue, confirmedContact.email, confirmedContact.phone]);

  useEffect(() => {
    if (!visible) {
      setStep('reauth');
      setPassword('');
      setReauthOtp('');
      setReauthOtpSent(false);
      setNewValue('');
      setVerifyOtp('');
      setPendingE164('');
      setPendingVerification(false);
      setLoading(false);
      setError(null);
    }
  }, [visible]);

  const revertPendingChange = async () => {
    if (!pendingVerification) return;
    await cancelPendingCredentialChange(type, confirmedRef.current);
    setPendingVerification(false);
  };

  const handleClose = () => {
    if (loading) return;

    if (pendingVerification) {
      Alert.alert(
        'Cancel change?',
        type === 'email'
          ? 'Your email will stay the same unless you verify the new address.'
          : 'Your phone number will stay the same unless you enter the verification code.',
        [
          { text: 'Keep verifying', style: 'cancel' },
          {
            text: 'Cancel change',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setLoading(true);
                try {
                  await revertPendingChange();
                } finally {
                  setLoading(false);
                  onDismiss?.();
                  onClose();
                }
              })();
            },
          },
        ]
      );
      return;
    }

    onDismiss?.();
    onClose();
  };

  const runReauth = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (usesPassword) {
        await verifyPasswordReauth(confirmedContact.email, password);
      } else if (reauthOtpSent) {
        await verifyReauthenticationOtp(confirmedContact.email, reauthOtp);
      } else {
        await sendReauthenticationOtp();
        setReauthOtpSent(true);
        setLoading(false);
        return;
      }
      setStep('new_value');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const runRequestChange = async () => {
    setLoading(true);
    setError(null);
    try {
      if (type === 'email') {
        const trimmed = newValue.trim();
        if (!isValidEmail(trimmed)) {
          throw new Error('Enter a valid email address.');
        }
        if (trimmed.toLowerCase() === confirmedContact.email.trim().toLowerCase()) {
          throw new Error('That is already your current email.');
        }
        await requestEmailChange(trimmed);
      } else {
        const digits = phoneDigits(newValue);
        if (digits.length !== 10) {
          throw new Error('Enter a valid 10-digit phone number.');
        }
        const formatted = formatPhoneNumber(digits);
        if (formatted === confirmedContact.phone.trim()) {
          throw new Error('That is already your current phone number.');
        }
        const e164 = await requestPhoneChange(formatted);
        setPendingE164(e164);
        setNewValue(formatted);
      }
      setPendingVerification(true);
      setStep('verify_new');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start verification.');
    } finally {
      setLoading(false);
    }
  };

  const runConfirmChange = async () => {
    setLoading(true);
    setError(null);
    try {
      if (type === 'email') {
        const updated = await confirmEmailChange(
          newValue,
          verifyOtp,
          confirmedContact.email
        );
        setPendingVerification(false);
        onSuccess('email', updated);
      } else {
        const updated = await confirmPhoneChange(
          pendingE164,
          verifyOtp,
          newValue,
          confirmedContact.authPhoneE164
        );
        setPendingVerification(false);
        onSuccess('phone', updated);
      }
      onDismiss?.();
      onClose();
    } catch (e) {
      setPendingVerification(false);
      setError(e instanceof Error ? e.message : 'Verification failed.');
      setVerifyOtp('');
    } finally {
      setLoading(false);
    }
  };

  const runResendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      if (type === 'email') {
        await resendEmailVerification(newValue.trim());
      } else {
        const e164 = await resendPhoneVerification(newValue);
        setPendingE164(e164);
      }
      Alert.alert(
        'Code sent',
        type === 'email'
          ? 'Check your new email for a verification code.'
          : 'Check your phone for a verification text.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'verify_new') {
      Alert.alert(
        'Cancel verification?',
        'Your contact info will not change unless you complete verification.',
        [
          { text: 'Keep verifying', style: 'cancel' },
          {
            text: 'Cancel change',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setLoading(true);
                try {
                  await revertPendingChange();
                  setVerifyOtp('');
                  setError(null);
                  setStep('new_value');
                } catch {
                  setError('Could not cancel the pending change. Please try again.');
                } finally {
                  setLoading(false);
                }
              })();
            },
          },
        ]
      );
      return;
    }

    setError(null);
    setStep('reauth');
  };

  const primaryLabel = (() => {
    if (step === 'reauth') {
      if (!usesPassword && !reauthOtpSent) return 'Send code';
      return 'Continue';
    }
    if (step === 'new_value') return 'Send verification code';
    return 'Confirm change';
  })();

  const primaryDisabled = (() => {
    if (loading) return true;
    if (step === 'reauth') {
      if (usesPassword) return password.length < 6;
      if (reauthOtpSent) return reauthOtp.length < 6;
      return false;
    }
    if (step === 'new_value') {
      return type === 'email' ? !isValidEmail(newValue) : phoneDigits(newValue).length !== 10;
    }
    return verifyOtp.length < 6;
  })();

  const handlePrimary = () => {
    if (step === 'reauth') void runReauth();
    else if (step === 'new_value') void runRequestChange();
    else void runConfirmChange();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: topInset + theme.spacing.md }]}>
          <TouchableOpacity onPress={handleClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {type === 'email' ? 'Change email' : 'Change phone'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {step === 'reauth' ? (
            usesPassword ? (
              <View style={styles.field}>
                <Text style={styles.label}>Current password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="Password"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
            ) : reauthOtpSent ? (
              <View style={styles.field}>
                <Text style={styles.label}>Verification code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={reauthOtp}
                  onChangeText={setReauthOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
            ) : null
          ) : null}

          {step === 'new_value' ? (
            <View style={styles.field}>
              <Text style={styles.label}>{type === 'email' ? 'New email' : 'New phone'}</Text>
              <TextInput
                style={styles.input}
                value={newValue}
                onChangeText={(text) =>
                  setNewValue(type === 'phone' ? formatPhoneNumber(text) : text)
                }
                autoCapitalize="none"
                keyboardType={type === 'email' ? 'email-address' : 'phone-pad'}
                placeholder={type === 'email' ? 'email@address.com' : '(555) 123-4567'}
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
          ) : null}

          {step === 'verify_new' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Verification code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={verifyOtp}
                  onChangeText={setVerifyOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
              <TouchableOpacity
                style={styles.resendLink}
                onPress={() => void runResendCode()}
                disabled={loading}
              >
                <Text style={styles.resendLinkText}>Resend code</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={primaryLabel}
            onPress={handlePrimary}
            loading={loading}
            disabled={primaryDisabled}
            style={styles.primaryButton}
          />

          {step !== 'reauth' ? (
            <TouchableOpacity style={styles.backLink} onPress={handleBack} disabled={loading}>
              <Text style={styles.backLinkText}>Back</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    headerTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    headerSpacer: {
      width: 24,
    },
    content: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    title: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.h2,
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
    field: {
      gap: theme.spacing.xs,
    },
    label: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
    },
    otpInput: {
      textAlign: 'center',
      fontSize: 24,
      letterSpacing: 6,
    },
    error: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.destructive,
    },
    primaryButton: {
      marginTop: theme.spacing.sm,
    },
    resendLink: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
    },
    resendLinkText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.secondary,
    },
    backLink: {
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    backLinkText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.secondary,
    },
  });
}
