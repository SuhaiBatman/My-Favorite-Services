import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';
import { useFullScreenSheetTopInset } from '../../hooks/use-full-screen-sheet-top-inset';
import { Card } from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { DEV_USER_IDS, APP_ROUTES } from '../../constants/dev';
import UserHomeScreen from '../../components/screens/user/UserHomeScreen';
import EmployeeHomeScreen from '../../components/screens/employee/EmployeeHomeScreen';
// --- Data ---

type Service = {
  id: string;
  name: string;
  role: string;
  service: string;
  duration: string;
  price: number;
  rating: number;
  nextAvailable: string;
  category: string;
};

const ALL_PROVIDERS: Service[] = [
  { id: '1', name: 'Dr. Elena Sterling', role: 'Senior Dermatologist', service: 'Initial Consultation', duration: '30 min', price: 120, rating: 4.9, nextAvailable: 'Tomorrow, 10:00 AM', category: 'Medical' },
  { id: '2', name: 'Julian Vance', role: 'Master Barber & Grooming Specialist', service: 'The Signature Cut', duration: '45 min', price: 65, rating: 4.8, nextAvailable: 'Today, 3:00 PM', category: 'Grooming' },
  { id: '3', name: 'Sophia Lane', role: 'Licensed Massage Therapist', service: 'Deep Tissue Massage', duration: '60 min', price: 95, rating: 5.0, nextAvailable: 'Wed, 11:00 AM', category: 'Wellness' },
  { id: '4', name: 'Marcus Reid', role: 'Personal Trainer', service: 'Strength & Conditioning', duration: '50 min', price: 80, rating: 4.7, nextAvailable: 'Tomorrow, 7:00 AM', category: 'Fitness' },
  { id: '5', name: 'Priya Nair', role: 'Nutritionist & Diet Coach', service: 'Meal Plan Review', duration: '45 min', price: 70, rating: 4.9, nextAvailable: 'Thu, 2:00 PM', category: 'Wellness' },
  { id: '6', name: 'Alex Carter', role: 'Hair Colorist & Stylist', service: 'Full Color & Toner', duration: '90 min', price: 150, rating: 4.6, nextAvailable: 'Fri, 1:00 PM', category: 'Grooming' },
  { id: '7', name: 'Dr. James Wu', role: 'Sports Medicine Physician', service: 'Injury Assessment', duration: '30 min', price: 200, rating: 4.9, nextAvailable: 'Next Mon, 9:00 AM', category: 'Medical' },
  { id: '8', name: 'Nina Torres', role: 'Esthetician & Skin Specialist', service: 'HydraFacial Treatment', duration: '75 min', price: 110, rating: 4.8, nextAvailable: 'Sat, 10:00 AM', category: 'Beauty' },
];

const CATEGORY_ICONS: Record<string, string> = {
  Medical: 'medkit-outline',
  Grooming: 'cut-outline',
  Wellness: 'leaf-outline',
  Fitness: 'barbell-outline',
  Beauty: 'sparkles-outline',
};

// --- Sub-components ---

function createStarStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    text: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 12,
      color: theme.colors.textPrimary,
    },
  });
}

function createBadgeStyles(theme: AppTheme) {
  return StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
    },
    text: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 10,
      color: theme.colors.primary,
    },
  });
}

const StarRating = ({ rating }: { rating: number }) => {
  const { theme } = useAppTheme();
  const starStyles = useThemedStyles(createStarStyles);
  return (
    <View style={starStyles.row}>
      <Ionicons name="star" size={12} color={theme.colors.primary} />
      <Text style={starStyles.text}>{rating.toFixed(1)}</Text>
    </View>
  );
};

const CategoryBadge = ({ category }: { category: string }) => {
  const { theme } = useAppTheme();
  const badgeStyles = useThemedStyles(createBadgeStyles);
  return (
    <View style={badgeStyles.pill}>
      <Ionicons name={(CATEGORY_ICONS[category] ?? 'ellipse-outline') as any} size={11} color={theme.colors.primary} />
      <Text style={badgeStyles.text}>{category}</Text>
    </View>
  );
};

// --- Main Screen ---

interface HomeScreenProps {
  externalModalVisible?: boolean;
  onExternalModalClose?: () => void;
}

export default function HomeScreen(props: HomeScreenProps = {}) {
  const { role, hasRole } = useAuth();
  if (hasRole('employee')) {
    return <EmployeeHomeScreen {...props} />;
  }
  if (hasRole('user')) {
    return <UserHomeScreen {...props} />;
  }
  return <ProviderHomeScreen {...props} />;
}

function ProviderHomeScreen({ externalModalVisible, onExternalModalClose }: HomeScreenProps = {}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const topInset = useFullScreenSheetTopInset();
  const { user, role, roles, setRole } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [savedServices, setSavedServices] = useState<Service[]>([
    ALL_PROVIDERS[0], // Dr. Elena Sterling
    ALL_PROVIDERS[1], // Julian Vance
    ALL_PROVIDERS[2], // Sophia Lane
  ]);
  const [modalVisible, setModalVisible] = useState(false);
  const [devModalVisible, setDevModalVisible] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const isDevUser = user && DEV_USER_IDS.includes(user.id);

  // Sync external visibility from tab bar FAB
  useEffect(() => {
    if (externalModalVisible) {
      setModalVisible(true);
    }
  }, [externalModalVisible]);

  const handleModalClose = () => {
    setModalVisible(false);
    setModalSearch('');
    onExternalModalClose?.();
  };

  const filteredServices = useMemo(() =>
    savedServices.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [savedServices, searchQuery]
  );

  const searchResults = useMemo(() =>
    ALL_PROVIDERS.filter(p =>
      !savedServices.some(s => s.id === p.id) &&
      (p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
       p.role.toLowerCase().includes(modalSearch.toLowerCase()) ||
       p.service.toLowerCase().includes(modalSearch.toLowerCase()))
    ),
    [modalSearch, savedServices]
  );

  const addProvider = (provider: Service) => {
    setSavedServices(prev => [...prev, provider]);
    handleModalClose();
  };

  const removeProvider = (id: string) => {
    setSavedServices(prev => prev.filter(s => s.id !== id));
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerGreeting}>
              Good morning{user?.user_metadata?.first_name ? `, ${user.user_metadata.first_name}` : ''}
            </Text>
            <Text style={styles.headerTitle}>My Favorite Services</Text>
          </View>
          <View style={styles.headerRight}>
            {isDevUser && (
              <TouchableOpacity 
                style={[styles.notifBtn, styles.devBtn]} 
                onPress={() => setDevModalVisible(true)}
              >
                <Ionicons name="code-slash" size={20} color={theme.colors.textInverted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.notifBtn}>
              <Ionicons name="notifications-outline" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your services..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{savedServices.length}</Text>
          <Text style={styles.statLabel}>Saved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {savedServices.filter(s => s.nextAvailable.toLowerCase().includes('today')).length}
          </Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {[...new Set(savedServices.map(s => s.category))].length}
          </Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {searchQuery ? `Results for "${searchQuery}"` : 'Your Providers'}
          </Text>
          <Text style={styles.sectionCount}>{filteredServices.length} saved</Text>
        </View>

        {filteredServices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>Try a different search term</Text>
          </View>
        ) : (
          filteredServices.map((item) => (
            <Card key={item.id} style={styles.serviceCard} variant="elevated">
              <View style={styles.cardTop}>
                {/* Avatar */}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.providerName}>{item.name}</Text>
                  <Text style={styles.providerRole} numberOfLines={1}>{item.role}</Text>
                  <View style={styles.cardMeta}>
                    <StarRating rating={item.rating} />
                    <CategoryBadge category={item.category} />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeProvider(item.id)}
                >
                  <Ionicons name="heart" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardBottom}>
                <View style={styles.serviceRow}>
                  <Ionicons name="cut-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.serviceName}>{item.service}</Text>
                  <Text style={styles.serviceDuration}>{item.duration}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <View style={styles.availabilityRow}>
                    <Ionicons name="time-outline" size={13} color={theme.colors.success} />
                    <Text style={styles.availabilityText}>{item.nextAvailable}</Text>
                  </View>
                  <Text style={styles.priceText}>${item.price}</Text>
                </View>
              </View>
            </Card>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* FAB is rendered in the tab bar 4th slot via TabFABContext */}

      {/* Add Provider Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleModalClose}
      >
        <View style={styles.modal}>
          <View style={[styles.modalHeader, { paddingTop: topInset + theme.spacing.md }]}>
            <Text style={styles.modalTitle}>Add a Provider</Text>
            <TouchableOpacity onPress={handleModalClose}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearch}>
            <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search providers, specialties..."
              placeholderTextColor={theme.colors.textSecondary}
              value={modalSearch}
              onChangeText={setModalSearch}
              autoFocus
            />
          </View>

          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                {modalSearch.length === 0 ? (
                  <>
                    <Ionicons name="people-outline" size={40} color={theme.colors.border} />
                    <Text style={styles.emptyTitle}>Search for a provider</Text>
                    <Text style={styles.emptySubtitle}>
                      Try &quot;dermatologist&quot;, &quot;barber&quot;, or a name
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="search-outline" size={40} color={theme.colors.border} />
                    <Text style={styles.emptyTitle}>No providers found</Text>
                    <Text style={styles.emptySubtitle}>Try a different search term</Text>
                  </>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.resultCard} onPress={() => addProvider(item)}>
                <View style={[styles.avatar, styles.resultAvatar]}>
                  <Text style={styles.avatarText}>{item.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultRole} numberOfLines={1}>{item.role}</Text>
                  <View style={styles.resultMeta}>
                    <StarRating rating={item.rating} />
                    <Text style={styles.resultPrice}>${item.price} / session</Text>
                  </View>
                </View>
                <View style={styles.addBtnCircle}>
                  <Ionicons name="add" size={20} color={theme.colors.primary} />
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Dev Panel Modal */}
      <Modal
        visible={devModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDevModalVisible(false)}
      >
        <View style={styles.devModalOverlay}>
          <View style={styles.devModalContent}>
            <View style={styles.devModalHeader}>
              <View style={styles.devHeaderTitleRow}>
                <Ionicons name="terminal" size={20} color={theme.colors.tertiary} />
                <Text style={styles.devModalTitle}>Developer Panel</Text>
              </View>
              <TouchableOpacity onPress={() => setDevModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.devModalList}>
              <Text style={styles.devSectionTitle}>Switch Role</Text>
              <View style={styles.devRoleRow}>
                {(['user', 'employee', 'business'] as const).map((r) => {
                  const active = role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.devRoleChip, active && styles.devRoleChipActive]}
                      onPress={() => setRole(r)}
                    >
                      <Text style={[styles.devRoleChipText, active && styles.devRoleChipTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.devSectionTitle}>Navigation</Text>
              {APP_ROUTES.map((route) => (
                <TouchableOpacity 
                  key={route.path} 
                  style={styles.devRouteItem}
                  onPress={() => {
                    setDevModalVisible(false);
                    router.push(route.path as any);
                  }}
                >
                  <View style={styles.devRouteInfo}>
                    <Text style={styles.devRouteLabel}>{route.label}</Text>
                    <Text style={styles.devRoutePath}>{route.path}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.chevron} />
                </TouchableOpacity>
              ))}

              <View style={styles.devInfoBox}>
                <Text style={styles.devInfoTitle}>Current Session</Text>
                <Text style={styles.devInfoText}>User ID: {user?.id}</Text>
                <Text style={styles.devInfoText}>Primary: {role || 'None'}</Text>
                <Text style={styles.devInfoText}>Roles: {roles.length ? roles.join(', ') : 'None'}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerGreeting: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.h1,
    color: theme.colors.textPrimary,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devBtn: {
    backgroundColor: theme.colors.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.h2,
    color: theme.colors.primary,
  },
  statLabel: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  sectionCount: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  },
  serviceCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.primary,
  },
  cardInfo: {
    flex: 1,
  },
  providerName: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  providerRole: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  removeBtn: {
    padding: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
    opacity: 0.6,
  },
  cardBottom: {
    gap: theme.spacing.sm,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceName: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
  },
  serviceDuration: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availabilityText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.success,
  },
  priceText: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.primary,
  },
  bottomSpacer: {
    height: 110,
  },

  // Modal
  modal: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: theme.spacing.sm,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  modalList: {
    padding: theme.spacing.md,
    paddingTop: 0,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: theme.spacing.sm,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
  },
  resultRole: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 4,
  },
  resultPrice: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  addBtnCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Dev Modal Styles
  devModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  devModalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  devModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  devHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  devModalTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  devModalList: {
    padding: 20,
  },
  devSectionTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 12,
    color: theme.colors.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  devRoleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  devRoleChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  devRoleChipActive: {
    backgroundColor: theme.colors.tertiary,
    borderColor: theme.colors.tertiary,
  },
  devRoleChipText: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  devRoleChipTextActive: {
    color: theme.colors.textInverted,
  },
  devRouteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  devRouteInfo: {
    flex: 1,
  },
  devRouteLabel: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  devRoutePath: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  devInfoBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  devInfoTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  devInfoText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 11,
    color: theme.colors.muted,
    marginBottom: 4,
  },
  });
}
