/**
 * TabFABSlot — the component rendered inside the tab bar's 4th slot.
 * Each screen can customise the icon and label.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import type { AppTheme } from "../constants/theme";
import { useThemedStyles } from "../hooks/use-themed-styles";

interface TabFABSlotProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress?: () => void;
}

export function TabFABSlot({ icon, label, onPress }: TabFABSlotProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity
      style={styles.slot}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Animated.View style={styles.fab}>
        <Ionicons name={icon} size={22} color="#fff" />
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    slot: {
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: 2,
    },
    fab: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      // Vibrant shadow
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
      // Subtle top inset so it "floats" above the bar
      marginTop: -10,
    },
    label: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 10,
      color: theme.colors.primary,
      letterSpacing: 0.1,
    },
  });
}
