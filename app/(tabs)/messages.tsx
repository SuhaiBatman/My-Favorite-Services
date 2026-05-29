import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';
import { Card } from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import UserMessagesScreen from '../../components/screens/user/UserMessagesScreen';
import EmployeeMessagesScreen from '../../components/screens/employee/EmployeeMessagesScreen';
interface MessagesScreenProps {
  externalComposeVisible?: boolean;
  onExternalComposeClose?: () => void;
}

export default function MessagesScreen(props: MessagesScreenProps = {}) {
  const { role, hasRole } = useAuth();
  if (hasRole('employee')) {
    return <EmployeeMessagesScreen {...props} />;
  }
  if (role === 'user') {
    return <UserMessagesScreen {...props} />;
  }
  return <LegacyMessagesScreen />;
}

function LegacyMessagesScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const router = useRouter();
const messagesData = [
  {
    id: '1',
    name: 'Alex Rivera',
    text: "I've confirmed your appointm...",
    time: '2m ago',
    unread: true,
    online: true,
  },
  {
    id: '2',
    name: 'Marcus Chen',
    text: 'The quarterly report is ready for you...',
    time: '1h ago',
    unread: false,
    online: false,
  },
  {
    id: '3',
    name: 'Sarah Jenkins',
    text: "Thank you for the feedback. I'll inco...",
    time: '3h ago',
    unread: false,
    online: false,
  },
  {
    id: '4',
    name: 'David Wilson',
    text: "The logistics for next week's semin...",
    time: 'Yesterday',
    unread: false,
    online: false,
  },
  {
    id: '5',
    name: 'Elena Petrov',
    text: 'Great meeting today. Looking forw...',
    time: 'Yesterday',
    unread: false,
    online: false,
  },
];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity>
            <Ionicons name="menu-outline" size={28} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity>
            <Ionicons name="share-outline" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search conversations"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          <TouchableOpacity style={[styles.filterPill, styles.filterPillActive]}>
            <Text style={styles.filterTextActive}>All Messages</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterPill, styles.filterPillInactive]}>
            <Text style={styles.filterTextInactive}>Unread</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterPill, styles.filterPillInactive]}>
            <Text style={styles.filterTextInactive}>Archived</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      >
        {messagesData.map((msg) => (
          <TouchableOpacity key={msg.id} onPress={() => router.push(`/chat/${msg.id}`)}>
            <Card style={styles.messageCard} variant="outlined">
              <View style={styles.avatarContainer}>
                <View style={styles.avatarPlaceholder}>
                   <Ionicons name="image-outline" size={20} color={theme.colors.textSecondary} />
                </View>
                {msg.online && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.messageContent}>
                <View style={styles.messageHeader}>
                  <Text style={styles.messageName}>{msg.name}</Text>
                  <Text style={styles.messageTime}>{msg.time}</Text>
                </View>
                <View style={styles.messageFooter}>
                  <Text style={[styles.messageText, msg.unread && styles.messageTextUnread]} numberOfLines={1}>
                    {msg.text}
                  </Text>
                  {msg.unread && <View style={styles.unreadDot} />}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* FAB is rendered in the tab bar 4th slot via TabFABContext */}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
  },
  searchContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
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
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  filtersContainer: {
    marginBottom: theme.spacing.md,
  },
  filtersScroll: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterPill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: theme.colors.textPrimary, // Black pill
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
  messagesList: {
    paddingHorizontal: theme.spacing.md,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  avatarContainer: {
    marginRight: theme.spacing.md,
    position: 'relative',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageName: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  messageTime: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  messageTextUnread: {
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  bottomSpacer: {
    height: 110, // Space for tab bar
  },
  });
}