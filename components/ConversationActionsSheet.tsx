import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { formatChatDateDivider, formatMessageTime, profileDisplayName } from '../lib/format';
import type { Conversation, Message } from '../lib/messaging';
import { ProviderAvatar } from './ProviderAvatar';

export type ConversationActionKey =
  | 'markRead'
  | 'markUnread'
  | 'pin'
  | 'unpin'
  | 'mute'
  | 'unmute'
  | 'archive'
  | 'unarchive'
  | 'delete';

export type ConversationActionsState = {
  isUnread: boolean;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
};

type MenuRow = {
  key: ConversationActionKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
};

type ConversationActionsSheetProps = {
  visible: boolean;
  conversation: Conversation | null;
  userId: string | undefined;
  previewMessages: Message[];
  previewLoading?: boolean;
  anchorY?: number | null;
  state: ConversationActionsState;
  onClose: () => void;
  onAction: (action: ConversationActionKey) => void;
};

const MENU_WIDTH = 306;

function buildMenuRows(state: ConversationActionsState): MenuRow[] {
  return [
    state.isPinned
      ? { key: 'unpin', label: 'Unpin', icon: 'pin-outline' }
      : { key: 'pin', label: 'Pin', icon: 'pin' },
    state.isMuted
      ? { key: 'unmute', label: 'Show Alerts', icon: 'notifications-outline' }
      : { key: 'mute', label: 'Hide Alerts', icon: 'notifications-off-outline' },
    state.isUnread
      ? { key: 'markRead', label: 'Mark as Read', icon: 'checkmark-circle' }
      : { key: 'markUnread', label: 'Mark as Unread', icon: 'mail-unread-outline' },
    state.isArchived
      ? { key: 'unarchive', label: 'Unarchive', icon: 'archive-outline' }
      : { key: 'archive', label: 'Archive', icon: 'archive' },
    { key: 'delete', label: 'Delete', icon: 'trash-outline', destructive: true },
  ];
}

type PreviewBubble = {
  id: string;
  body: string;
  isSent: boolean;
  showTimestamp?: string;
};

function buildPreviewBubbles(
  messages: Message[],
  userId: string | undefined,
  conversation: Conversation | null
): PreviewBubble[] {
  const recent = messages.slice(-2);
  if (recent.length > 0 && userId) {
    const last = recent[recent.length - 1];
    const bubbles: PreviewBubble[] = [];

    if (recent.length >= 2) {
      const first = recent[0];
      bubbles.push({
        id: first.id,
        body: first.body,
        isSent: first.sender_id === userId,
      });
      bubbles.push({
        id: `ts-${last.id}`,
        body: '',
        isSent: false,
        showTimestamp: `${formatChatDateDivider(last.created_at)} ${formatMessageTime(last.created_at)}`,
      });
      bubbles.push({
        id: last.id,
        body: last.body,
        isSent: last.sender_id === userId,
      });
      return bubbles;
    }

    bubbles.push({
      id: `ts-${last.id}`,
      body: '',
      isSent: false,
      showTimestamp: `${formatChatDateDivider(last.created_at)} ${formatMessageTime(last.created_at)}`,
    });
    bubbles.push({
      id: last.id,
      body: last.body,
      isSent: last.sender_id === userId,
    });
    return bubbles;
  }

  if (conversation?.last_message_body) {
    const at = conversation.last_message_at || conversation.updated_at;
    const isSent = conversation.last_message_sender_id === userId;
    return [
      {
        id: 'ts-fallback',
        body: '',
        isSent: false,
        showTimestamp: at
          ? `${formatChatDateDivider(at)} ${formatMessageTime(at)}`
          : 'Recently',
      },
      {
        id: 'fallback',
        body: conversation.last_message_body,
        isSent: !!isSent,
      },
    ];
  }

  return [
    {
      id: 'empty',
      body: 'No messages yet',
      isSent: false,
    },
  ];
}

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

function ConversationPreview({
  conversation,
  bubbles,
  loading,
}: {
  conversation: Conversation | null;
  bubbles: PreviewBubble[];
  loading?: boolean;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const name = profileDisplayName(
    conversation?.provider?.first_name,
    conversation?.provider?.last_name
  );
  const subtitle =
    conversation?.provider?.job_title ||
    conversation?.provider?.business_name ||
    'iMessage';

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
        <Ionicons name="chevron-forward" size={16} color={theme.colors.chevron} />
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.textSecondary} style={styles.previewLoader} />
      ) : (
        bubbles.map((item) => {
          if (item.showTimestamp) {
            return (
              <Text key={item.id} style={styles.previewTimestamp}>
                {item.showTimestamp}
              </Text>
            );
          }
          const isSent = item.isSent;
          return (
            <View
              key={item.id}
              style={[styles.previewBubbleRow, isSent ? styles.previewRowSent : styles.previewRowReceived]}
            >
              <View
                style={[
                  styles.previewBubble,
                  isSent ? styles.previewBubbleSent : styles.previewBubbleReceived,
                ]}
              >
                <Text
                  style={[
                    styles.previewBubbleText,
                    isSent ? styles.previewBubbleTextSent : styles.previewBubbleTextReceived,
                  ]}
                >
                  {item.body}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

export function ConversationActionsSheet({
  visible,
  conversation,
  userId,
  previewMessages,
  previewLoading,
  anchorY,
  state,
  onClose,
  onAction,
}: ConversationActionsSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const popAnim = useRef(new Animated.Value(0)).current;
  const menuWidth = Math.min(MENU_WIDTH, screenWidth - 48);
  const stackTop = Math.max(
    82,
    Math.min((anchorY ?? screenHeight / 2) - 170, screenHeight - 430)
  );
  const rows = buildMenuRows(state);
  const bubbles = useMemo(
    () => buildPreviewBubbles(previewMessages, userId, conversation),
    [previewMessages, userId, conversation]
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
          <ConversationPreview
            conversation={conversation}
            bubbles={bubbles}
            loading={previewLoading}
          />

          <FrostedMenuCard>
            {rows.map((row, index) => (
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
    minHeight: 154,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.inboxSeparator,
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
  previewLoader: {
    paddingVertical: 34,
  },
  previewTimestamp: {
    alignSelf: 'center',
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 11,
    color: theme.colors.muted,
    marginVertical: 6,
  },
  previewBubbleRow: {
    marginVertical: 2,
  },
  previewRowReceived: {
    alignItems: 'flex-start',
  },
  previewRowSent: {
    alignItems: 'flex-end',
  },
  previewBubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  previewBubbleReceived: {
    backgroundColor: theme.colors.bubbleReceived,
    borderBottomLeftRadius: 4,
  },
  previewBubbleSent: {
    backgroundColor: theme.colors.bubbleSent,
    borderBottomRightRadius: 4,
  },
  previewBubbleText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 17,
    lineHeight: 22,
  },
  previewBubbleTextReceived: {
    color: theme.colors.bubbleReceivedText,
  },
  previewBubbleTextSent: {
    color: theme.colors.bubbleSentText,
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