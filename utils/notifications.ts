/**
 * 通知调度工具 — 管理喝水提醒通知
 *
 * 为什么用 expo-notifications？
 * - 它是 Expo 官方的通知库，支持本地定时通知
 * - 替代原生 Android 的 WorkManager，但使用方式更简单
 * - 支持在后台按间隔重复推送通知
 *
 * 通知文案设计原则：
 * - 语气温暖平和，像朋友的轻声提醒
 * - 使用自然元素 emoji（🌿💧🍃），不使用机械感符号
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';
import type { LanguagePreference } from '@/utils/storage';

type NotificationsModule = typeof ExpoNotifications;

/** 温暖的提醒文案集合 */
const REMINDER_MESSAGES: Record<LanguagePreference, { title: string; body: string }[]> = {
  zh: [
    { title: '该喝水啦', body: '照顾好自己，喝杯水吧 🌿' },
    { title: '休息一下', body: '起来活动活动，顺便喝杯水 💧' },
    { title: '补充水分', body: '记得喝水哦，保持好状态 🍃' },
    { title: '喝水时间', body: '给自己一杯温水，放松一下 ☕' },
    { title: '温馨提醒', body: '今天的水喝够了吗？来一杯吧 🌸' },
  ],
  en: [
    { title: 'Time for water', body: 'Take a quiet moment and drink a glass 🌿' },
    { title: 'A gentle pause', body: 'Stretch a little, then sip some water 💧' },
    { title: 'Hydration reminder', body: 'A small glass now helps the day feel easier 🍃' },
    { title: 'Water break', body: 'Give yourself a glass of water and breathe ☕' },
    { title: 'Kind reminder', body: 'Have you had enough water today? 🌸' },
  ],
};

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
}

async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo()) {
    return null;
  }

  return import('expo-notifications');
}

/**
 * 配置通知的显示行为
 * 即使 App 在前台也会显示通知
 */
export function configureNotifications(): void {
  getNotifications().then((Notifications) => {
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,   // 不播放声音，保持安静
        shouldSetBadge: false,
      }),
    });
  });
}

/** 为 Android 创建通知频道，保证本地提醒能稳定显示 */
export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  await Notifications.setNotificationChannelAsync('water-reminders', {
    name: 'Water reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#D97757',
  });
}

/**
 * 请求通知权限
 * 在安卓 13+ 上需要用户手动授权
 */
export async function requestPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return false;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * 设定定时喝水提醒
 * @param intervalMinutes 提醒间隔（分钟）
 */
export async function scheduleWaterReminder(intervalMinutes: number, language: LanguagePreference = 'zh'): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  // 先取消所有已有的提醒，避免重复
  await cancelAllReminders();

  // 随机选一条温暖的提醒文案
  const messages = REMINDER_MESSAGES[language];
  const message = messages[Math.floor(Math.random() * messages.length)];

  // 设定重复通知
  await Notifications.scheduleNotificationAsync({
    content: {
      title: message.title,
      body: message.body,
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalMinutes * 60,
      repeats: true,
    },
  });
}

/** 取消所有已安排的提醒 */
export async function cancelAllReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
}
