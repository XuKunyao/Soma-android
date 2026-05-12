import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';

function TabIcon({
  name,
  focused,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  focused: boolean;
}) {
  const colors = useThemeColors();

  return (
    <Feather
      name={name}
      size={20}
      color={focused ? colors.primary : colors.textSecondary}
    />
  );
}

export default function TabLayout() {
  const colors = useThemeColors();
  const { state } = useWater();
  const isEnglish = state.settings.language === 'en';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          height: Platform.OS === 'android' ? 60 : 85,
          paddingBottom: Platform.OS === 'android' ? 8 : 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Theme.fonts.regular,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isEnglish ? 'Home' : '首页',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="droplet" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: isEnglish ? 'Records' : '记录',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="bar-chart-2" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: isEnglish ? 'Settings' : '设置',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="sliders" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}