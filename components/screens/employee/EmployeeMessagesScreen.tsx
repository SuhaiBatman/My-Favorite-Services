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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type { AppTheme } from '../../../constants/theme';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { useThemedStyles } from '../../../hooks/use-themed-styles';
import { Card } from '../../Card';
import { ProviderAvatar } from '../../ProviderAvatar';
import {
  EmployeeNewMessageSheet,
  type MessageContactKind,
} from '../../EmployeeNewMessageSheet';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getConversationInboxFlags,
  getConversationPeer,
  getOrCreateConversation,
  getOrCreateConversationAsProvider,
  isConversationUnreadForParticipant,
  listEmployeeConversations,
  subscribeToConversationUpdates,
  type Conversation,
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
      setConversations(await listEmployeeConversations(user.id));
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

          {filtered.length === 0 ? (
            <Card style={styles.emptyCard} variant="outlined">
              <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                Message clients or other employees using the compose button.
              </Text>
            </Card>
          ) : (
            filtered.map((conversation) => {
              const peer = user?.id ? getConversationPeer(conversation, user.id) : null;
              const name = profileDisplayName(peer?.first_name, peer?.last_name);
              const isUnread = isConversationUnread(conversation);
              return (
                <Pressable
                  key={conversation.id}
                  onPress={() => openConversation(conversation.id)}
                >
                  <Card style={styles.messageCard} variant="outlined">
                    <ProviderAvatar name={name} size={48} />
                    <View style={styles.messageContent}>
                      <View style={styles.messageHeader}>
                        <Text
                          style={[styles.messageName, isUnread && styles.messageNameUnread]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        <Text style={[styles.messageTime, isUnread && styles.messageTimeUnread]}>
                          {formatRelativeTime(
                            conversation.last_message_at || conversation.updated_at
                          )}
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
            })
          )}

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
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    headerSafeArea: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    header: { paddingTop: theme.spacing.md },
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
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: theme.spacing.md },
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
    filtersScroll: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
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
    messageCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    messageContent: { flex: 1 },
    messageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
      gap: theme.spacing.sm,
    },
    messageName: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    messageNameUnread: { fontFamily: theme.typography.fontFamily.semiBold },
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
    emptyCard: { alignItems: 'center', padding: theme.spacing.xl, gap: theme.spacing.sm },
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
    bottomSpacer: { height: 110 },
  });
}
