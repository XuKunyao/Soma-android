/**
 * 本地存储工具 — 封装 AsyncStorage 的读写操作
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WaterLog {
  id: string;
  amount: number;
  timestamp: number;
}

export interface WaterDayRecord {
  dateKey: string;
  logs: WaterLog[];
  total: number;
  goal: number;
}

export type LanguagePreference = 'zh' | 'en';
export type AppearancePreference = 'system' | 'light' | 'dark';

export interface WaterSettings {
  dailyGoal: number;
  cupSize: number;
  reminderInterval: number;
  reminderCustomInterval: number;
  reminderTimes: string[];
  reminderDisabledTimes: string[];
  reminderEnabled: boolean;
  reminderQuietStart: string;
  reminderQuietEnd: string;
  language: LanguagePreference;
  appearance: AppearancePreference;
  exportDirectoryUri?: string;
}

export const DEFAULT_SETTINGS: WaterSettings = {
  dailyGoal: 2000,
  cupSize: 250,
  reminderInterval: 60,
  reminderCustomInterval: 0,
  reminderTimes: [],
  reminderDisabledTimes: [],
  reminderEnabled: true,
  reminderQuietStart: '22:00',
  reminderQuietEnd: '08:00',
  language: 'zh',
  appearance: 'system',
  exportDirectoryUri: '',
};

const WATER_LOG_PREFIX = 'water_logs_';
const WATER_GOAL_PREFIX = 'water_goal_';

export function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function saveLogsForDate(dateKey: string, logs: WaterLog[]): Promise<void> {
  await AsyncStorage.setItem(`${WATER_LOG_PREFIX}${dateKey}`, JSON.stringify(logs));
}

export async function loadLogsForDate(dateKey: string): Promise<WaterLog[]> {
  const data = await AsyncStorage.getItem(`${WATER_LOG_PREFIX}${dateKey}`);
  return data ? JSON.parse(data) as WaterLog[] : [];
}

export async function saveGoalForDate(dateKey: string, goal: number): Promise<void> {
  await AsyncStorage.setItem(`${WATER_GOAL_PREFIX}${dateKey}`, JSON.stringify(goal));
}

export async function loadGoalForDate(dateKey: string): Promise<number | null> {
  const data = await AsyncStorage.getItem(`${WATER_GOAL_PREFIX}${dateKey}`);
  if (!data) {
    return null;
  }

  const goal = JSON.parse(data) as number;
  return Number.isFinite(goal) ? goal : null;
}

export async function saveTodayLogs(logs: WaterLog[]): Promise<void> {
  await saveLogsForDate(getTodayKey(), logs);
}

export async function loadTodayLogs(): Promise<WaterLog[]> {
  return loadLogsForDate(getTodayKey());
}

export async function loadWaterHistory(fallbackGoal = DEFAULT_SETTINGS.dailyGoal): Promise<WaterDayRecord[]> {
  const keys = await AsyncStorage.getAllKeys();
  const dateKeys = keys
    .filter((key) => key.startsWith(WATER_LOG_PREFIX))
    .map((key) => key.replace(WATER_LOG_PREFIX, ''))
    .sort((a, b) => b.localeCompare(a));

  const records = await Promise.all(
    dateKeys.map(async (dateKey) => {
      const [logs, savedGoal] = await Promise.all([
        loadLogsForDate(dateKey),
        loadGoalForDate(dateKey),
      ]);

      return {
        dateKey,
        logs,
        total: logs.reduce((sum, log) => sum + log.amount, 0),
        goal: savedGoal ?? fallbackGoal,
      };
    }),
  );

  return records.filter((record) => record.logs.length > 0);
}

export async function buildWaterDataExport(): Promise<{
  app: string;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown>;
}> {
  const keys = await AsyncStorage.getAllKeys();
  const exportKeys = keys.filter((key) => (
    key === 'water_settings' ||
    key.startsWith(WATER_LOG_PREFIX) ||
    key.startsWith(WATER_GOAL_PREFIX)
  ));
  const entries = await AsyncStorage.multiGet(exportKeys);
  const data: Record<string, unknown> = {};

  entries.forEach(([key, value]) => {
    if (!value) {
      data[key] = null;
      return;
    }

    try {
      data[key] = JSON.parse(value);
    } catch {
      data[key] = value;
    }
  });

  return {
    app: 'Soma',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export async function saveSettings(settings: WaterSettings): Promise<void> {
  await AsyncStorage.setItem('water_settings', JSON.stringify(settings));
}

export async function loadSettings(): Promise<WaterSettings> {
  const data = await AsyncStorage.getItem('water_settings');
  if (data) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  }
  return DEFAULT_SETTINGS;
}
