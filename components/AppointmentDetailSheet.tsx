import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { Button } from './Button';
import { ProviderAvatar } from './ProviderAvatar';
import type { Appointment } from '../lib/appointments';
import {
  formatAppointmentDate,
  formatAppointmentTime,
  formatDurationMinutes,
  profileDisplayName,
} from '../lib/format';

type AppointmentDetailSheetProps = {
  appointment: Appointment | null;
  visible: boolean;
  onClose: () => void;
  /** @default 'client' — viewing as the booking user */
  perspective?: 'client' | 'provider';
  onViewProvider?: (providerId: string) => void;
  onMessageProvider?: (providerId: string) => void;
  onViewPeer?: () => void;
  onMessagePeer?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
};

function getStatusStyles(theme: AppTheme): Record<
  string,
  { bg: string; text: string; label: string }
> {
  return {
    confirmed: { bg: theme.colors.primaryLight, text: theme.colors.success, label: 'Confirmed' },
    pending: { bg: theme.colors.primaryLight, text: theme.colors.secondary, label: 'Pending' },
    cancelled: { bg: theme.colors.messageReceived, text: theme.colors.destructive, label: 'Cancelled' },
    completed: { bg: theme.colors.messageReceived, text: theme.colors.textSecondary, label: 'Completed' },
  };
}

export function AppointmentDetailSheet({
  appointment,
  visible,
  onClose,
  perspective = 'client',
  onViewProvider,
  onMessageProvider,
  onViewPeer,
  onMessagePeer,
  onAccept,
  onDecline,
}: AppointmentDetailSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  if (!appointment) return null;

  const isProviderView = perspective === 'provider';
  const provider = appointment.provider;
  const client = appointment.user;
  const peerName = isProviderView
    ? profileDisplayName(client?.first_name, client?.last_name, 'Client')
    : profileDisplayName(provider?.first_name, provider?.last_name, 'Provider');
  const peerRole = isProviderView
    ? 'Client'
    : provider?.job_title || provider?.business_name || 'Service Provider';
  const statusStyles = getStatusStyles(theme);
  const statusStyle = statusStyles[appointment.status] ?? statusStyles.confirmed;
  const location =
    appointment.location ||
    (isProviderView ? null : provider?.location);
  const viewPeer = onViewPeer ?? (onViewProvider ? () => onViewProvider(appointment.provider_id) : undefined);
  const messagePeer =
    onMessagePeer ?? (onMessageProvider ? () => onMessageProvider(appointment.provider_id) : undefined);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Appointment</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {statusStyle.label}
            </Text>
          </View>

          <Text style={styles.serviceName}>{appointment.service_name}</Text>
          <Text style={styles.dateLine}>
            {formatAppointmentDate(appointment.starts_at)} · {formatAppointmentTime(appointment.starts_at)}
          </Text>
          <Text style={styles.duration}>
            Duration: {formatDurationMinutes(appointment.starts_at, appointment.ends_at)}
          </Text>

          <Pressable style={styles.providerCard} onPress={viewPeer}>
            <ProviderAvatar name={peerName} size={52} />
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{peerName}</Text>
              <Text style={styles.providerRole}>{peerRole}</Text>
            </View>
            {viewPeer ? (
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            ) : null}
          </Pressable>

          {location ? (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={20} color={theme.colors.secondary} />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{location}</Text>
              </View>
            </View>
          ) : null}

          {appointment.notes ? (
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.secondary} />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Your notes</Text>
                <Text style={styles.detailValue}>{appointment.notes}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            {onAccept && onDecline ? (
              <View style={styles.respondRow}>
                <Button title="Decline" variant="outline" onPress={onDecline} style={styles.respondBtn} />
                <Button title="Accept" onPress={onAccept} style={styles.respondBtn} />
              </View>
            ) : null}
            {viewPeer ? (
              <Button
                title={isProviderView ? 'View client' : 'View provider'}
                variant="outline"
                onPress={viewPeer}
              />
            ) : null}
            {messagePeer ? (
              <Button
                title={isProviderView ? 'Message client' : 'Message provider'}
                onPress={messagePeer}
                style={styles.messageBtn}
              />
            ) : null}
          </View>
        </ScrollView>
      </View>
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
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.md,
  },
  statusText: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.caption,
  },
  serviceName: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.h1,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  dateLine: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  duration: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  providerRole: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  actions: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  respondRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  respondBtn: {
    flex: 1,
  },
  messageBtn: {
    marginTop: 0,
  },
  });
}