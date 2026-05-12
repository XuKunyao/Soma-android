/**
 * 根布局 — 应用的最外层结构
 *
 * 职责：
 * 1. 加载 DM Sans 字体
 * 2. 在字体加载完成前保持启动屏
 * 3. 包裹 WaterProvider，让全局状态在所有页面可用
 * 4. 配置通知行为
 * 5. 根据外观偏好设置状态栏和系统背景
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { WaterProvider, useWater } from '@/contexts/WaterContext';
import {
  configureNotifications,
  ensureNotificationChannel,
  requestPermissions,
} from '@/utils/notifications';
import { Theme } from '@/constants/theme';

// 在字体加载完成前，保持启动屏可见
SplashScreen.preventAutoHideAsync();

// 配置通知显示行为
configureNotifications();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // 加载 DM Sans 字体
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      // 字体加载完成，隐藏启动屏
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    async function prepareNotifications() {
      await ensureNotificationChannel();
      await requestPermissions();
    }

    prepareNotifications();
  }, []);

  // 字体未加载完成时不渲染任何内容
  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WaterProvider>
        <AppShell />
      </WaterProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const systemScheme = useColorScheme();
  const { state } = useWater();
  const resolvedScheme = state.settings.appearance === 'system'
    ? systemScheme
    : state.settings.appearance;
  const isDark = resolvedScheme === 'dark';
  const backgroundColor = isDark ? '#201A16' : Theme.colors.background;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(backgroundColor);
  }, [backgroundColor]);

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
