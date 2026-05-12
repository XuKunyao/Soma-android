/**
 * Tab 导航布局 — 底部标签栏
 *
 * 三个 Tab：
 * 1. 首页（index）— 喝水进度与记录
 * 2. 记录（history）— 饮水趋势与汇总
 * 3. 设置（settings）— 极简设置页
 *
 * 样式遵循 Reverie 的温暖极简设计：
 * - Tab 栏背景使用卡片色（#FDFAF4）
 * - 激活图标使用品牌色（#D97757）
 * - 顶部细分割线
 * - 不显示顶部导航栏（每个页面自己管理标题）
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { Theme } from '@/constants/theme';

/**
 * 使用 Feather 的线性图标，让底部导航保持轻、细、温暖。
 */
function TabIcon({
  name,
  focused,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  focused: boolean;
}) {
  return (
    <Feather
      name={name}
      size={20}
      color={focused ? Theme.colors.primary : Theme.colors.textSecondary}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: Theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Theme.colors.surface,
          borderTopColor: Theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,           // 移除安卓默认阴影
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
          title: '首页',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="droplet" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '记录',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="bar-chart-2" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="sliders" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
