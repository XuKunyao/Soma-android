/**
 * 通知调度工具 — 管理喝水提醒通知
 *
 * 为什么用 expo-notifications？
 * - 它是 Expo 官方的通知库，支持本地定时通知
 * - 替代原生 Android 的 WorkManager，但使用方式更简单
 * - 可以把提醒提前注册到手机系统，App 不在前台时也能收到本地通知
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

type ReminderScheduleOptions = {
  intervalMinutes: number;
  language?: LanguagePreference;
  quietStart?: string;
  quietEnd?: string;
};

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_QUIET_START = '22:00';
const DEFAULT_QUIET_END = '08:00';

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

function parseTimeToMinutes(value: string | undefined, fallback: string): number {
  const match = (value ?? fallback).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  const safeMatch = match ?? fallback.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!safeMatch) {
    return 0;
  }

  return Number(safeMatch[1]) * 60 + Number(safeMatch[2]);
}

function isWithinQuietWindow(minuteOfDay: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart === quietEnd) {
    return false;
  }

  if (quietStart < quietEnd) {
    return minuteOfDay >= quietStart && minuteOfDay < quietEnd;
  }

  return minuteOfDay >= quietStart || minuteOfDay < quietEnd;
}

function toTimeParts(minuteOfDay: number): { hour: number; minute: number } {
  const normalized = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return {
    hour: Math.floor(normalized / 60),
    minute: normalized % 60,
  };
}

function buildReminderTimes(intervalMinutes: number, quietStartValue?: string, quietEndValue?: string): number[] {
  const safeInterval = Math.max(1, Math.round(intervalMinutes));
  const quietStart = parseTimeToMinutes(quietStartValue, DEFAULT_QUIET_START);
  const quietEnd = parseTimeToMinutes(quietEndValue, DEFAULT_QUIET_END);
  const firstReminder = quietStart === quietEnd ? 0 : quietEnd;
  const times: number[] = [];
  const seen = new Set<number>();

  for (let elapsed = 0; elapsed < MINUTES_PER_DAY; elapsed += safeInterval) {
    const minuteOfDay = (firstReminder + elapsed) % MINUTES_PER_DAY;

    if (seen.has(minuteOfDay)) {
      continue;
    }

    seen.add(minuteOfDay);

    if (!isWithinQuietWindow(minuteOfDay, quietStart, quietEnd)) {
      times.push(minuteOfDay);
    }
  }

  return times.sort((a, b) => a - b);
}

function pickReminderMessage(language: LanguagePreference): { title: string; body: string } {
  const messages = REMINDER_MESSAGES[language];
  return messages[Math.floor(Math.random() * messages.length)];
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
 * 设定喝水提醒。
 *
 * 为什么不再用一个无限循环的 interval 通知？
 * 因为 interval 通知无法避开睡眠时间。这里会把可提醒时间段内的每个时间点
 * 注册为“每天重复”的系统通知，例如 08:00、09:00……21:00。
 */
export async function scheduleWaterReminder(options: ReminderScheduleOptions): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  const {
    intervalMinutes,
    language = 'zh',
    quietStart = DEFAULT_QUIET_START,
    quietEnd = DEFAULT_QUIET_END,
  } = options;

  await cancelAllReminders();

  const reminderTimes = buildReminderTimes(intervalMinutes, quietStart, quietEnd);

  await Promise.all(reminderTimes.map((minuteOfDay) => {
    const message = pickReminderMessage(language);
    const { hour, minute } = toTimeParts(minuteOfDay);

    return Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: 'water-reminders',
        hour,
        minute,
      },
    });
  }));
}

/** 取消所有已安排的提醒 */
export async function cancelAllReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
}
