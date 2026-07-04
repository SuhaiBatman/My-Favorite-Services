import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import type { AppTheme } from '../../../constants/theme';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { useThemedStyles } from '../../../hooks/use-themed-styles';
import { ProviderAvatar } from '../../ProviderAvatar';
import {
  EmployeeNewMessageSheet,
  type MessageContactKind,
} from '../../EmployeeNewMessageSheet';
import {
  ConversationActionsSheet,
  type ConversationActionKey,
} from '../../ConversationActionsSheet';
import { useAuth } from '../../../contexts/AuthContext';
import {
  deleteConversation,
  getConversationInboxFlags,
  getConversationPeer,
  getOrCreateConversation,
  getOrCreateConversationAsProvider,
  isConversationUnreadForParticipant,
  listEmployeeConversations,
  listMessages,
  markConversationRead,
  markConversationUnread,
  setConversationInboxFlag,
  sortConversationsForInbox,
  subscribeToConversationUpdates,
  type Conversation,
  type Message,
} from '../../../lib/messaging';
import { formatRelativeTime, profileDisplayName } from '../../../lib/format';

interface EmployeeMessagesScreenProps {
  externalComposeVisible?: boolean;
  onExternalComposeClose?: () => void;
}

export default function EmployeeMessagesScreen({
  externalComposeVisible,
  onExternalComposeClose,
}: EmployeeMessagesScreenProps = {}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [newMessageVisible, setNewMessageVisible] = useState(false);
  const [filter, setFilter] = useState<'read' | 'unread' | 'archived' | null>(null);
  const [actionConversation, setActionConversation] = useState<Conversation | null>(null);
  const [actionAnchorY, setActionAnchorY] = useState<number | null>(null);
  const [previewMessages, setPreviewMessages] = useState<Message[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (externalComposeVisible) setNewMessageVisible(true);
  }, [externalComposeVisible]);

  const closeNewMessage = () => {
    setNewMessageVisible(false);
    onExternalComposeClose?.();
  };

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setConversations(sortConversationsForInbox(await listEmployeeConversations(user.id), user.id));
    } catch (e) {
      console.error('EmployeeMessagesScreen load:', e);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await load();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      return subscribeToConversationUpdates(user.id, load);
    }, [user?.id, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const startChatWithContact = async (contactId: string, kind: MessageContactKind) => {
    closeNewMessage();
    try {
      const conversationId =
        kind === 'client'
          ? await getOrCreateConversationAsProvider(contactId)
          : await getOrCreateConversation(contactId);
      await load();
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversationId, returnTo: '/messages' },
      });
    } catch (e) {
      console.error('startChatWithContact:', e);
      Alert.alert('Error', 'Could not start a conversation.');
    }
  };

  const isConversationUnread = useCallback(
    (c: Conversation) => (user?.id ? isConversationUnreadForParticipant(c, user.id) : false),
    [user?.id]
  );

  const filtered = useMemo(() => {
    if (!user?.id) return [];
    let list = conversations;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const peer = getConversationPeer(c, user.id);
        const name = profileDisplayName(peer?.first_name, peer?.last_name).toLowerCase();
        const preview = (c.last_message_body || '').toLowerCase();
        return name.includes(q) || preview.includes(q);
      });
    }
    list = list.filter((c) => {
      const { is_archived } = getConversationInboxFlags(c, user.id);
      return filter === 'archived' ? is_archived : !is_archived;
    });
    if (filter === 'unread') list = list.filter(isConversationUnread);
    else if (filter === 'read') list = list.filter((c) => !isConversationUnread(c));
    return list;
  }, [conversations, search, filter, isConversationUnread, user?.id]);

  const { pinnedConversations, listConversations } = useMemo(() => {
    if (!user?.id || filter === 'archived') {
      return { pinnedConversations: [], listConversations: filtered };
    }

    const pinned: Conversation[] = [];
    const unpinned: Conversation[] = [];
    filtered.forEach((conversation) => {
      const flags = getConversationInboxFlags(conversation, user.id);
      if (flags.is_pinned) {
        pinned.push(conversation);
      } else {
        unpinned.push(conversation);
      }
    });
    return { pinnedConversations: pinned, listConversations: unpinned };
  }, [filtered, filter, user?.id]);

  const inboxCount = useMemo(() => {
    if (!user?.id) return 0;
    return conversations.filter((c) => !getConversationInboxFlags(c, user.id).is_archived).length;
  }, [conversations, user?.id]);

  const openConversation = (conversationId: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: conversationId, returnTo: '/messages' },
    });
  };

  const openConversationActions = (
    conversation: Conversation,
    event?: GestureResponderEvent
  ) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionConversation(conversation);
    setActionAnchorY(event?.nativeEvent.pageY ?? null);
    setPreviewMessages([]);
    setPreviewLoading(true);
    void listMessages(conversation.id)
      .then((msgs) => setPreviewMessages(msgs.slice(-3)))
      .catch((e) => console.error('preview messages:', e))
      .finally(() => setPreviewLoading(false));
  };

  const closeConversationActions = () => {
    setActionConversation(null);
    setActionAnchorY(null);
    setPreviewMessages([]);
    setPreviewLoading(false);
  };

  const runConversationAction = async (action: ConversationActionKey) => {
    const conversation = actionConversation;
    if (!conversation || !user?.id) return;
    closeConversationActions();

    const apply = async () => {
      switch (action) {
        case 'markRead':
          await markConversationRead(conversation.id);
          break;
        case 'markUnread':
          await markConversationUnread(conversation.id);
          break;
        case 'pin':
          await setConversationInboxFlag(conversation.id, 'pinned', true);
          break;
        case 'unpin':
          await setConversationInboxFlag(conversation.id, 'pinned', false);
          break;
        case 'mute':
          await setConversationInboxFlag(conversation.id, 'muted', true);
          break;
        case 'unmute':
          await setConversationInboxFlag(conversation.id, 'muted', false);
          break;
        case 'archive':
          await setConversationInboxFlag(conversation.id, 'archived', true);
          break;
        case 'unarchive':
          await setConversationInboxFlag(conversation.id, 'archived', false);
          break;
        case 'delete':
          await deleteConversation(conversation.id);
          break;
      }
      await load();
    };

    if (action === 'delete') {
      const peer = getConversationPeer(conversation, user.id);
      const name = profileDisplayName(peer?.first_name, peer?.last_name);
      Alert.alert(
        'Delete conversation?',
        `This permanently removes your chat with ${name} and all messages.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void apply().catch((e) => {
                console.error('deleteConversation:', e);
                Alert.alert('Error', 'Could not delete the conversation. Please try again.');
              });
            },
          },
        ]
      );
      return;
    }

    try {
      await apply();
    } catch (e) {
      console.error('runConversationAction:', action, e);
      Alert.alert('Error', 'Could not update the conversation. Please try again.');
    }
  };

  const actionSheetState = useMemo(() => {
    if (!actionConversation || !user?.id) {
      return { isUnread: false, isPinned: false, isMuted: false, isArchived: false };
    }
    const flags = getConversationInboxFlags(actionConversation, user.id);
    return {
      isUnread: isConversationUnread(actionConversation),
      isPinned: flags.is_pinned,
      isMuted: flags.is_muted,
      isArchived: flags.is_archived,
    };
  }, [actionConversation, user?.id, isConversationUnread]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerTitle}>Messages</Text>
              <Text style={styles.headerSubtitle}>
                {inboxCount} conversation{inboxCount === 1 ? '' : 's'}
              </Text>
            </View>
            {inboxCount > 0 ? (
              <View style={styles.headerBadge}>
                <Ionicons name="chatbubbles" size={14} color={theme.colors.headerText} />
                <Text style={styles.headerBadgeText}>{inboxCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations"
              placeholderTextColor={theme.colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            {(
              [
                { key: null, label: 'All' },
                { key: 'unread' as const, label: 'Unread' },
                { key: 'read' as const, label: 'Read' },
                { key: 'archived' as const, label: 'Archived' },
              ] as const
            ).map(({ key, label }) => {
              const active = filter === key;
              return (
                <Pressable
                  key={label}
                  style={[styles.filterPill, active ? styles.filterPillActive : styles.filterPillInactive]}
                  onPress={() => setFilter((current) => (current === key ? null : key))}
                >
                  <Text style={active ? styles.filterTextActive : styles.filterTextInactive}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {filter !== 'archived' ? (
            <View style={styles.pinnedSection}>
              <Text style={styles.sectionTitle}>Pinned</Text>
              {pinnedConversations.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pinnedScroll}
                >
                  {pinnedConversations.map((conversation) => {
                    const peer = user?.id ? getConversationPeer(conversation, user.id) : null;
                    const name = profileDisplayName(peer?.first_name, peer?.last_name);
                    const isUnread = isConversationUnread(conversation);
                    return (
                      <Pressable
                        key={conversation.id}
                        onPress={() => openConversation(conversation.id)}
                        onLongPress={(event) => openConversationActions(conversation, event)}
                        delayLongPress={360}
                        style={({ pressed }) => [styles.pinnedCardWrap, pressed && styles.pinnedCardPressed]}
                      >
                        <View style={[styles.pinnedCard, isUnread && styles.pinnedCardUnread]}>
                          <View style={styles.pinnedAvatarWrap}>
                            <ProviderAvatar name={name} size={52} />
                            {isUnread ? <View style={styles.pinnedUnreadDot} /> : null}
                          </View>
                          <Text style={styles.pinnedName} numberOfLines={2}>
                            {name}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.pinnedEmpty}>
                  <Ionicons name="pin-outline" size={18} color={theme.colors.muted} />
                  <Text style={styles.pinnedEmptyText}>
                    Long-press a conversation to pin it here
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {pinnedConversations.length === 0 && listConversations.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubbles-outline" size={36} color={theme.colors.secondary} />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                Message clients or other employees using the compose button.
              </Text>
            </View>
          ) : listConversations.length > 0 ? (
            <View style={styles.listSection}>
              {pinnedConversations.length > 0 ? (
                <Text style={styles.sectionTitle}>Recent</Text>
              ) : null}
              {listConversations.map((conversation) => {
                const peer = user?.id ? getConversationPeer(conversation, user.id) : null;
                const name = profileDisplayName(peer?.first_name, peer?.last_name);
                const isUnread = isConversationUnread(conversation);
                return (
                  <Pressable
                    key={conversation.id}
                    onPress={() => openConversation(conversation.id)}
                    onLongPress={(event) => openConversationActions(conversation, event)}
                    delayLongPress={360}
                    style={({ pressed }) => [
                      styles.messageRow,
                      isUnread && styles.messageRowUnread,
                      pressed && styles.messageRowPressed,
                    ]}
                  >
                    {isUnread ? <View style={styles.unreadAccent} /> : null}
                    <ProviderAvatar name={name} size={52} />
                    <View style={styles.messageContent}>
                      <View style={styles.messageHeader}>
                        <Text
                          style={[styles.messageName, isUnread && styles.messageNameUnread]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                      </View>
                      <View style={styles.messageFooter}>
                        <Text
                          style={[styles.messageText, isUnread && styles.messageTextUnread]}
                          numberOfLines={2}
                        >
                          {conversation.last_message_body || 'No messages yet'}
                        </Text>
                        {isUnread ? <View style={styles.unreadDot} /> : null}
                      </View>
                    </View>
                    <View style={styles.messageTrailing}>
                      <Text style={[styles.messageTime, isUnread && styles.messageTimeUnread]}>
                        {formatRelativeTime(
                          conversation.last_message_at || conversation.updated_at
                        )}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.chevron} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {user?.id ? (
        <EmployeeNewMessageSheet
          visible={newMessageVisible}
          employeeId={user.id}
          onClose={closeNewMessage}
          onSelect={startChatWithContact}
        />
      ) : null}

      <ConversationActionsSheet
        visible={actionConversation !== null}
        conversation={actionConversation}
        userId={user?.id}
        previewMessages={previewMessages}
        previewLoading={previewLoading}
        anchorY={actionAnchorY}
        state={actionSheetState}
        onClose={closeConversationActions}
        onAction={(action) => {
          void runConversationAction(action);
        }}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.inboxBackground },
    headerSafeArea: {
      backgroundColor: theme.colors.headerBackground,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
    },
    header: { paddingTop: theme.spacing.md },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 32,
      color: theme.colors.headerText,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.headerSubtext,
      marginTop: 4,
    },
    headerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    headerBadgeText: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.headerText,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.inboxSurface,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.sm,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    searchInput: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      padding: 0,
    },
    filtersScroll: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg, paddingRight: theme.spacing.sm },
    filterPill: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.full,
    },
    filterPillActive: {
      backgroundColor: theme.colors.secondary,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    filterPillInactive: {
      backgroundColor: theme.colors.inboxSurface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterTextActive: {
      color: theme.colors.textInverted,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.subbody,
    },
    filterTextInactive: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
    },
    sectionTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.muted,
      marginBottom: theme.spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    pinnedSection: {
      marginBottom: theme.spacing.lg,
    },
    pinnedScroll: {
      gap: theme.spacing.sm,
    },
    pinnedCardWrap: {
      borderRadius: theme.borderRadius.lg,
    },
    pinnedCardPressed: {
      opacity: 0.88,
    },
    pinnedCard: {
      width: 100,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.inboxSurface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    pinnedCardUnread: {
      borderColor: theme.colors.secondary,
      backgroundColor: theme.colors.accentSoft,
    },
    pinnedAvatarWrap: {
      position: 'relative',
    },
    pinnedUnreadDot: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.secondary,
      borderWidth: 2,
      borderColor: theme.colors.inboxSurface,
    },
    pinnedName: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    pinnedEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.inboxSurface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    pinnedEmptyText: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.muted,
    },
    listSection: {
      gap: theme.spacing.sm,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.inboxSurface,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    messageRowUnread: {
      backgroundColor: theme.colors.accentSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    messageRowPressed: {
      backgroundColor: theme.colors.inboxRowPressed,
    },
    unreadAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: theme.colors.secondary,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderBottomLeftRadius: theme.borderRadius.lg,
    },
    messageContent: { flex: 1 },
    messageHeader: { marginBottom: 4 },
    messageName: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    messageNameUnread: {
      fontFamily: theme.typography.fontFamily.bold,
    },
    messageTime: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 11,
      color: theme.colors.muted,
    },
    messageTimeUnread: {
      color: theme.colors.secondary,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    messageTrailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'center',
    },
    messageFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    messageText: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.muted,
      flex: 1,
      lineHeight: 20,
    },
    messageTextUnread: {
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textPrimary,
    },
    unreadDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: theme.colors.secondary,
    },
    emptyCard: {
      alignItems: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.inboxSurface,
      borderRadius: theme.borderRadius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
    },
    emptyTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.title,
      color: theme.colors.textPrimary,
    },
    emptySubtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    bottomSpacer: { height: 110 },
  });
}
