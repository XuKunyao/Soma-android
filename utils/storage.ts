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

export type ResolvedLanguage = 'zh' | 'en';
export type LanguagePreference = 'system' | ResolvedLanguage;
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
  usageStartDate?: string;
}

export interface WaterDataExport {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

export interface WaterDataImportResult {
  logDays: number;
  goalDays: number;
  hasSettings: boolean;
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
  usageStartDate: '',
};

const WATER_LOG_PREFIX = 'water_logs_';
const WATER_GOAL_PREFIX = 'water_goal_';
const SETTINGS_KEY = 'water_settings';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  if (!data) {
    return [];
  }

  try {
    const parsed = JSON.parse(data) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isValidWaterLog) : [];
  } catch {
    return [];
  }
}

export async function saveGoalForDate(dateKey: string, goal: number): Promise<void> {
  await AsyncStorage.setItem(`${WATER_GOAL_PREFIX}${dateKey}`, JSON.stringify(goal));
}

export async function loadGoalForDate(dateKey: string): Promise<number | null> {
  const data = await AsyncStorage.getItem(`${WATER_GOAL_PREFIX}${dateKey}`);
  if (!data) {
    return null;
  }

  try {
    const goal = JSON.parse(data) as unknown;
    return typeof goal === 'number' && Number.isFinite(goal) ? goal : null;
  } catch {
    return null;
  }
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidWaterLog(value: unknown): value is WaterLog {
  if (!isPlainObject(value)) {
    return false;
  }

  return typeof value.id === 'string'
    && typeof value.amount === 'number'
    && Number.isFinite(value.amount)
    && value.amount > 0
    && typeof value.timestamp === 'number'
    && Number.isFinite(value.timestamp);
}

function normalizeLanguagePreference(value: unknown): LanguagePreference {
  return value === 'system' || value === 'en' || value === 'zh'
    ? value
    : DEFAULT_SETTINGS.language;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.round(numericValue)
    : fallback;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0
    ? Math.round(numericValue)
    : fallback;
}

function normalizeExportedSettings(value: unknown, currentSettings: WaterSettings): WaterSettings | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const merged = { ...DEFAULT_SETTINGS, ...value };

  return {
    ...merged,
    dailyGoal: normalizePositiveNumber(merged.dailyGoal, DEFAULT_SETTINGS.dailyGoal),
    cupSize: normalizePositiveNumber(merged.cupSize, DEFAULT_SETTINGS.cupSize),
    reminderInterval: normalizePositiveNumber(merged.reminderInterval, DEFAULT_SETTINGS.reminderInterval),
    reminderCustomInterval: normalizeNonNegativeNumber(merged.reminderCustomInterval, DEFAULT_SETTINGS.reminderCustomInterval),
    reminderTimes: Array.isArray(merged.reminderTimes) ? merged.reminderTimes.filter((item) => typeof item === 'string') : [],
    reminderDisabledTimes: Array.isArray(merged.reminderDisabledTimes) ? merged.reminderDisabledTimes.filter((item) => typeof item === 'string') : [],
    reminderEnabled: typeof merged.reminderEnabled === 'boolean' ? merged.reminderEnabled : DEFAULT_SETTINGS.reminderEnabled,
    reminderQuietStart: typeof merged.reminderQuietStart === 'string' ? merged.reminderQuietStart : DEFAULT_SETTINGS.reminderQuietStart,
    reminderQuietEnd: typeof merged.reminderQuietEnd === 'string' ? merged.reminderQuietEnd : DEFAULT_SETTINGS.reminderQuietEnd,
    language: normalizeLanguagePreference(merged.language),
    appearance: merged.appearance === 'light' || merged.appearance === 'dark' ? merged.appearance : 'system',
    exportDirectoryUri: currentSettings.exportDirectoryUri ?? '',
    usageStartDate: typeof merged.usageStartDate === 'string' ? merged.usageStartDate : '',
  };
}

function normalizeExportPayload(payload: unknown): WaterDataExport {
  if (!isPlainObject(payload) || payload.app !== 'Soma' || payload.schemaVersion !== 1 || !isPlainObject(payload.data)) {
    throw new Error('Invalid Soma backup file');
  }

  return payload as unknown as WaterDataExport;
}

export async function buildWaterDataExport(): Promise<WaterDataExport> {
  const keys = await AsyncStorage.getAllKeys();
  const exportKeys = keys.filter((key) => (
    key === SETTINGS_KEY ||
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
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadSettings(): Promise<WaterSettings> {
  const data = await AsyncStorage.getItem(SETTINGS_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (isPlainObject(parsed)) {
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        return {
          ...merged,
          dailyGoal: normalizePositiveNumber(merged.dailyGoal, DEFAULT_SETTINGS.dailyGoal),
          cupSize: normalizePositiveNumber(merged.cupSize, DEFAULT_SETTINGS.cupSize),
          reminderInterval: normalizePositiveNumber(merged.reminderInterval, DEFAULT_SETTINGS.reminderInterval),
          reminderCustomInterval: normalizeNonNegativeNumber(merged.reminderCustomInterval, DEFAULT_SETTINGS.reminderCustomInterval),
          reminderTimes: Array.isArray(merged.reminderTimes) ? merged.reminderTimes.filter((item) => typeof item === 'string') : DEFAULT_SETTINGS.reminderTimes,
          reminderDisabledTimes: Array.isArray(merged.reminderDisabledTimes) ? merged.reminderDisabledTimes.filter((item) => typeof item === 'string') : DEFAULT_SETTINGS.reminderDisabledTimes,
          reminderEnabled: typeof merged.reminderEnabled === 'boolean' ? merged.reminderEnabled : DEFAULT_SETTINGS.reminderEnabled,
          reminderQuietStart: typeof merged.reminderQuietStart === 'string' ? merged.reminderQuietStart : DEFAULT_SETTINGS.reminderQuietStart,
          reminderQuietEnd: typeof merged.reminderQuietEnd === 'string' ? merged.reminderQuietEnd : DEFAULT_SETTINGS.reminderQuietEnd,
          language: normalizeLanguagePreference(merged.language),
          appearance: merged.appearance === 'light' || merged.appearance === 'dark' ? merged.appearance : 'system',
          exportDirectoryUri: typeof merged.exportDirectoryUri === 'string' ? merged.exportDirectoryUri : DEFAULT_SETTINGS.exportDirectoryUri,
          usageStartDate: typeof merged.usageStartDate === 'string' && DATE_KEY_PATTERN.test(merged.usageStartDate) ? merged.usageStartDate : DEFAULT_SETTINGS.usageStartDate,
        };
      }
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export async function importWaterDataExport(payload: unknown): Promise<WaterDataImportResult> {
  const backup = normalizeExportPayload(payload);
  const currentSettings = await loadSettings();
  const entries: [string, string][] = [];
  let logDays = 0;
  let goalDays = 0;
  let hasSettings = false;

  Object.entries(backup.data).forEach(([key, value]) => {
    if (key === SETTINGS_KEY) {
      const settings = normalizeExportedSettings(value, currentSettings);
      if (settings) {
        entries.push([SETTINGS_KEY, JSON.stringify(settings)]);
        hasSettings = true;
      }
      return;
    }

    if (key.startsWith(WATER_LOG_PREFIX)) {
      const dateKey = key.replace(WATER_LOG_PREFIX, '');
      if (DATE_KEY_PATTERN.test(dateKey) && Array.isArray(value) && value.every(isValidWaterLog)) {
        const sortedLogs = [...value].sort((a, b) => b.timestamp - a.timestamp);
        entries.push([key, JSON.stringify(sortedLogs)]);
        logDays += 1;
      }
      return;
    }

    if (key.startsWith(WATER_GOAL_PREFIX)) {
      const dateKey = key.replace(WATER_GOAL_PREFIX, '');
      const goal = typeof value === 'number' ? value : Number(value);
      if (DATE_KEY_PATTERN.test(dateKey) && Number.isFinite(goal) && goal > 0) {
        entries.push([key, JSON.stringify(goal)]);
        goalDays += 1;
      }
    }
  });

  if (entries.length === 0) {
    throw new Error('No importable Soma data');
  }

  await AsyncStorage.multiSet(entries);

  return { logDays, goalDays, hasSettings };
}
