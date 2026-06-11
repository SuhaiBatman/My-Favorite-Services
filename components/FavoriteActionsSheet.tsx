import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { profileDisplayName } from '../lib/format';
import type { FavoriteProvider } from '../lib/favorites';
import { ProviderAvatar } from './ProviderAvatar';

export type FavoriteActionKey = 'viewProfile' | 'book' | 'message' | 'remove';

type MenuRow = {
  key: FavoriteActionKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
};

type FavoriteActionsSheetProps = {
  visible: boolean;
  favorite: FavoriteProvider | null;
  anchorY?: number | null;
  onClose: () => void;
  onAction: (action: FavoriteActionKey) => void;
};

const MENU_WIDTH = 306;

const MENU_ROWS: MenuRow[] = [
  { key: 'viewProfile', label: 'View Profile', icon: 'person-outline' },
  { key: 'book', label: 'Book Appointment', icon: 'calendar-outline' },
  { key: 'message', label: 'Message', icon: 'chatbubble-outline' },
  { key: 'remove', label: 'Remove from Favorites', icon: 'heart-dislike-outline', destructive: true },
];

function FrostedMenuCard({ children }: { children: React.ReactNode }) {
  const { isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.menuCard}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 72 : 90}
        tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.menuCardOverlay} pointerEvents="none" />
      {children}
    </View>
  );
}

function FavoritePreview({ favorite }: { favorite: FavoriteProvider | null }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const profile = favorite?.profiles;
  const name = profileDisplayName(profile?.first_name, profile?.last_name);
  const subtitle = profile?.job_title || profile?.business_name || 'Service Provider';
  const services = profile?.services
    ? profile.services.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <View style={styles.previewCard}>
      <View style={styles.previewHeader}>
        <ProviderAvatar name={name} size={34} />
        <View style={styles.previewHeaderCopy}>
          <Text style={styles.previewName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.previewSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Ionicons name="heart" size={16} color={theme.colors.destructive} />
      </View>
      {profile?.location ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {profile.location}
          </Text>
        </View>
      ) : null}
      {services.length > 0 ? (
        <View style={styles.servicesRow}>
          {services.slice(0, 3).map((service) => (
            <View key={service} style={styles.serviceChip}>
              <Text style={styles.serviceChipText}>{service}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function FavoriteActionsSheet({
  visible,
  favorite,
  anchorY,
  onClose,
  onAction,
}: FavoriteActionsSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const popAnim = useRef(new Animated.Value(0)).current;
  const menuWidth = Math.min(MENU_WIDTH, screenWidth - 48);
  const stackTop = Math.max(
    82,
    Math.min((anchorY ?? screenHeight / 2) - 120, screenHeight - 380)
  );

  useEffect(() => {
    if (!visible) {
      popAnim.setValue(0);
      return;
    }
    Animated.spring(popAnim, {
      toValue: 1,
      speed: 24,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [popAnim, visible]);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.stack,
            {
              top: stackTop,
              width: menuWidth,
              opacity: popAnim,
              transform: [
                {
                  scale: popAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
                {
                  translateY: popAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <FavoritePreview favorite={favorite} />

          <FrostedMenuCard>
            {MENU_ROWS.map((row, index) => (
              <View key={row.key}>
                {index > 0 ? <View style={styles.menuDivider} /> : null}
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => onAction(row.key)}
                  activeOpacity={0.55}
                >
                  <Text
                    style={[
                      styles.menuLabel,
                      row.destructive && styles.menuLabelDestructive,
                    ]}
                  >
                    {row.label}
                  </Text>
                  <Ionicons
                    name={row.icon}
                    size={20}
                    color={row.destructive ? theme.colors.destructive : theme.colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </FrostedMenuCard>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.22)',
    },
    stack: {
      position: 'absolute',
      gap: 10,
      maxWidth: '100%',
    },
    previewCard: {
      backgroundColor: theme.colors.inboxSurface,
      borderRadius: 18,
      paddingTop: 12,
      paddingBottom: 14,
      paddingHorizontal: 12,
      minHeight: 100,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.22,
      shadowRadius: 28,
      elevation: 12,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    previewHeaderCopy: {
      flex: 1,
    },
    previewName: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: 15,
      color: theme.colors.textPrimary,
    },
    previewSubtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 1,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 10,
    },
    locationText: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    servicesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    serviceChip: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    serviceChipText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 11,
      color: theme.colors.textPrimary,
    },
    menuCard: {
      borderRadius: 14,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 22,
      elevation: 10,
    },
    menuCardOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.frostedOverlay,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 11,
      minHeight: 44,
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.inboxSeparator,
      marginLeft: 16,
    },
    menuLabel: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 17,
      color: theme.colors.textPrimary,
    },
    menuLabelDestructive: {
      color: theme.colors.destructive,
    },
  });
}
