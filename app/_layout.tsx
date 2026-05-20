/**
 * 根布局 — 应用的最外层结构
 *
 * 职责：
 * 1. 加载品牌字体
 * 2. 在字体加载完成前保持启动屏
 * 3. 包裹 WaterProvider，让全局状态在所有页面可用
 * 4. 配置通知行为
 * 5. 根据外观偏好设置状态栏和系统背景
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { WaterProvider } from '@/contexts/WaterContext';
import {
  configureNotifications,
  ensureNotificationChannel,
  requestPermissions,
} from '@/utils/notifications';
import { useAppTheme } from '@/hooks/useAppTheme';

// 在字体加载完成前，保持启动屏可见
SplashScreen.preventAutoHideAsync();

// 配置通知显示行为
configureNotifications();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // 加载 Claude 风格字体：UI 使用 Anthropic Sans，英文标题使用 Anthropic Serif，中文标题使用思源宋体
  const [fontsLoaded] = useFonts({
    AnthropicSans_400Regular: require('../assets/fonts/AnthropicSans-Regular.ttf'),
    AnthropicSans_500Medium: require('../assets/fonts/AnthropicSans-Medium.ttf'),
    AnthropicSerif_600SemiBold: require('../assets/fonts/AnthropicSerif-Regular.ttf'),
    NotoSerifSC_400Regular: require('../assets/fonts/NotoSerifSC-VF.otf'),
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
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
