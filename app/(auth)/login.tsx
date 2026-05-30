import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getAuthRedirectUri } from '../../lib/authCallback';
import { GoogleSignIn } from '../../components/GoogleSignIn';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        Alert.alert(
          'Email Not Verified',
          'Please verify your email before signing in. Would you like to enter your verification code now?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Verify Now', onPress: () => setPendingVerification(true) }
          ]
        );
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
      options: {
        emailRedirectTo: getAuthRedirectUri(),
      },
    });

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('User already exists')) {
        Alert.alert(
          'Account Exists',
          'An account with this email already exists. Please sign in instead.',
          [{ text: 'OK', onPress: () => setIsSignUp(false) }]
        );
      } else {
        Alert.alert('Error', error.message);
      }
    } else if (data.session) {
       // Handled by layout
    } else if (data.user && data.user.identities && data.user.identities.length === 0) {
      // This happens when "Confirm Email" is on and user already exists (Supabase security feature)
      Alert.alert(
        'Account Exists',
        'An account with this email already exists. Please sign in instead.',
        [{ text: 'OK', onPress: () => setIsSignUp(false) }]
      );
    } else {
      setPendingVerification(true);
      Alert.alert(
        'Verify your email',
        'We sent a 6-digit code and a confirmation link. Enter the code below, or tap the link in the email to open the app.'
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
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthRedirectUri() },
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Sent', 'A new verification code and link were sent to your email.');
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
      // Sign in via Supabase Auth
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
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code and a confirmation link to {email}. Enter the code here, or tap
            the link in your email to open the app.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 4 }]}
              onChangeText={setOtp}
              value={otp}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={verifyOtp} disabled={loading || otp.length < 6}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={resendVerification}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Resend verification email</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setPendingVerification(false)}>
            <Text style={styles.secondaryButtonText}>Back to Sign Up</Text>
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

          {/* Social Sign In Buttons */}
          <View style={styles.socialContainer}>
            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={signInWithApple}
              />
            )}
            <GoogleSignIn disabled={loading} />
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              onChangeText={setEmail}
              value={email}
              placeholder="email@address.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password Input */}
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
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => isSignUp ? signUpWithEmail() : signInWithEmail()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => setIsSignUp(!isSignUp)}
          >
            <Text style={styles.secondaryButtonText}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    paddingTop: 64, // Add padding for iOS status bar if not using SafeAreaView
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },
  socialContainer: {
    marginBottom: 24,
    gap: 12,
  },
  appleButton: {
    width: '100%',
    height: 52,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#374151',
  },
  forgotPasswordText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#2563EB', // Blue link color
  },
  input: {
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  passwordInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  eyeIcon: {
    padding: 16,
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  primaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 20,
    alignItems: 'center',
    marginBottom: 32,
  },
  secondaryButtonText: {
    fontFamily: 'Inter_500Medium',
    color: '#4B5563',
    fontSize: 14,
  },
});
