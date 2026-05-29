import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';
import { ProviderAvatar } from '../../components/ProviderAvatar';
import { useAuth } from '../../contexts/AuthContext';
import {
  getConversation,
  listMessages,
  markConversationRead,
  sendMessage,
  subscribeToMessages,
  type Conversation,
  type Message,
} from '../../lib/messaging';
import { formatChatDateDivider, formatMessageTime, profileDisplayName } from '../../lib/format';

type ListItem =
  | { type: 'date'; id: string; label: string }
  | { type: 'message'; id: string; message: Message };

const TAPBACKS = ['❤️', '👍', '👎', 'HA', '!!', '?'];

function messagePreview(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

function buildListItems(messages: Message[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const label = formatChatDateDivider(msg.created_at);
    if (label !== lastDate) {
      items.push({ type: 'date', id: `date-${msg.id}`, label });
      lastDate = label;
    }
    items.push({ type: 'message', id: msg.id, message: msg });
  }
  return items;
}

export default function ChatScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { id, returnTo } = useLocalSearchParams<{ id: string; returnTo?: string }>();
  const conversationId = typeof id === 'string' ? id : id?.[0];
  const backRoute = typeof returnTo === 'string' ? returnTo : returnTo?.[0];
  const router = useRouter();
  const { user } = useAuth();
  const listRef = useRef<FlatList<ListItem>>(null);
  const { height: screenHeight } = useWindowDimensions();
  const messagePopAnim = useRef(new Animated.Value(0)).current;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedMessageAnchorY, setSelectedMessageAnchorY] = useState<number | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    try {
      const [conv, msgs] = await Promise.all([
        getConversation(conversationId),
        listMessages(conversationId),
      ]);
      setConversation(conv);
      setMessages(msgs);
    } catch (e) {
      console.error('ChatScreen load:', e);
    }
  }, [conversationId]);

  const markRead = useCallback(async () => {
    if (!conversationId) return;
    try {
      await markConversationRead(conversationId);
    } catch (e) {
      console.error('markConversationRead:', e);
    }
  }, [conversationId]);
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await load();
      if (active) {
        setLoading(false);
        await markRead();
      }
    })();
    return () => {
      active = false;
    };
  }, [load, markRead]);

  useFocusEffect(
    useCallback(() => {
      void markRead();
    }, [markRead])
  );

  useEffect(() => {
    if (!conversationId) return;
    return subscribeToMessages(conversationId, (message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      void markReadRef.current();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
  }, [conversationId]);

  useEffect(() => {
    if (!selectedMessage) {
      messagePopAnim.setValue(0);
      return;
    }
    Animated.spring(messagePopAnim, {
      toValue: 1,
      speed: 25,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [messagePopAnim, selectedMessage]);

  const listItems = buildListItems(messages);
  const providerName = profileDisplayName(
    conversation?.provider?.first_name,
    conversation?.provider?.last_name
  );
  const providerSubtitle =
    conversation?.provider?.job_title ||
    conversation?.provider?.business_name ||
    'Service Provider';

  const handleBack = () => {
    if (backRoute) {
      router.navigate(backRoute as '/messages');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate('/messages');
  };

  const handleSend = async () => {
    if (!conversationId || !user?.id || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    setReplyTarget(null);
    try {
      const message = await sendMessage(conversationId, user.id, text);
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error('sendMessage:', e);
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const openMessageActions = (message: Message, event: GestureResponderEvent) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessageAnchorY(event.nativeEvent.pageY);
    setSelectedMessage(message);
  };

  const addReaction = (reaction: string) => {
    if (!selectedMessage) return;
    setMessageReactions((current) => ({
      ...current,
      [selectedMessage.id]: current[selectedMessage.id] === reaction ? '' : reaction,
    }));
    setSelectedMessageAnchorY(null);
    setSelectedMessage(null);
  };

  const replyToSelectedMessage = () => {
    if (!selectedMessage) return;
    setReplyTarget(selectedMessage);
    setSelectedMessageAnchorY(null);
    setSelectedMessage(null);
  };

  const closeMessageActions = () => {
    setSelectedMessage(null);
    setSelectedMessageAnchorY(null);
  };

  const messageActionTop = Math.max(
    92,
    Math.min((selectedMessageAnchorY ?? screenHeight / 2) - 112, screenHeight - 390)
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.secondary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerInfo}
            onPress={() => {
              if (conversation?.provider_id) {
                router.push(`/profile/${conversation.provider_id}`);
              }
            }}
          >
            <ProviderAvatar name={providerName} size={40} />
            <View>
              <Text style={styles.headerName}>{providerName}</Text>
              <Text style={styles.headerStatus}>{providerSubtitle}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            if (item.type === 'date') {
              return (
                <View style={styles.dateDivider}>
                  <View style={styles.datePill}>
                    <Text style={styles.dateText}>{item.label}</Text>
                  </View>
                </View>
              );
            }

            const isSent = item.message.sender_id === user?.id;
            const reaction = messageReactions[item.message.id];
            return (
              <Pressable
                onLongPress={(event) => openMessageActions(item.message, event)}
                delayLongPress={260}
                style={isSent ? styles.messageRowSent : styles.messageRowReceived}
              >
                <View style={isSent ? styles.messageBubbleSent : styles.messageBubbleReceived}>
                  <Text style={isSent ? styles.messageTextSent : styles.messageTextReceived}>
                    {item.message.body}
                  </Text>
                  {reaction ? (
                    <View
                      style={[
                        styles.reactionBadge,
                        isSent ? styles.reactionBadgeSent : styles.reactionBadgeReceived,
                      ]}
                    >
                      <Text style={styles.reactionBadgeText}>{reaction}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.timeText}>{formatMessageTime(item.message.created_at)}</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>Say hello to {providerName}</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          {replyTarget ? (
            <View style={styles.replyComposer}>
              <View style={styles.replyAccent} />
              <View style={styles.replyCopy}>
                <Text style={styles.replyLabel}>Replying to message</Text>
                <Text style={styles.replyText} numberOfLines={1}>
                  {messagePreview(replyTarget.body)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.replyClose}
                onPress={() => setReplyTarget(null)}
              >
                <Ionicons name="close-circle" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.composerRow}>
            <TouchableOpacity style={styles.composerIconButton}>
              <Ionicons name="add" size={22} color={theme.colors.muted} />
            </TouchableOpacity>
            <View style={styles.textInputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="iMessage"
                placeholderTextColor={theme.colors.textSecondary}
                value={draft}
                onChangeText={setDraft}
                multiline
                editable={!sending}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!draft.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={theme.colors.bubbleSentText} />
              ) : (
                <Ionicons name="send" size={16} color={theme.colors.bubbleSentText} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={selectedMessage !== null}
          transparent
          animationType="none"
          onRequestClose={closeMessageActions}
        >
          <View style={styles.actionsOverlay}>
            <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFill}
              onPress={closeMessageActions}
            />
            {selectedMessage ? (
              <Animated.View
                style={[
                  styles.messageActionStack,
                  {
                    top: messageActionTop,
                    opacity: messagePopAnim,
                    transform: [
                      {
                        scale: messagePopAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.92, 1],
                        }),
                      },
                      {
                        translateY: messagePopAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 0],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="box-none"
              >
                <View
                  style={[
                    styles.tapbackBar,
                    selectedMessage.sender_id === user?.id
                      ? styles.tapbackBarSent
                      : styles.tapbackBarReceived,
                  ]}
                >
                  {TAPBACKS.map((reaction) => (
                    <TouchableOpacity
                      key={reaction}
                      style={styles.tapbackButton}
                      onPress={() => addReaction(reaction)}
                    >
                      <Text style={styles.tapbackText}>{reaction}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View
                  style={
                    selectedMessage.sender_id === user?.id
                      ? styles.actionPreviewSent
                      : styles.actionPreviewReceived
                  }
                >
                  <View
                    style={
                      selectedMessage.sender_id === user?.id
                        ? styles.messageBubbleSent
                        : styles.messageBubbleReceived
                    }
                  >
                    <Text
                      style={
                        selectedMessage.sender_id === user?.id
                          ? styles.messageTextSent
                          : styles.messageTextReceived
                      }
                    >
                      {selectedMessage.body}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.messageMenu,
                    selectedMessage.sender_id === user?.id
                      ? styles.messageMenuSent
                      : styles.messageMenuReceived,
                  ]}
                >
                  <TouchableOpacity style={styles.messageMenuRow} onPress={replyToSelectedMessage}>
                    <Text style={styles.messageMenuLabel}>Reply</Text>
                    <Ionicons name="arrow-undo-outline" size={20} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <View style={styles.messageMenuDivider} />
                  <TouchableOpacity
                    style={styles.messageMenuRow}
                    onPress={async () => {
                      await Clipboard.setStringAsync(selectedMessage.body);
                      closeMessageActions();
                    }}
                  >
                    <Text style={styles.messageMenuLabel}>Copy Text</Text>
                    <Ionicons name="copy-outline" size={20} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <View style={styles.messageMenuDivider} />
                  <TouchableOpacity
                    style={styles.messageMenuRow}
                    onPress={closeMessageActions}
                  >
                    <Text style={styles.messageMenuLabel}>More...</Text>
                    <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ) : null}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.inboxBackground,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.inboxSurface,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    backgroundColor: theme.colors.frostedPanel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.inboxSeparator,
  },
  backButton: {
    marginRight: theme.spacing.sm,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerName: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  headerStatus: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  chatContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyChatText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
  },
  dateDivider: {
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  datePill: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dateText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 12,
    color: theme.colors.muted,
  },
  messageRowReceived: {
    alignItems: 'flex-start',
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageBubbleReceived: {
    backgroundColor: theme.colors.bubbleReceived,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    marginBottom: 4,
    position: 'relative',
  },
  messageTextReceived: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 17,
    color: theme.colors.bubbleReceivedText,
    lineHeight: 22,
  },
  messageRowSent: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageBubbleSent: {
    backgroundColor: theme.colors.bubbleSent,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    borderBottomRightRadius: 5,
    marginBottom: 4,
    position: 'relative',
  },
  messageTextSent: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 17,
    color: theme.colors.bubbleSentText,
    lineHeight: 22,
  },
  reactionBadge: {
    position: 'absolute',
    bottom: -13,
    minWidth: 28,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.inboxSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inboxSeparator,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
    elevation: 2,
  },
  reactionBadgeSent: {
    left: -10,
  },
  reactionBadgeReceived: {
    right: -10,
  },
  reactionBadgeText: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  timeText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 10,
    color: theme.colors.muted,
  },
  inputContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: theme.colors.composerBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.inboxSeparator,
    gap: 8,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: theme.colors.inboxSurface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inboxSeparator,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxHeight: 120,
  },
  textInput: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 17,
    color: theme.colors.textPrimary,
    minHeight: 22,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.bubbleSent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inboxSurface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inboxSeparator,
  },
  replyAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: theme.colors.link,
    marginRight: 9,
  },
  replyCopy: {
    flex: 1,
  },
  replyLabel: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 12,
    color: theme.colors.link,
  },
  replyText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 1,
  },
  replyClose: {
    paddingLeft: 8,
  },
  actionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  messageActionStack: {
    position: 'absolute',
    left: 22,
    right: 22,
    gap: 10,
  },
  tapbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inboxSurface,
    borderRadius: 24,
    paddingHorizontal: 5,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  tapbackBarSent: {
    alignSelf: 'flex-end',
    marginRight: 2,
  },
  tapbackBarReceived: {
    alignSelf: 'flex-start',
    marginLeft: 2,
  },
  tapbackButton: {
    minWidth: 38,
    height: 36,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapbackText: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  actionPreviewSent: {
    alignItems: 'flex-end',
  },
  actionPreviewReceived: {
    alignItems: 'flex-start',
  },
  messageMenu: {
    width: 280,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.colors.frostedPanel,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  messageMenuSent: {
    alignSelf: 'flex-end',
  },
  messageMenuReceived: {
    alignSelf: 'flex-start',
  },
  messageMenuRow: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.inboxSeparator,
    marginLeft: 16,
  },
  messageMenuLabel: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  });
}