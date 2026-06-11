import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import PagerView from "react-native-pager-view";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddActionSheet } from "../../components/AddActionSheet";
import { LiquidGlassChrome } from "../../components/LiquidGlassChrome";
import {
  LiquidGlassContainer,
  LiquidGlassSurface,
  canUseNativeGlassEffect,
} from "../../components/LiquidGlassSurface";
import { QRCodeModal } from "../../components/QRCodeModal";
import { QRScannerModal } from "../../components/QRScannerModal";
import type { AppTheme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/use-themed-styles";
import { buildProfileQrValue, parseProfileIdFromQr } from "../../lib/qr";

import HomeScreen from "./index";
import MessagesScreen from "./messages";
import ScheduleScreen from "./schedule";

const { width: SW } = Dimensions.get("window");
const SIDE = 16;
const GAP = 12;
const PILL_H = 64;
const FAB_SZ = PILL_H;
const PILL_W = SW - SIDE * 2 - FAB_SZ - GAP;
const TAB_W = PILL_W / 3;
const CHROME_W = PILL_W + GAP + FAB_SZ;

const BUBBLE_SPRING = { damping: 18, stiffness: 240, mass: 0.8 };

const TABS = [
  {
    name: "Home",
    icon: "home" as const,
    active: "home" as const,
    route: "/(tabs)",
  },
  {
    name: "Schedule",
    icon: "calendar" as const,
    active: "calendar" as const,
    route: "/schedule",
  },
  {
    name: "Messages",
    icon: "chatbubble" as const,
    active: "chatbubble" as const,
    route: "/messages",
  },
];

function resolveTabIndex(pathname: string, fallback = 0): number {
  const idx = TABS.findIndex((t) => t.route === pathname);
  if (idx !== -1) return idx;
  if (pathname === "/" || pathname === "/(tabs)/index") return 0;
  return fallback;
}

function resolveTabIndexFromBubbleX(bubbleX: number): number {
  return Math.max(0, Math.min(TABS.length - 1, Math.round(bubbleX / TAB_W)));
}

export default function TabLayout() {
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user, hasRole, role, session, roles, isLoading } = useAuth();

  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const pathname = usePathname();
  const router = useRouter();

  const getCurrentIdx = useCallback(() => {
    return resolveTabIndex(pathname, activeRef.current);
  }, [pathname]);

  const [activeIndex, setActiveIndex] = useState(() =>
    resolveTabIndex(pathname),
  );
  const activeRef = useRef(resolveTabIndex(pathname));
  const lastPagerIndex = useRef(resolveTabIndex(pathname));
  const isDragging = useRef(false);
  const bubbleX = useSharedValue(resolveTabIndex(pathname) * TAB_W);

  const springBubble = useCallback(
    (idx: number) => {
      bubbleX.value = withSpring(idx * TAB_W, BUBBLE_SPRING);
    },
    [bubbleX],
  );

  const [homeModal, setHomeModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [messagesCompose, setMessagesCompose] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  const meta = user?.user_metadata ?? {};
  const displayName =
    [meta.first_name, meta.last_name].filter(Boolean).join(" ") || "My Profile";
  const qrValue = user?.id ? buildProfileQrValue(user.id) : "";

  const handleScanned = (data: string) => {
    setScannerVisible(false);
    const profileId = parseProfileIdFromQr(data);
    if (!profileId) {
      Alert.alert(
        "Invalid QR Code",
        "This code is not a valid provider profile.",
      );
      return;
    }
    router.push(`/profile/${profileId}`);
  };

  const goTo = useCallback(
    (idx: number, shouldNavigate = true) => {
      const i = Math.max(0, Math.min(TABS.length - 1, idx));
      const changed = i !== activeRef.current;

      activeRef.current = i;
      lastPagerIndex.current = i;
      setActiveIndex(i);
      pagerRef.current?.setPage(i);
      springBubble(i);

      if (shouldNavigate && changed) {
        router.navigate(TABS[i].route as any);
      }
    },
    [router, springBubble],
  );

  useEffect(() => {
    if (isDragging.current) return;
    const targetIdx = getCurrentIdx();
    if (
      targetIdx !== activeRef.current &&
      targetIdx !== lastPagerIndex.current
    ) {
      activeRef.current = targetIdx;
      setActiveIndex(targetIdx);
      pagerRef.current?.setPage(targetIdx);
      springBubble(targetIdx);
    }
  }, [pathname, getCurrentIdx, springBubble]);

  const onPageScrollStateChanged = useCallback((e: any) => {
    isDragging.current = e.nativeEvent.pageScrollState !== "idle";
  }, []);

  const onPageSelected = useCallback(
    (e: any) => {
      const i = e.nativeEvent.position;
      if (i === activeRef.current) return;
      activeRef.current = i;
      lastPagerIndex.current = i;
      setActiveIndex(i);
      springBubble(i);
    },
    [springBubble],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.pageX - SIDE - TAB_W / 2;
        bubbleX.value = Math.max(0, Math.min((TABS.length - 1) * TAB_W, x));
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.pageX - SIDE - TAB_W / 2;
        bubbleX.value = Math.max(0, Math.min((TABS.length - 1) * TAB_W, x));
      },
      onPanResponderRelease: () => {
        goTo(resolveTabIndexFromBubbleX(bubbleX.value), true);
      },
      onPanResponderTerminate: () => {
        goTo(resolveTabIndexFromBubbleX(bubbleX.value), true);
      },
    }),
  ).current;

  const isEmployee = hasRole("employee");
  const showHomeFab = hasRole("employee") || hasRole("user");

  const fabConfig = (() => {
    if (activeIndex === 0) {
      if (showHomeFab) {
        return {
          icon: "add" as const,
          onPress: () => setAddSheetVisible(true),
        };
      }
      return null;
    }
    if (activeIndex === 1) {
      return { icon: "add" as const, onPress: () => setScheduleModal(true) };
    }
    if (activeIndex === 2) {
      if (role === "user" || isEmployee) {
        return {
          icon: "create-outline" as const,
          onPress: () => setMessagesCompose(true),
        };
      }
      return { icon: "create-outline" as const, onPress: () => {} };
    }
    return null;
  })();

  const bottomOffset = Math.max(insets.bottom, 24);
  const hasAccountRole = Boolean(role) || roles.length > 0;
  const canShowTabs = !isLoading && !(session && !hasAccountRole);
  const useNativeGlass = useMemo(canUseNativeGlassEffect, []);

  const getTabTintColor = (focused: boolean) => {
    if (focused) return theme.colors.secondary;
    return theme.colors.textSecondary;
  };

  if (!canShowTabs) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={activeRef.current}
        onPageSelected={onPageSelected}
        onPageScrollStateChanged={onPageScrollStateChanged}
        overdrag
      >
        <View key="0" style={styles.page}>
          <HomeScreen
            externalModalVisible={homeModal}
            onExternalModalClose={() => setHomeModal(false)}
          />
        </View>
        <View key="1" style={styles.page}>
          <ScheduleScreen
            externalModalVisible={scheduleModal}
            onExternalModalClose={() => setScheduleModal(false)}
          />
        </View>
        <View key="2" style={styles.page}>
          <MessagesScreen
            externalComposeVisible={messagesCompose}
            onExternalComposeClose={() => setMessagesCompose(false)}
          />
        </View>
      </PagerView>

      <View
        style={[styles.floatingRow, { bottom: bottomOffset }]}
        pointerEvents="box-none"
      >
        {useNativeGlass ? (
          <View style={styles.glassWarmupHost} pointerEvents="none">
            <LiquidGlassContainer style={styles.glassWarmupRow} enabled>
              {[0, 1, 2].map((index) => (
                <View
                  key={index}
                  style={[styles.glassWarmupBubble, { left: index * 18 }]}
                  pointerEvents="none"
                >
                  <LiquidGlassSurface
                    theme={theme}
                    isDark={isDark}
                    style={StyleSheet.absoluteFill}
                    borderRadius={12}
                    interactive={false}
                  />
                </View>
              ))}
            </LiquidGlassContainer>
          </View>
        ) : null}

        <LiquidGlassChrome
          width={CHROME_W}
          height={PILL_H}
          pillWidth={PILL_W}
          gap={GAP}
          bubbleX={bubbleX}
          tabWidth={TAB_W}
          hasFab={!!fabConfig}
          fab={
            fabConfig ? (
              <TouchableOpacity
                onPress={fabConfig.onPress}
                activeOpacity={0.85}
                style={styles.fabHit}
                hitSlop={8}
              >
                <Ionicons name={fabConfig.icon} size={22} color={theme.colors.secondary} />
              </TouchableOpacity>
            ) : undefined
          }
        >
          <View style={[styles.tabRow, { width: PILL_W }]} {...pan.panHandlers}>
            {TABS.map((tab, idx) => {
              const focused = activeIndex === idx;
              const tintColor = getTabTintColor(focused);
              return (
                <View key={tab.name} style={styles.tabItem}>
                  <Ionicons
                    name={focused ? tab.active : tab.icon}
                    size={22}
                    color={tintColor}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: tintColor,
                        fontFamily: focused
                          ? theme.typography.fontFamily.bold
                          : theme.typography.fontFamily.semiBold,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.name}
                  </Text>
                </View>
              );
            })}
          </View>
        </LiquidGlassChrome>
      </View>

      <AddActionSheet
        visible={addSheetVisible}
        variant={isEmployee ? "employee" : "user"}
        onClose={() => setAddSheetVisible(false)}
        onScan={() => {
          setAddSheetVisible(false);
          setScannerVisible(true);
        }}
        onSearch={() => {
          setAddSheetVisible(false);
          setHomeModal(true);
        }}
        onShowQR={() => {
          setAddSheetVisible(false);
          setQrVisible(true);
        }}
      />

      <QRCodeModal
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        value={qrValue}
        name={displayName}
        subtitle={meta.job_title || meta.business_name || "Service Provider"}
      />

      <QRScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleScanned}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    pager: { flex: 1 },
    page: { flex: 1 },

    floatingRow: {
      position: "absolute",
      left: SIDE,
      right: SIDE,
      alignItems: "stretch",
    },
    tabRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    tabItem: {
      width: TAB_W,
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    tabLabel: {
      fontSize: 10,
      letterSpacing: 0.15,
    },
    fabHit: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    glassWarmupHost: {
      position: "absolute",
      left: 0,
      bottom: 0,
      width: 1,
      height: 1,
      overflow: "hidden",
      opacity: 0.01,
    },
    glassWarmupRow: {
      position: "relative",
      width: 72,
      height: 24,
    },
    glassWarmupBubble: {
      position: "absolute",
      top: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      overflow: "hidden",
    },
  });
}
