import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getAuthRedirectUri } from '../../lib/authCallback';
import { GoogleSignIn } from '../../components/GoogleSignIn';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';

export default function LoginScreen() {
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationSource, setVerificationSource] = useState<'signin' | 'signup' | null>(null);
  const showAppleSignIn = Platform.OS === 'ios';
  const showGoogleSignIn = Platform.OS === 'android';
  const showSocialSignIn = showAppleSignIn || showGoogleSignIn;

  function isEmailNotConfirmedError(error: { message: string }) {
    return error.message.toLowerCase().includes('email not confirmed');
  }

  function isExistingAccountError(error: { message: string }) {
    const message = error.message.toLowerCase();
    return message.includes('already registered') || message.includes('user already exists');
  }

  async function sendVerificationCode(): Promise<boolean> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) {
      Alert.alert('Error', error.message);
      return false;
    }
    return true;
  }

  async function goToEmailVerification(source: 'signin' | 'signup', resendCode = true) {
    setVerificationSource(source);
    setIsSignUp(source === 'signup');
    if (resendCode) {
      await sendVerificationCode();
    }
    setPendingVerification(true);
    Alert.alert(
      'Email Not Verified',
      'Your email address has not been verified yet. Enter the 6-digit code we sent to your email, or request a new one.'
    );
  }

  async function handleExistingAccountOnSignUp() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
      return;
    }

    if (isEmailNotConfirmedError(error)) {
      await goToEmailVerification('signup');
      return;
    }

    Alert.alert(
      'Account Exists',
      'An account with this email already exists. Please sign in instead.',
      [{ text: 'OK', onPress: () => setIsSignUp(false) }]
    );
  }

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      if (isEmailNotConfirmedError(error)) {
        await goToEmailVerification('signin');
      } else {
        Alert.alert('Error', error.message);
      }
    }
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      if (isExistingAccountError(error)) {
        await handleExistingAccountOnSignUp();
      } else {
        Alert.alert('Error', error.message);
      }
    } else if (data.session) {
      // Handled by layout
    } else if (data.user && data.user.identities && data.user.identities.length === 0) {
      await handleExistingAccountOnSignUp();
    } else {
      setVerificationSource('signup');
      setPendingVerification(true);
      Alert.alert(
        'Verify your email',
        'We sent a 6-digit code to your email. Enter it below to finish creating your account.'
      );
    }
    setLoading(false);
  }

  async function verifyOtp() {
    setLoading(true);
    const trimmedOtp = otp.trim();
    let { error } = await supabase.auth.verifyOtp({
      email,
      token: trimmedOtp,
      type: 'signup',
    });

    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email,
        token: trimmedOtp,
        type: 'email',
      });
      error = retry.error;
    }

    if (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  }

  async function resendVerification() {
    setLoading(true);
    const sent = await sendVerificationCode();
    if (sent) {
      Alert.alert('Sent', 'A new 6-digit verification code was sent to your email.');
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address to reset your password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUri(),
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Check your email for the password reset link.');
    }
    setLoading(false);
  }

  async function signInWithApple() {
    try {
      setLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) {
          Alert.alert('Error', error.message);
        }
      } else {
        throw new Error('No identityToken returned from Apple.');
      }
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // user canceled
      } else {
        Alert.alert('Error', e.message || 'Apple Sign in Failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (pendingVerification) {
    const verificationSubtitle =
      verificationSource === 'signin'
        ? `Your email hasn't been verified yet. Enter the 6-digit code we sent to ${email} to sign in.`
        : verificationSource === 'signup'
          ? `Your email hasn't been verified yet. Enter the 6-digit code we sent to ${email} to finish creating your account.`
          : `We sent a 6-digit code to ${email}. Enter it below to verify your account.`;

    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>{verificationSubtitle}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              onChangeText={setOtp}
              value={otp}
              placeholder="000000"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={verifyOtp} disabled={loading || otp.length < 6}>
            {loading ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryButtonText}>Verify Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={resendVerification}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Resend verification email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setPendingVerification(false);
              setOtp('');
            }}
          >
            <Text style={styles.secondaryButtonText}>
              {verificationSource === 'signin' ? 'Back to Sign In' : 'Back to Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>{isSignUp ? 'Create an Account' : 'Welcome Back'}</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Sign up to get started' : 'Sign in to continue to your account'}
          </Text>

          {showSocialSignIn && (
            <>
              <View style={styles.socialContainer}>
                {showAppleSignIn && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={
                      isDark
                        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    }
                    cornerRadius={12}
                    style={styles.appleButton}
                    onPress={signInWithApple}
                  />
                )}
                {showGoogleSignIn && <GoogleSignIn disabled={loading} />}
              </View>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with email</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              onChangeText={setEmail}
              value={email}
              placeholder="email@address.com"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Password</Text>
              {!isSignUp && (
                <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                onChangeText={setPassword}
                value={password}
                secureTextEntry={!showPassword}
                placeholder="Password"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => (isSignUp ? signUpWithEmail() : signInWithEmail())}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryButtonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={styles.secondaryButtonText}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      padding: theme.spacing.lg,
      justifyContent: 'center',
      paddingTop: 64,
    },
    title: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 32,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xl,
    },
    socialContainer: {
      marginBottom: theme.spacing.lg,
      gap: 12,
    },
    appleButton: {
      width: '100%',
      height: 52,
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.md,
      fontSize: theme.typography.sizes.subbody,
    },
    inputContainer: {
      marginBottom: 20,
    },
    passwordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    label: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textPrimary,
    },
    forgotPasswordText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.link,
    },
    input: {
      fontFamily: theme.typography.fontFamily.regular,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
    },
    otpInput: {
      textAlign: 'center',
      fontSize: 24,
      letterSpacing: 4,
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
    },
    passwordInput: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.regular,
      padding: theme.spacing.md,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    eyeIcon: {
      padding: theme.spacing.md,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginTop: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    primaryButtonText: {
      fontFamily: theme.typography.fontFamily.semiBold,
      color: theme.colors.textInverted,
      fontSize: theme.typography.sizes.body,
    },
    secondaryButton: {
      marginTop: 20,
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    secondaryButtonText: {
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.subbody,
    },
  });
}
