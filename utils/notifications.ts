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

import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';
import type { LanguagePreference } from '@/utils/storage';

type NotificationsModule = typeof ExpoNotifications;

type NativeReminderModule = {
  schedule?: (optionsJson: string) => Promise<void>;
  cancel?: () => Promise<void>;
  canScheduleExactAlarms?: () => Promise<boolean>;
};

type ReminderScheduleOptions = {
  intervalMinutes: number;
  reminderTimes?: string[];
  language?: LanguagePreference;
  quietStart?: string;
  quietEnd?: string;
};

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_QUIET_START = '22:00';
const DEFAULT_QUIET_END = '08:00';
const REMINDER_CHANNEL_ID = 'water-reminders-v2';
const nativeReminderModule = NativeModules.SomaReminderModule as NativeReminderModule | undefined;

/** 温暖的提醒文案集合 */
const REMINDER_MESSAGES: Record<LanguagePreference, { title: string; body: string }[]> = {
  zh: [
    { title: '该喝水啦', body: '照顾好自己，喝杯水吧' },
    { title: '温馨提醒', body: '放下手里的事，慢慢喝一口水' },
    { title: '补充水分', body: '给身体一点清爽的照顾' },
    { title: '喝水时间', body: '小小一杯水，也是在照顾今天的自己' },
    { title: '休息一下', body: '起身活动一下，顺便喝杯水吧' },
    { title: '轻轻提醒', body: '如果方便，现在可以喝几口水' },
    { title: '给自己一杯水', body: '不急，慢慢喝就好' },
    { title: '保持水分', body: '今天也记得温柔地照顾自己' },
  ],
  en: [
    { title: 'Time for water', body: 'Take a quiet moment and drink a glass' },
    { title: 'A gentle pause', body: 'Set things down and take a few sips' },
    { title: 'Hydration reminder', body: 'A small glass now helps the day feel easier' },
    { title: 'Water break', body: 'Give yourself a glass of water and breathe' },
    { title: 'Kind reminder', body: 'A few sips would be good right now' },
    { title: 'Stay hydrated', body: 'Care for yourself in this small way' },
    { title: 'A glass for you', body: 'No rush. Drink slowly' },
    { title: 'Gentle hydration', body: 'Your body may appreciate a little water' },
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

function hasQuietHours(quietStartValue?: string, quietEndValue?: string): boolean {
  return Boolean(quietStartValue && quietEndValue);
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
  const quietHoursEnabled = hasQuietHours(quietStartValue, quietEndValue);
  const quietStart = quietHoursEnabled
    ? parseTimeToMinutes(quietStartValue, DEFAULT_QUIET_START)
    : 0;
  const quietEnd = quietHoursEnabled
    ? parseTimeToMinutes(quietEndValue, DEFAULT_QUIET_END)
    : 0;
  const firstReminder = quietHoursEnabled && quietStart !== quietEnd ? quietEnd : 0;
  const times: number[] = [];
  const seen = new Set<number>();

  for (let elapsed = 0; elapsed < MINUTES_PER_DAY; elapsed += safeInterval) {
    const minuteOfDay = (firstReminder + elapsed) % MINUTES_PER_DAY;

    if (seen.has(minuteOfDay)) {
      continue;
    }

    seen.add(minuteOfDay);

    if (!quietHoursEnabled || !isWithinQuietWindow(minuteOfDay, quietStart, quietEnd)) {
      times.push(minuteOfDay);
    }
  }

  return times.sort((a, b) => a - b);
}


function buildSpecificReminderTimes(times: string[] | undefined, quietStartValue?: string, quietEndValue?: string): number[] {
  const quietHoursEnabled = hasQuietHours(quietStartValue, quietEndValue);
  const quietStart = quietHoursEnabled
    ? parseTimeToMinutes(quietStartValue, DEFAULT_QUIET_START)
    : 0;
  const quietEnd = quietHoursEnabled
    ? parseTimeToMinutes(quietEndValue, DEFAULT_QUIET_END)
    : 0;
  const seen = new Set<number>();

  (times ?? []).forEach((time) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return;
    }

    const minuteOfDay = parseTimeToMinutes(time, DEFAULT_QUIET_END);
    if (!quietHoursEnabled || !isWithinQuietWindow(minuteOfDay, quietStart, quietEnd)) {
      seen.add(minuteOfDay);
    }
  });

  return [...seen].sort((a, b) => a - b);
}

function pickReminderMessageAt(language: LanguagePreference, index: number): { title: string; body: string } {
  const messages = REMINDER_MESSAGES[language];
  return messages[index % messages.length];
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
        shouldPlaySound: true,    // Follow system sound mode; silent devices should vibrate only
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

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Water reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#D97757',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: true,
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
  const canUseNativeAndroidScheduler = Platform.OS === 'android' && !!nativeReminderModule?.schedule;

  const {
    intervalMinutes,
    reminderTimes: specificReminderTimes,
    language = 'zh',
    quietStart = DEFAULT_QUIET_START,
    quietEnd = DEFAULT_QUIET_END,
  } = options;

  if (canUseNativeAndroidScheduler) {
    await nativeReminderModule.schedule?.(JSON.stringify({
      intervalMinutes,
      reminderTimes: specificReminderTimes ?? [],
      language,
      quietStart,
      quietEnd,
    }));
    return;
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  await cancelAllReminders();

  const exactTimes = buildSpecificReminderTimes(specificReminderTimes, quietStart, quietEnd);
  const quietHoursEnabled = hasQuietHours(quietStart, quietEnd);

  if (exactTimes.length === 0 && !quietHoursEnabled) {
    const safeIntervalMinutes = Math.max(1, Math.round(intervalMinutes));

    await Notifications.scheduleNotificationAsync({
      identifier: 'soma-water-reminder-interval',
      content: {
        title: pickReminderMessageAt(language, 0).title,
        body: pickReminderMessageAt(language, 0).body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: REMINDER_CHANNEL_ID,
        seconds: safeIntervalMinutes * 60,
        repeats: true,
      },
    });
    return;
  }

  const reminderTimes = exactTimes.length > 0
    ? exactTimes
    : buildReminderTimes(intervalMinutes, quietStart, quietEnd);

  await Promise.all(reminderTimes.map((minuteOfDay, index) => {
    const message = pickReminderMessageAt(language, index);
    const { hour, minute } = toTimeParts(minuteOfDay);

    return Notifications.scheduleNotificationAsync({
      identifier: `soma-water-reminder-${minuteOfDay}`,
      content: {
        title: message.title,
        body: message.body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: REMINDER_CHANNEL_ID,
        hour,
        minute,
      },
    });
  }));
}

/** 取消所有已安排的提醒 */
export async function cancelAllReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (Platform.OS === 'android' && nativeReminderModule?.cancel) {
    await nativeReminderModule.cancel();
  }

  if (!Notifications) {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}
