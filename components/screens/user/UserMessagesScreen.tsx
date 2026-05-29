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
import { Card } from '../../Card';
import { ProviderAvatar } from '../../ProviderAvatar';
import { NewMessageSheet } from '../../NewMessageSheet';
import {
  ConversationActionsSheet,
  type ConversationActionKey,
} from '../../ConversationActionsSheet';
import { useAuth } from '../../../contexts/AuthContext';
import {
  deleteConversation,
  getConversationInboxFlags,
  getOrCreateConversation,
  isConversationUnreadForParticipant,
  listMessages,
  listUserConversations,
  markConversationRead,
  markConversationUnread,
  setConversationInboxFlag,
  sortConversationsForInbox,
  subscribeToConversationUpdates,
  type Conversation,
  type Message,
} from '../../../lib/messaging';
import { formatRelativeTime, profileDisplayName } from '../../../lib/format';

interface UserMessagesScreenProps {
  externalComposeVisible?: boolean;
  onExternalComposeClose?: () => void;
}

export default function UserMessagesScreen({
  externalComposeVisible,
  onExternalComposeClose,
}: UserMessagesScreenProps = {}) {
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
      const list = sortConversationsForInbox(await listUserConversations(user.id), user.id);
      setConversations(list);
    } catch (e) {
      console.error('UserMessagesScreen load:', e);
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

  const startChatWithProvider = async (providerId: string) => {
    closeNewMessage();
    try {
      const conversationId = await getOrCreateConversation(providerId);
      await load();
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversationId, returnTo: '/messages' },
      });
    } catch (e) {
      console.error('startChatWithProvider:', e);
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
        const name = profileDisplayName(
          c.provider?.first_name,
          c.provider?.last_name
        ).toLowerCase();
        const preview = (c.last_message_body || '').toLowerCase();
        return name.includes(q) || preview.includes(q);
      });
    }

    list = list.filter((c) => {
      const { is_archived } = getConversationInboxFlags(c, user.id);
      return filter === 'archived' ? is_archived : !is_archived;
    });

    if (filter === 'unread') {
      list = list.filter(isConversationUnread);
    } else if (filter === 'read') {
      list = list.filter((c) => !isConversationUnread(c));
    }
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
      const name = profileDisplayName(
        conversation.provider?.first_name,
        conversation.provider?.last_name
      );
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

  const openConversation = (conversationId: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: conversationId, returnTo: '/messages' },
    });
  };

  const renderConversationRow = (conversation: Conversation) => {
    const name = profileDisplayName(
      conversation.provider?.first_name,
      conversation.provider?.last_name
    );
    const isUnread = isConversationUnread(conversation);
    const inboxFlags = user?.id ? getConversationInboxFlags(conversation, user.id) : null;

    return (
      <Pressable
        key={conversation.id}
        onPress={() => openConversation(conversation.id)}
        onLongPress={(event) => openConversationActions(conversation, event)}
        delayLongPress={360}
      >
        <Card style={styles.messageCard} variant="outlined">
          <ProviderAvatar name={name} size={48} />
          <View style={styles.messageContent}>
            <View style={styles.messageHeader}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.messageName, isUnread && styles.messageNameUnread]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                {inboxFlags?.is_muted ? (
                  <Ionicons
                    name="notifications-off-outline"
                    size={14}
                    color={theme.colors.textSecondary}
                    style={styles.rowIcon}
                  />
                ) : null}
              </View>
              <Text style={[styles.messageTime, isUnread && styles.messageTimeUnread]}>
                {formatRelativeTime(conversation.last_message_at || conversation.updated_at)}
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
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {inboxCount} conversation{inboxCount === 1 ? '' : 's'}
          </Text>
        </View>
      </SafeAreaView>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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

          {pinnedConversations.length > 0 ? (
            <View style={styles.pinnedSection}>
              <Text style={styles.sectionTitle}>Pinned</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pinnedScroll}
              >
                {pinnedConversations.map((conversation) => {
                  const name = profileDisplayName(
                    conversation.provider?.first_name,
                    conversation.provider?.last_name
                  );
                  const isUnread = isConversationUnread(conversation);
                  return (
                    <Pressable
                      key={conversation.id}
                      onPress={() => openConversation(conversation.id)}
                      onLongPress={(event) => openConversationActions(conversation, event)}
                      delayLongPress={360}
                    >
                      <Card style={styles.pinnedCard} variant="outlined">
                        <View style={styles.pinnedAvatarWrap}>
                          <ProviderAvatar name={name} size={52} />
                          {isUnread ? <View style={styles.pinnedUnreadDot} /> : null}
                        </View>
                        <Text style={styles.pinnedName} numberOfLines={2}>
                          {name}
                        </Text>
                      </Card>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {pinnedConversations.length === 0 && listConversations.length === 0 ? (
            <Card style={styles.emptyCard} variant="outlined">
              <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the compose button in the tab bar to message a provider.
              </Text>
            </Card>
          ) : listConversations.length > 0 ? (
            <View style={styles.listSection}>
              {pinnedConversations.length > 0 ? (
                <Text style={styles.sectionTitle}>Recent</Text>
              ) : null}
              {listConversations.map(renderConversationRow)}
            </View>
          ) : null}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      <NewMessageSheet
        visible={newMessageVisible}
        onClose={closeNewMessage}
        onSelectProvider={startChatWithProvider}
      />

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
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerSafeArea: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    header: {
      paddingTop: theme.spacing.md,
    },
    headerTitle: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.h1,
      color: theme.colors.textPrimary,
    },
    headerSubtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      padding: theme.spacing.md,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      padding: 0,
    },
    filtersScroll: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
    },
    filterPillActive: {
      backgroundColor: theme.colors.textPrimary,
      borderColor: theme.colors.textPrimary,
    },
    filterPillInactive: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    filterTextActive: {
      color: theme.colors.textInverted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
    },
    filterTextInactive: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
    },
    sectionTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.title,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    pinnedSection: {
      marginBottom: theme.spacing.lg,
    },
    pinnedScroll: {
      gap: theme.spacing.sm,
    },
    pinnedCard: {
      width: 96,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      gap: theme.spacing.sm,
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
      borderColor: theme.colors.surface,
    },
    pinnedName: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    listSection: {
      gap: theme.spacing.sm,
    },
    messageCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    messageContent: {
      flex: 1,
    },
    messageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
      gap: theme.spacing.sm,
    },
    nameRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },
    rowIcon: {
      marginLeft: 4,
    },
    messageName: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    messageNameUnread: {
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    messageTime: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
    },
    messageTimeUnread: {
      color: theme.colors.secondary,
      fontFamily: theme.typography.fontFamily.medium,
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
      color: theme.colors.textSecondary,
      flex: 1,
    },
    messageTextUnread: {
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textPrimary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.secondary,
    },
    emptyCard: {
      alignItems: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    emptySubtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    bottomSpacer: {
      height: 110,
    },
  });
}
