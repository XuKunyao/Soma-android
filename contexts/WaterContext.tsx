/**
 * 全局饮水状态管理 — 使用 React Context + useReducer
 *
 * 为什么用 Context 而不是 Redux？
 * - 应用只有 2 个页面，状态很简单
 * - Context + useReducer 是 React 内置方案，零额外依赖
 * - 对初学者更容易理解
 *
 * 状态流动：
 * 1. App 启动时从 AsyncStorage 加载数据
 * 2. 用户操作（喝水、改设置）通过 dispatch 更新状态
 * 3. 状态变化后自动同步回 AsyncStorage
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, InteractionManager } from 'react-native';
import {
  WaterLog,
  WaterSettings,
  DEFAULT_SETTINGS,
  getTodayKey,
  saveLogsForDate,
  saveGoalForDate,
  loadLogsForDate,
  saveSettings,
  loadSettings,
} from '@/utils/storage';
import { scheduleWaterReminder, cancelAllReminders } from '@/utils/notifications';

/** 全局状态类型 */
interface WaterState {
  settings: WaterSettings;
  todayLogs: WaterLog[];
  todayTotal: number;
  dateKey: string;
  isLoaded: boolean;    // 数据是否已从存储加载完成
}

/** 所有可能的 Action 类型 */
type WaterAction =
  | { type: 'LOAD_DATA'; settings: WaterSettings; logs: WaterLog[]; dateKey: string }
  | { type: 'LOAD_TODAY_LOGS'; logs: WaterLog[]; dateKey: string }
  | { type: 'ADD_WATER'; amount: number; dateKey: string }
  | { type: 'DELETE_LOG'; id: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<WaterSettings> };

/** 计算今日总饮水量 */
function calcTotal(logs: WaterLog[]): number {
  return logs.reduce((sum, log) => sum + log.amount, 0);
}

/** 生成唯一 ID */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 初始状态 */
const initialState: WaterState = {
  settings: DEFAULT_SETTINGS,
  todayLogs: [],
  todayTotal: 0,
  dateKey: getTodayKey(),
  isLoaded: false,
};

/**
 * Reducer — 所有状态变化的核心逻辑
 * 类似于一个"状态变更处理器"，接收当前状态和动作，返回新状态
 */
function waterReducer(state: WaterState, action: WaterAction): WaterState {
  switch (action.type) {
    case 'LOAD_DATA': {
      return {
        ...state,
        settings: action.settings,
        todayLogs: action.logs,
        todayTotal: calcTotal(action.logs),
        dateKey: action.dateKey,
        isLoaded: true,
      };
    }
    case 'LOAD_TODAY_LOGS': {
      return {
        ...state,
        todayLogs: action.logs,
        todayTotal: calcTotal(action.logs),
        dateKey: action.dateKey,
        isLoaded: true,
      };
    }
    case 'ADD_WATER': {
      const newLog: WaterLog = {
        id: generateId(),
        amount: action.amount,
        timestamp: Date.now(),
      };
      const logs = action.dateKey === state.dateKey ? state.todayLogs : [];
      const newLogs = [newLog, ...logs]; // 新记录放最前面
      return {
        ...state,
        todayLogs: newLogs,
        todayTotal: calcTotal(newLogs),
        dateKey: action.dateKey,
      };
    }
    case 'DELETE_LOG': {
      const newLogs = state.todayLogs.filter(log => log.id !== action.id);
      return {
        ...state,
        todayLogs: newLogs,
        todayTotal: calcTotal(newLogs),
      };
    }
    case 'UPDATE_SETTINGS': {
      const newSettings = { ...state.settings, ...action.settings };
      return {
        ...state,
        settings: newSettings,
      };
    }
    default:
      return state;
  }
}

/** Context 类型 */
interface WaterContextType {
  state: WaterState;
  addWater: (amount?: number) => void;
  deleteLog: (id: string) => void;
  updateSettings: (settings: Partial<WaterSettings>) => void;
  reloadData: () => Promise<void>;
}

const WaterContext = createContext<WaterContextType | undefined>(undefined);

/**
 * WaterProvider — 包裹整个 App，提供全局状态
 *
 * 使用方式：
 * 在 _layout.tsx 中包裹 <WaterProvider>
 * 在任何子组件中用 useWater() 获取状态和操作函数
 */
export function WaterProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(waterReducer, initialState);

  const reloadData = React.useCallback(async () => {
    const dateKey = getTodayKey();
    const [settings, logs] = await Promise.all([
      loadSettings(),
      loadLogsForDate(dateKey),
    ]);
    dispatch({ type: 'LOAD_DATA', settings, logs, dateKey });
  }, []);

  const refreshTodayLogs = React.useCallback(async () => {
    const dateKey = getTodayKey();
    const logs = await loadLogsForDate(dateKey);
    dispatch({ type: 'LOAD_TODAY_LOGS', dateKey, logs });
  }, []);

  // App 启动时加载数据
  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // 饮水记录变化时，自动保存到本地存储
  useEffect(() => {
    if (state.isLoaded) {
      saveLogsForDate(state.dateKey, state.todayLogs);
      saveGoalForDate(state.dateKey, state.settings.dailyGoal);
    }
  }, [state.todayLogs, state.dateKey, state.settings.dailyGoal, state.isLoaded]);

  // 跨过本地 0 点后自动切换到新一天的数据
  useEffect(() => {
    if (!state.isLoaded) {
      return;
    }

    const syncTodayIfNeeded = () => {
      if (getTodayKey() !== state.dateKey) {
        refreshTodayLogs();
      }
    };

    const timer = setInterval(syncTodayIfNeeded, 60 * 1000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncTodayIfNeeded();
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refreshTodayLogs, state.dateKey, state.isLoaded]);

  // 设置变化时，保存设置。提醒调度单独处理，避免普通设置点击也触发通知系统。
  useEffect(() => {
    if (!state.isLoaded) {
      return;
    }

    const timer = setTimeout(() => {
      void saveSettings(state.settings);
      void saveGoalForDate(state.dateKey, state.settings.dailyGoal);
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [state.settings, state.dateKey, state.isLoaded]);

  // 只有提醒相关配置变化时才更新系统提醒，降低设置页点击时的偶发卡顿。
  useEffect(() => {
    if (!state.isLoaded) {
      return;
    }

    let interactionTask: { cancel: () => void } | undefined;
    const timer = setTimeout(() => {
      interactionTask = InteractionManager.runAfterInteractions(() => {
        if (state.settings.reminderEnabled) {
          void scheduleWaterReminder({
            intervalMinutes: state.settings.reminderInterval,
            reminderTimes: state.settings.reminderTimes,
            language: state.settings.language,
            quietStart: state.settings.reminderQuietStart,
            quietEnd: state.settings.reminderQuietEnd,
          });
        } else {
          void cancelAllReminders();
        }
      });
    }, 700);

    return () => {
      clearTimeout(timer);
      interactionTask?.cancel();
    };
  }, [
    state.isLoaded,
    state.settings.language,
    state.settings.reminderEnabled,
    state.settings.reminderInterval,
    state.settings.reminderQuietEnd,
    state.settings.reminderQuietStart,
    state.settings.reminderTimes,
  ]);

  /** 喝了一杯水 */
  const addWater = (amount?: number) => {
    dispatch({
      type: 'ADD_WATER',
      amount: amount ?? state.settings.cupSize,
      dateKey: getTodayKey(),
    });
  };

  /** 删除一条记录 */
  const deleteLog = (id: string) => {
    dispatch({ type: 'DELETE_LOG', id });
  };

  /** 更新设置 */
  const updateSettings = (settings: Partial<WaterSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings });
  };

  return (
    <WaterContext.Provider value={{ state, addWater, deleteLog, updateSettings, reloadData }}>
      {children}
    </WaterContext.Provider>
  );
}

/**
 * 自定义 Hook — 在任何组件中获取饮水状态
 *
 * 使用示例：
 * const { state, addWater } = useWater();
 * console.log(state.todayTotal); // 今日总饮水量
 * addWater(); // 喝了一杯（使用默认杯量）
 */
export function useWater(): WaterContextType {
  const context = useContext(WaterContext);
  if (!context) {
    throw new Error('useWater must be used within a WaterProvider');
  }
  return context;
}
