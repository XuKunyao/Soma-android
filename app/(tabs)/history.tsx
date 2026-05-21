/**
 * 记录页 — 汇总长期饮水趋势
 *
 * 从本地按日期保存的饮水记录中汇总日、周、月、年的完成情况。
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
  AppState,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';
import { AppText as Text } from '@/components/fixed-scale-text';
import { PageHeader } from '@/components/PageHeader';
import {
  getTodayKey,
  loadLogsForDate,
  loadWaterHistory,
  saveGoalForDate,
  saveLogsForDate,
  type LanguagePreference,
  type WaterLog,
  type WaterDayRecord,
} from '@/utils/storage';
import { resolveLanguagePreference } from '@/utils/language';

type PeriodMode = 'day' | 'week' | 'month' | 'year';
const MONTH_PICKER_VALUES = Array.from({ length: 12 }, (_, index) => index + 1);
const PICKER_ITEM_HEIGHT = 44;
const PICKER_VISIBLE_ITEMS = 5;

interface TrendPoint {
  key: string;
  label: string;
  total: number;
  goal: number;
  showLabel?: boolean;
}

interface PeriodData {
  title: string;
  rangeLabel: string;
  trendTitle: string;
  trendRangeLabel: string;
  points: TrendPoint[];
  summary: {
    total: number;
    goal: number;
    diff: number;
  };
}

function getPeriods(language: LanguagePreference): { label: string; value: PeriodMode }[] {
  return language === 'en'
    ? [
      { label: 'Day', value: 'day' },
      { label: 'Week', value: 'week' },
      { label: 'Month', value: 'month' },
      { label: 'Year', value: 'year' },
    ]
    : [
      { label: '日', value: 'day' },
      { label: '周', value: 'week' },
      { label: '月', value: 'month' },
      { label: '年', value: 'year' },
    ];
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function generateBackfillId(dateKey: string): string {
  return `backfill-${dateKey}-${Date.now().toString(36)}`;
}

function isValidDateKey(dateKey: string | undefined): dateKey is string {
  return typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}

function getUsageStartDate(usageStartDate: string | undefined): Date | null {
  return isValidDateKey(usageStartDate) ? parseDateKey(usageStartDate) : null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, 0, 1);
}

function addCalendarMonths(year: number, month: number, offset: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

function samePeriodOrAfterToday(mode: PeriodMode, anchorDate: Date): boolean {
  const today = parseDateKey(getTodayKey());

  if (mode === 'day') {
    return toDateKey(anchorDate) >= toDateKey(today);
  }

  if (mode === 'week') {
    return startOfWeek(anchorDate).getTime() >= startOfWeek(today).getTime();
  }

  if (mode === 'month') {
    return anchorDate.getFullYear() > today.getFullYear()
      || (anchorDate.getFullYear() === today.getFullYear() && anchorDate.getMonth() >= today.getMonth());
  }

  return anchorDate.getFullYear() >= today.getFullYear();
}

function periodEndDate(mode: PeriodMode, anchorDate: Date): Date {
  if (mode === 'day') {
    return anchorDate;
  }

  if (mode === 'week') {
    return endOfWeek(anchorDate);
  }

  if (mode === 'month') {
    return new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  }

  return new Date(anchorDate.getFullYear(), 11, 31);
}

function overlapsUsageStart(mode: PeriodMode, anchorDate: Date, usageStartDate: Date | null): boolean {
  return !usageStartDate || periodEndDate(mode, anchorDate).getTime() >= usageStartDate.getTime();
}

function formatDayLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatFullDayLabel(date: Date, language: LanguagePreference): string {
  if (language === 'en') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatMonthLabel(date: Date, language: LanguagePreference): string {
  if (language === 'zh') {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }

  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

function formatCompactMonthLabel(date: Date, language: LanguagePreference): string {
  if (language === 'en') {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short' }).format(date);
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatDateRange(startDate: Date, endDate: Date, language: LanguagePreference): string {
  const start = formatFullDayLabel(startDate, language);
  const end = formatFullDayLabel(endDate, language);

  return start === end ? start : `${start} - ${end}`;
}

function clampEndToToday(endDate: Date): Date {
  const today = parseDateKey(getTodayKey());
  return endDate.getTime() > today.getTime() ? today : endDate;
}

function getActivePeriodStart(startDate: Date, endDate: Date, usageStartDate: Date | null): Date | null {
  if (!usageStartDate || usageStartDate.getTime() <= startDate.getTime()) {
    return startDate;
  }

  return usageStartDate.getTime() <= endDate.getTime() ? usageStartDate : null;
}

function formatMonthRange(startDate: Date, endDate: Date, language: LanguagePreference): string {
  const start = formatCompactMonthLabel(startDate, language);
  const end = formatCompactMonthLabel(endDate, language);

  return start === end ? start : `${start} - ${end}`;
}

function formatPickerMonth(year: number, month: number, language: LanguagePreference): string {
  if (language === 'en') {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(new Date(year, month - 1, 1));
  }

  return `${year}年${month}月`;
}

function sameWeek(a: Date, b: Date): boolean {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime();
}

function formatTimeLabel(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatLogTimeRange(record: WaterDayRecord | undefined, language: LanguagePreference): string {
  if (!record || record.logs.length === 0) {
    return language === 'en' ? 'No records yet' : '暂无饮水记录';
  }

  const timestamps = record.logs.map((log) => log.timestamp);
  const firstTime = new Date(Math.min(...timestamps));
  const lastTime = new Date(Math.max(...timestamps));

  return `${formatTimeLabel(firstTime)} - ${formatTimeLabel(lastTime)}`;
}

function formatWeekOfMonthLabel(date: Date, language: LanguagePreference): string {
  const weekNumber = Math.floor((date.getDate() - 1) / 7) + 1;

  if (language === 'en') {
    return `${new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date)} week ${weekNumber}`;
  }

  return `${date.getMonth() + 1}月第${weekNumber}周`;
}

function formatYearLabel(date: Date, language: LanguagePreference): string {
  if (language === 'en') {
    return `${date.getFullYear()}`;
  }

  return `${date.getFullYear()}年`;
}

function formatDiff(value: number, language: LanguagePreference): string {
  if (value === 0) {
    return language === 'en' ? 'On target' : '刚好达成';
  }

  if (language === 'en') {
    return value > 0 ? `Over by ${value}ml` : `${Math.abs(value)}ml short`;
  }

  return value > 0 ? `超出 ${value}ml` : `少 ${Math.abs(value)}ml`;
}

function sumPoints(points: TrendPoint[]) {
  const total = points.reduce((sum, point) => sum + point.total, 0);
  const goal = points.reduce((sum, point) => sum + point.goal, 0);
  return { total, goal, diff: total - goal };
}

function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  if (startDate.getTime() > endDate.getTime()) {
    return [];
  }

  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

function getMonthDates(anchorDate: Date, usageStartDate: Date | null): Date[] {
  const today = parseDateKey(getTodayKey());
  const isCurrentMonth = anchorDate.getFullYear() === today.getFullYear()
    && anchorDate.getMonth() === today.getMonth();
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEnd = isCurrentMonth
    ? today
    : new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const activeStart = getActivePeriodStart(monthStart, monthEnd, usageStartDate);

  return activeStart ? getDatesInRange(activeStart, monthEnd) : [];
}

function getYearMonths(anchorDate: Date, usageStartDate: Date | null): Date[] {
  const today = parseDateKey(getTodayKey());
  const monthCount = anchorDate.getFullYear() === today.getFullYear() ? today.getMonth() + 1 : 12;
  const yearStart = new Date(anchorDate.getFullYear(), 0, 1);
  const yearEnd = anchorDate.getFullYear() === today.getFullYear()
    ? today
    : new Date(anchorDate.getFullYear(), 11, 31);
  const activeStart = getActivePeriodStart(yearStart, yearEnd, usageStartDate);

  if (!activeStart) {
    return [];
  }

  const startMonth = activeStart.getMonth();

  return Array.from({ length: Math.max(0, monthCount - startMonth) }, (_, index) => (
    new Date(anchorDate.getFullYear(), startMonth + index, 1)
  ));
}

function buildDayPoints(dates: Date[], recordMap: Map<string, WaterDayRecord>, fallbackGoal: number): TrendPoint[] {
  return dates.map((date) => {
    const dateKey = toDateKey(date);
    const record = recordMap.get(dateKey);
    return {
      key: dateKey,
      label: formatDayLabel(date),
      total: record?.total ?? 0,
      goal: record?.goal ?? fallbackGoal,
    };
  });
}

function buildHourlyPoints(record: WaterDayRecord | undefined, fallbackGoal: number): TrendPoint[] {
  const hourlyTotals = Array.from({ length: 12 }, () => 0);

  record?.logs.forEach((log) => {
    const hour = new Date(log.timestamp).getHours();
    hourlyTotals[Math.floor(hour / 2)] += log.amount;
  });

  return hourlyTotals.map((total, index) => {
    const startHour = index * 2;
    return {
      key: `hour-${startHour}`,
      label: startHour % 4 === 2 ? `${startHour}` : '',
      total,
      goal: Math.round((record?.goal ?? fallbackGoal) / 12),
      showLabel: startHour % 4 === 2,
    };
  });
}

function buildMonthWeekPoints(anchorDate: Date, recordMap: Map<string, WaterDayRecord>, fallbackGoal: number, usageStartDate: Date | null): TrendPoint[] {
  const dayPoints = buildDayPoints(getMonthDates(anchorDate, usageStartDate), recordMap, fallbackGoal);
  const weekPoints: TrendPoint[] = [];

  for (let index = 0; index < dayPoints.length; index += 7) {
    const week = dayPoints.slice(index, index + 7);
    const summary = sumPoints(week);
    const weekNumber = Math.floor(index / 7) + 1;

    weekPoints.push({
      key: `week-${weekNumber}`,
      label: `${week[0].label}-${week[week.length - 1].label}`,
      total: summary.total,
      goal: summary.goal,
    });
  }

  return weekPoints;
}

function buildMonthPoints(records: WaterDayRecord[], fallbackGoal: number, language: LanguagePreference, anchorDate: Date, usageStartDate: Date | null): TrendPoint[] {
  const months = getYearMonths(anchorDate, usageStartDate);

  return months.map((date) => {
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const today = parseDateKey(getTodayKey());
    const isCurrentMonth = date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth();
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = isCurrentMonth ? today : new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const monthRecords = records.filter((record) => {
      if (!record.dateKey.startsWith(monthKey)) {
        return false;
      }

      const recordDate = parseDateKey(record.dateKey);
      return recordDate.getTime() <= monthEnd.getTime()
        && (!usageStartDate || recordDate.getTime() >= usageStartDate.getTime());
    });
    const total = monthRecords.reduce((sum, record) => sum + record.total, 0);
    const activeMonthStart = getActivePeriodStart(monthStart, monthEnd, usageStartDate);
    const dayCount = activeMonthStart ? getDatesInRange(activeMonthStart, monthEnd).length : 0;
    const savedGoal = monthRecords.reduce((sum, record) => sum + record.goal, 0);
    const missingGoal = Math.max(0, dayCount - monthRecords.length) * fallbackGoal;

    return {
      key: monthKey,
      label: new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', { month: 'short' }).format(date),
      total,
      goal: savedGoal + missingGoal,
    };
  });
}

function buildPeriod(mode: PeriodMode, records: WaterDayRecord[], fallbackGoal: number, language: LanguagePreference, anchorDate: Date, usageStartDateValue?: string): PeriodData {
  const recordMap = new Map(records.map((record) => [record.dateKey, record]));
  const usageStartDate = getUsageStartDate(usageStartDateValue);

  if (mode === 'day') {
    const dateKey = toDateKey(anchorDate);
    const today = parseDateKey(getTodayKey());
    const isTrackedDay = anchorDate.getTime() <= today.getTime()
      && (!usageStartDate || anchorDate.getTime() >= usageStartDate.getTime());
    const record = isTrackedDay ? recordMap.get(dateKey) : undefined;
    const dayGoal = isTrackedDay ? (record?.goal ?? fallbackGoal) : 0;
    const points = buildHourlyPoints(record, dayGoal);
    const dayPoint = {
      key: dateKey,
      label: formatDayLabel(anchorDate),
      total: record?.total ?? 0,
      goal: dayGoal,
    };
    return {
      title: samePeriodOrAfterToday('day', anchorDate) ? (language === 'en' ? 'Today' : '今日概览') : (language === 'en' ? 'Daily record' : '每日记录'),
      rangeLabel: formatFullDayLabel(anchorDate, language),
      trendTitle: language === 'en' ? 'Hourly trend' : '分时完成趋势',
      trendRangeLabel: formatLogTimeRange(record, language),
      points,
      summary: sumPoints([dayPoint]),
    };
  }

  if (mode === 'week') {
    const weekStart = startOfWeek(anchorDate);
    const weekEnd = endOfWeek(anchorDate);
    const activeWeekEnd = samePeriodOrAfterToday('week', anchorDate)
      ? clampEndToToday(weekEnd)
      : weekEnd;
    const activeWeekStart = getActivePeriodStart(weekStart, activeWeekEnd, usageStartDate);
    const points = activeWeekStart
      ? buildDayPoints(getDatesInRange(activeWeekStart, activeWeekEnd), recordMap, fallbackGoal)
      : [];
    return {
      title: samePeriodOrAfterToday('week', anchorDate) ? (language === 'en' ? 'This week' : '本周汇总') : (language === 'en' ? 'Weekly record' : '每周记录'),
      rangeLabel: formatDateRange(activeWeekStart ?? weekStart, activeWeekEnd, language),
      trendTitle: language === 'en' ? 'Daily trend' : '每日完成趋势',
      trendRangeLabel: formatWeekOfMonthLabel(anchorDate, language),
      points,
      summary: sumPoints(points),
    };
  }

  if (mode === 'month') {
    const today = parseDateKey(getTodayKey());
    const isCurrentMonth = anchorDate.getFullYear() === today.getFullYear()
      && anchorDate.getMonth() === today.getMonth();
    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const monthEnd = isCurrentMonth ? today : new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
    const activeMonthStart = getActivePeriodStart(monthStart, monthEnd, usageStartDate);
    const monthWeekPoints = buildMonthWeekPoints(anchorDate, recordMap, fallbackGoal, usageStartDate);
    return {
      title: samePeriodOrAfterToday('month', anchorDate) ? (language === 'en' ? 'This month' : '本月汇总') : (language === 'en' ? 'Monthly record' : '每月记录'),
      rangeLabel: formatDateRange(activeMonthStart ?? monthStart, monthEnd, language),
      trendTitle: language === 'en' ? 'Weekly trend' : '每周完成趋势',
      trendRangeLabel: formatMonthLabel(anchorDate, language),
      points: monthWeekPoints,
      summary: sumPoints(monthWeekPoints),
    };
  }

  const today = parseDateKey(getTodayKey());
  const yearEnd = anchorDate.getFullYear() === today.getFullYear()
    ? today
    : new Date(anchorDate.getFullYear(), 11, 31);
  const yearStart = new Date(anchorDate.getFullYear(), 0, 1);
  const activeYearStart = getActivePeriodStart(yearStart, yearEnd, usageStartDate);
  const yearEndMonth = new Date(yearEnd.getFullYear(), yearEnd.getMonth(), 1);
  const points = buildMonthPoints(records, fallbackGoal, language, anchorDate, usageStartDate);
  return {
    title: samePeriodOrAfterToday('year', anchorDate) ? (language === 'en' ? 'This year' : '今年汇总') : (language === 'en' ? 'Yearly record' : '每年记录'),
    rangeLabel: formatMonthRange(activeYearStart ?? yearStart, yearEndMonth, language),
    trendTitle: language === 'en' ? 'Monthly trend' : '每月完成趋势',
    trendRangeLabel: formatYearLabel(anchorDate, language),
    points,
    summary: sumPoints(points),
  };
}

function WheelColumn({
  data,
  selectedValue,
  onValueChange,
  colors,
}: {
  data: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  colors: typeof Theme.colors;
}) {
  const flatListRef = React.useRef<FlatList<number>>(null);
  const paddingItems = Math.floor(PICKER_VISIBLE_ITEMS / 2);
  const paddingHeight = paddingItems * PICKER_ITEM_HEIGHT;
  const selectedIndex = Math.max(0, data.indexOf(selectedValue));
  const [activeIndex, setActiveIndex] = React.useState(selectedIndex);

  React.useEffect(() => {
    const nextIndex = data.indexOf(selectedValue);
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * PICKER_ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [data, selectedValue]);

  const handleScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.min(
      data.length - 1,
      Math.max(0, Math.round(event.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT)),
    );
    setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
  }, [data.length]);

  const handleScrollEnd = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.min(
      data.length - 1,
      Math.max(0, Math.round(event.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT)),
    );
    const value = data[nextIndex];

    if (value !== undefined && value !== selectedValue) {
      onValueChange(value);
    }
  }, [data, onValueChange, selectedValue]);

  return (
    <View style={{ flex: 1, height: PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ITEMS }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: paddingHeight,
          height: PICKER_ITEM_HEIGHT,
          borderRadius: Theme.radius.input,
          backgroundColor: colors.primarySoft,
        }}
      />
      <FlatList
        ref={flatListRef}
        data={data}
        extraData={activeIndex}
        keyExtractor={(_, index) => `${index}`}
        renderItem={({ item, index }) => {
          const selected = index === activeIndex;
          return (
            <View style={{ height: PICKER_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{
                  color: selected ? colors.primary : colors.textSecondary,
                  fontFamily: selected ? Theme.fonts.medium : Theme.fonts.regular,
                  fontSize: selected ? 20 : 16,
                  opacity: selected ? 1 : 0.35,
                }}
              >
                {item}
              </Text>
            </View>
          );
        }}
        getItemLayout={(_, index) => ({
          length: PICKER_ITEM_HEIGHT,
          offset: PICKER_ITEM_HEIGHT * index,
          index,
        })}
        showsVerticalScrollIndicator={false}
        snapToInterval={PICKER_ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingTop: paddingHeight, paddingBottom: paddingHeight }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        initialScrollIndex={selectedIndex}
      />
    </View>
  );
}

function formatPercent(total: number, goal: number): string {
  if (goal <= 0) {
    return '0%';
  }

  return `${Math.round((total / goal) * 100)}%`;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { state } = useWater();
  const language = resolveLanguagePreference(state.settings.language);
  const copy = language === 'en'
    ? { title: 'Records', subtitle: 'See the rhythm of how you care for yourself', goal: 'Goal', completion: 'Completion', dailyAverage: 'Daily avg', recordCount: 'Entries', completedDays: 'Days met', emptyTrend: 'Trends will appear after you start recording', recent: 'Records in this period', allDay: 'All day · 00:00-23:59', entries: 'records', emptyHistory: 'No records in this period', previous: 'Previous', next: 'Next', selectPeriod: 'Select period', previousMonth: 'Previous month', nextMonth: 'Next month', confirm: 'Done', markComplete: 'Mark as 100%', markCompleteHint: 'Fill this day to its goal when you forgot to record it' }
    : { title: '记录', subtitle: '看看身体被照顾的节律', goal: '目标', completion: '完成率', dailyAverage: '日均 ml', recordCount: '记录次数', completedDays: '达标天数', emptyTrend: '开始记录后，这里会生成趋势', recent: '当前周期记录', allDay: '全天 · 00:00-23:59', entries: '次记录', emptyHistory: '这个周期还没有记录', previous: '上一段', next: '下一段', selectPeriod: '选择时间', previousMonth: '上个月', nextMonth: '下个月', confirm: '完成', markComplete: '补记为达标', markCompleteHint: '忘记记录时，将这一天补到 100% 完成' };
  const periods = React.useMemo(() => getPeriods(language), [language]);
  const [mode, setMode] = React.useState<PeriodMode>('day');
  const [anchorDate, setAnchorDate] = React.useState(() => parseDateKey(getTodayKey()));
  const [records, setRecords] = React.useState<WaterDayRecord[]>([]);
  const [isDatePickerVisible, setIsDatePickerVisible] = React.useState(false);
  const [pickerYear, setPickerYear] = React.useState(() => parseDateKey(getTodayKey()).getFullYear());
  const [pickerMonth, setPickerMonth] = React.useState(() => parseDateKey(getTodayKey()).getMonth() + 1);
  const [pickerDraftDate, setPickerDraftDate] = React.useState(() => parseDateKey(getTodayKey()));

  const refreshHistory = React.useCallback(async () => {
    const history = await loadWaterHistory(state.settings.dailyGoal);
    setRecords(history);
  }, [state.settings.dailyGoal]);

  const resetToToday = React.useCallback(() => {
    setMode('day');
    setAnchorDate(parseDateKey(getTodayKey()));
    setIsDatePickerVisible(false);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      resetToToday();
      refreshHistory();
      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          resetToToday();
          refreshHistory();
        }
      });

      return () => {
        subscription.remove();
      };
    }, [refreshHistory, resetToToday]),
  );

  React.useEffect(() => {
    refreshHistory();
  }, [refreshHistory, state.todayLogs, state.todayTotal]);

  const recordsForView = React.useMemo(() => {
    const otherRecords = records.filter((record) => record.dateKey !== state.dateKey);

    if (state.todayLogs.length === 0) {
      return otherRecords;
    }

    const todayRecord: WaterDayRecord = {
      dateKey: state.dateKey,
      logs: state.todayLogs,
      total: state.todayTotal,
      goal: state.settings.dailyGoal,
    };

    return [todayRecord, ...otherRecords].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [records, state.dateKey, state.settings.dailyGoal, state.todayLogs, state.todayTotal]);
  const todayDate = parseDateKey(getTodayKey());
  const todayYear = todayDate.getFullYear();
  const todayMonth = todayDate.getMonth() + 1;
  const usageStartDate = React.useMemo(
    () => getUsageStartDate(state.settings.usageStartDate),
    [state.settings.usageStartDate],
  );
  const getAvailableMonthsForYear = React.useCallback((year: number) => {
    const minMonth = usageStartDate && year === usageStartDate.getFullYear()
      ? usageStartDate.getMonth() + 1
      : 1;
    const maxMonth = year === todayYear ? todayMonth : 12;

    const months = MONTH_PICKER_VALUES.filter((month) => month >= minMonth && month <= maxMonth);
    return months.length > 0 ? months : [todayMonth];
  }, [todayMonth, todayYear, usageStartDate]);
  const clampPickerMonth = React.useCallback((year: number, month: number) => {
    const months = getAvailableMonthsForYear(year);

    if (months.includes(month)) {
      return month;
    }

    return months[0] ?? month;
  }, [getAvailableMonthsForYear]);
  const pickerYearValues = React.useMemo(() => {
    const years = new Set<number>([todayYear]);

    if (usageStartDate && usageStartDate.getTime() <= todayDate.getTime()) {
      for (let year = usageStartDate.getFullYear(); year <= todayYear; year += 1) {
        years.add(year);
      }
    }

    recordsForView.forEach((record) => {
      const recordDate = parseDateKey(record.dateKey);
      if (
        recordDate.getFullYear() <= todayYear
        && (!usageStartDate || recordDate.getTime() >= usageStartDate.getTime())
      ) {
        years.add(recordDate.getFullYear());
      }
    });

    return Array.from(years).sort((a, b) => a - b);
  }, [recordsForView, todayDate, todayYear, usageStartDate]);

  const period = React.useMemo(
    () => buildPeriod(mode, recordsForView, state.settings.dailyGoal, language, anchorDate, state.settings.usageStartDate),
    [anchorDate, language, mode, recordsForView, state.settings.dailyGoal, state.settings.usageStartDate],
  );
  const draftPeriod = React.useMemo(
    () => buildPeriod(mode, recordsForView, state.settings.dailyGoal, language, pickerDraftDate, state.settings.usageStartDate),
    [language, mode, pickerDraftDate, recordsForView, state.settings.dailyGoal, state.settings.usageStartDate],
  );
  const maxValue = Math.max(
    1,
    ...period.points.map((point) => Math.max(point.total, point.goal)),
  );
  const dayCountForAverage = mode === 'day' ? 1 : period.points.length;
  const average = dayCountForAverage > 0 ? Math.round(period.summary.total / dayCountForAverage) : 0;
  const completedDays = mode === 'day'
    ? (period.summary.total >= period.summary.goal && period.summary.total > 0 ? 1 : 0)
    : period.points.filter((point) => point.total >= point.goal && point.total > 0).length;
  const periodRecords = React.useMemo(() => {
    const todayKey = getTodayKey();
    const activeRecords = recordsForView.filter((record) => (
      record.dateKey <= todayKey
      && (!usageStartDate || parseDateKey(record.dateKey).getTime() >= usageStartDate.getTime())
    ));

    if (mode === 'day') {
      return activeRecords.filter((record) => record.dateKey === toDateKey(anchorDate));
    }

    if (mode === 'week') {
      const startKey = toDateKey(startOfWeek(anchorDate));
      const endKey = toDateKey(endOfWeek(anchorDate));
      return activeRecords.filter((record) => record.dateKey >= startKey && record.dateKey <= endKey);
    }

    if (mode === 'month') {
      const monthKey = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, '0')}`;
      return activeRecords.filter((record) => record.dateKey.startsWith(monthKey));
    }

    return activeRecords.filter((record) => record.dateKey.startsWith(`${anchorDate.getFullYear()}-`));
  }, [anchorDate, mode, recordsForView, usageStartDate]);
  const dayRecordCount = periodRecords.reduce((sum, record) => sum + record.logs.length, 0);
  const selectedDateKey = toDateKey(anchorDate);
  const isHistoricalTrackedDay = mode === 'day'
    && selectedDateKey < getTodayKey()
    && (!usageStartDate || anchorDate.getTime() >= usageStartDate.getTime());
  const canMarkComplete = isHistoricalTrackedDay
    && period.summary.goal > 0
    && period.summary.total < period.summary.goal;
  const markDayComplete = React.useCallback(async () => {
    if (!canMarkComplete) {
      return;
    }

    const dateKey = toDateKey(anchorDate);
    const existingLogs = await loadLogsForDate(dateKey);
    const existingTotal = existingLogs.reduce((sum, log) => sum + log.amount, 0);
    const missingAmount = Math.max(0, period.summary.goal - existingTotal);

    if (missingAmount <= 0) {
      await saveGoalForDate(dateKey, period.summary.goal);
      await refreshHistory();
      return;
    }

    const backfillLog: WaterLog = {
      id: generateBackfillId(dateKey),
      amount: missingAmount,
      timestamp: new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate(), 12, 0, 0).getTime(),
    };

    await Promise.all([
      saveLogsForDate(dateKey, [backfillLog, ...existingLogs]),
      saveGoalForDate(dateKey, period.summary.goal),
    ]);
    await refreshHistory();
  }, [anchorDate, canMarkComplete, period.summary.goal, refreshHistory]);
  const canGoNext = !samePeriodOrAfterToday(mode, anchorDate);
  const previousAnchorDate = React.useMemo(() => {
    if (mode === 'day') {
      return addDays(anchorDate, -1);
    }

    if (mode === 'week') {
      return addDays(anchorDate, -7);
    }

    if (mode === 'month') {
      return addMonths(anchorDate, -1);
    }

    return addYears(anchorDate, -1);
  }, [anchorDate, mode]);
  const canGoPrevious = overlapsUsageStart(mode, previousAnchorDate, usageStartDate);
  const pickerCells = React.useMemo(() => {
    const firstDay = new Date(pickerYear, pickerMonth - 1, 1);
    const leadingDays = (firstDay.getDay() + 6) % 7;
    const monthDayCount = new Date(pickerYear, pickerMonth, 0).getDate();
    const previousMonth = addCalendarMonths(pickerYear, pickerMonth, -1);
    const previousMonthDayCount = new Date(previousMonth.year, previousMonth.month, 0).getDate();

    return Array.from({ length: 42 }, (_, index) => {
      if (index < leadingDays) {
        const day = previousMonthDayCount - leadingDays + index + 1;
        return { date: new Date(previousMonth.year, previousMonth.month - 1, day), day, isCurrentMonth: false };
      }

      const dayInMonth = index - leadingDays + 1;
      if (dayInMonth <= monthDayCount) {
        return { date: new Date(pickerYear, pickerMonth - 1, dayInMonth), day: dayInMonth, isCurrentMonth: true };
      }

      const nextMonth = addCalendarMonths(pickerYear, pickerMonth, 1);
      const day = dayInMonth - monthDayCount;
      return { date: new Date(nextMonth.year, nextMonth.month - 1, day), day, isCurrentMonth: false };
    });
  }, [pickerMonth, pickerYear]);
  const openDatePicker = React.useCallback(() => {
    const nextYear = pickerYearValues.includes(anchorDate.getFullYear())
      ? anchorDate.getFullYear()
      : pickerYearValues[pickerYearValues.length - 1] ?? todayYear;
    const nextMonth = clampPickerMonth(nextYear, anchorDate.getMonth() + 1);
    setPickerYear(nextYear);
    setPickerMonth(nextMonth);
    setPickerDraftDate(
      mode === 'month'
        ? new Date(nextYear, nextMonth - 1, 1)
        : mode === 'year'
          ? new Date(nextYear, 0, 1)
          : anchorDate,
    );
    setIsDatePickerVisible(true);
  }, [anchorDate, clampPickerMonth, mode, pickerYearValues, todayYear]);
  const selectPickerDate = React.useCallback((date: Date) => {
    setPickerDraftDate(date);
  }, []);
  const handlePickerYearChange = React.useCallback((year: number) => {
    setPickerYear(year);
    if (mode === 'year') {
      setPickerDraftDate(new Date(year, 0, 1));
      return;
    }

    if (mode === 'month') {
      const nextMonth = clampPickerMonth(year, pickerMonth);
      setPickerMonth(nextMonth);
      setPickerDraftDate(new Date(year, nextMonth - 1, 1));
    }
  }, [clampPickerMonth, mode, pickerMonth]);
  const handlePickerMonthChange = React.useCallback((month: number) => {
    setPickerMonth(month);
    if (mode === 'month') {
      setPickerDraftDate(new Date(pickerYear, month - 1, 1));
    }
  }, [mode, pickerYear]);
  const confirmPickerDate = React.useCallback(() => {
    setAnchorDate(pickerDraftDate);
    setIsDatePickerVisible(false);
  }, [pickerDraftDate]);
  const movePickerMonth = React.useCallback((offset: -1 | 1) => {
    const next = addCalendarMonths(pickerYear, pickerMonth, offset);
    setPickerYear(next.year);
    setPickerMonth(next.month);
  }, [pickerMonth, pickerYear]);
  const availablePickerMonths = getAvailableMonthsForYear(pickerYear);
  const movePeriod = React.useCallback((direction: -1 | 1) => {
    setAnchorDate((current) => {
      const nextDate = (() => {
        if (mode === 'day') {
          return addDays(current, direction);
        }

        if (mode === 'week') {
          return addDays(current, direction * 7);
        }

        if (mode === 'month') {
          return addMonths(current, direction);
        }

        return addYears(current, direction);
      })();

      if (direction < 0 && !overlapsUsageStart(mode, nextDate, usageStartDate)) {
        return current;
      }

      if (mode === 'day') {
        return nextDate;
      }

      if (mode === 'week') {
        return nextDate;
      }

      if (mode === 'month') {
        return nextDate;
      }

      return nextDate;
    });
  }, [mode, usageStartDate]);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        language={language}
        style={styles.pageHeader}
      />

      <View style={styles.segmented}>
        {periods.map((periodOption) => {
          const selected = mode === periodOption.value;
          return (
            <Pressable
              key={periodOption.value}
              onPress={() => setMode(periodOption.value)}
              style={({ pressed }) => [
                styles.segmentButton,
                selected && styles.segmentButtonSelected,
                pressed && styles.segmentButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextSelected,
                ]}
              >
                {periodOption.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.periodNavigator}>
        <Pressable
          accessibilityLabel={copy.previous}
          disabled={!canGoPrevious}
          onPress={() => movePeriod(-1)}
          style={({ pressed }) => [
            styles.periodNavButton,
            !canGoPrevious && styles.periodNavButtonDisabled,
            pressed && canGoPrevious && styles.segmentButtonPressed,
          ]}
        >
          <Feather name="chevron-left" size={18} color={canGoPrevious ? colors.primary : colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={openDatePicker}
          style={({ pressed }) => [
            styles.periodNavigatorCenter,
            pressed && styles.segmentButtonPressed,
          ]}
        >
          <Feather name="calendar" size={14} color={colors.textSecondary} />
          <Text style={styles.periodNavigatorText}>{period.rangeLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={copy.next}
          disabled={!canGoNext}
          onPress={() => movePeriod(1)}
          style={({ pressed }) => [
            styles.periodNavButton,
            !canGoNext && styles.periodNavButtonDisabled,
            pressed && canGoNext && styles.segmentButtonPressed,
          ]}
        >
          <Feather name="chevron-right" size={18} color={canGoNext ? colors.primary : colors.textSecondary} />
        </Pressable>
      </View>

      <Modal
        visible={isDatePickerVisible}
        transparent
        animationType="fade"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={() => setIsDatePickerVisible(false)}
      >
        <View style={styles.pickerRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsDatePickerVisible(false)} />
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderCopy}>
                <Text style={styles.pickerTitle}>{copy.selectPeriod}</Text>
                <Text style={styles.pickerValue}>{draftPeriod.rangeLabel}</Text>
              </View>
              <Pressable
                onPress={() => setIsDatePickerVisible(false)}
                style={({ pressed }) => [
                  styles.pickerClose,
                  pressed && styles.segmentButtonPressed,
                ]}
              >
                <Feather name="x" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {mode === 'day' || mode === 'week' ? (
              <>
                <View style={styles.pickerMonthBar}>
                  <Pressable
                    accessibilityLabel={copy.previousMonth}
                    onPress={() => movePickerMonth(-1)}
                    style={({ pressed }) => [styles.pickerNavButton, pressed && styles.segmentButtonPressed]}
                  >
                    <Feather name="chevron-left" size={18} color={colors.textSecondary} />
                  </Pressable>
                  <Text style={styles.pickerMonthText}>{formatPickerMonth(pickerYear, pickerMonth, language)}</Text>
                  <Pressable
                    accessibilityLabel={copy.nextMonth}
                    onPress={() => movePickerMonth(1)}
                    style={({ pressed }) => [styles.pickerNavButton, pressed && styles.segmentButtonPressed]}
                  >
                    <Feather name="chevron-right" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.pickerWeekRow}>
                  {(language === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['一', '二', '三', '四', '五', '六', '日']).map((item, index) => (
                    <Text key={`${item}-${index}`} style={styles.pickerWeekText}>{item}</Text>
                  ))}
                </View>
                <View style={styles.pickerGrid}>
                  {pickerCells.map((cell) => {
                    const selected = mode === 'day'
                      ? toDateKey(cell.date) === toDateKey(pickerDraftDate)
                      : sameWeek(cell.date, pickerDraftDate);
                    const dayOfWeek = cell.date.getDay();
                    const isFutureDay = cell.date.getTime() > todayDate.getTime();
                    const isFutureWeek = startOfWeek(cell.date).getTime() > startOfWeek(todayDate).getTime();
                    const isBeforeUsageDay = Boolean(usageStartDate && cell.date.getTime() < usageStartDate.getTime());
                    const isBeforeUsageWeek = Boolean(usageStartDate && endOfWeek(cell.date).getTime() < usageStartDate.getTime());
                    const disabled = mode === 'day'
                      ? isFutureDay || isBeforeUsageDay
                      : isFutureWeek || isBeforeUsageWeek;
                    return (
                      <Pressable
                        key={toDateKey(cell.date)}
                        disabled={disabled}
                        onPress={() => selectPickerDate(mode === 'week' ? startOfWeek(cell.date) : cell.date)}
                        style={({ pressed }) => [
                          styles.pickerDayCell,
                          mode === 'week' && selected && styles.pickerWeekCellSelected,
                          mode === 'week' && selected && dayOfWeek === 1 && styles.pickerWeekCellStart,
                          mode === 'week' && selected && dayOfWeek === 0 && styles.pickerWeekCellEnd,
                          mode === 'day' && selected && styles.pickerDayCellSelected,
                          disabled && styles.pickerDayCellDisabled,
                          pressed && !disabled && styles.segmentButtonPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pickerDayText,
                            !cell.isCurrentMonth && styles.pickerDayTextMuted,
                            disabled && styles.pickerDayTextDisabled,
                            mode === 'day' && selected && styles.pickerDayTextSelected,
                            mode === 'week' && selected && styles.pickerWeekTextSelected,
                          ]}
                        >
                          {cell.day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {mode === 'month' ? (
              <View style={styles.wheelPickerColumns}>
                <WheelColumn
                  data={pickerYearValues}
                  selectedValue={pickerYear}
                  onValueChange={handlePickerYearChange}
                  colors={colors}
                />
                <WheelColumn
                  data={availablePickerMonths}
                  selectedValue={Math.min(pickerMonth, availablePickerMonths[availablePickerMonths.length - 1])}
                  onValueChange={handlePickerMonthChange}
                  colors={colors}
                />
              </View>
            ) : null}

            {mode === 'year' ? (
              <View style={styles.wheelPickerColumns}>
                <WheelColumn
                  data={pickerYearValues}
                  selectedValue={pickerYear}
                  onValueChange={handlePickerYearChange}
                  colors={colors}
                />
              </View>
            ) : null}
            <Pressable
              onPress={confirmPickerDate}
              style={({ pressed }) => [
                styles.pickerConfirmButton,
                pressed && styles.segmentButtonPressed,
              ]}
            >
              <Text style={styles.pickerConfirmText}>{copy.confirm}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.summaryCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{period.title}</Text>
            <View style={[
              styles.diffPill,
              period.summary.diff >= 0 && styles.diffPillGood,
            ]}>
              <Text style={[
                styles.diffPillText,
                period.summary.diff >= 0 && styles.diffPillTextGood,
              ]}>
                {formatDiff(period.summary.diff, language)}
              </Text>
            </View>
          </View>
          <View style={styles.dateBadge}>
            <Feather name="calendar" size={13} color={colors.textSecondary} />
            <Text style={styles.dateBadgeText}>{period.rangeLabel}</Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalValue}>{period.summary.total}</Text>
          <Text style={styles.totalUnit}>ml</Text>
        </View>
        <Text style={styles.goalText}>{copy.goal} {period.summary.goal} ml</Text>
        {canMarkComplete ? (
          <Pressable
            onPress={markDayComplete}
            style={({ pressed }) => [
              styles.markCompleteButton,
              pressed && styles.segmentButtonPressed,
            ]}
          >
            <View style={styles.markCompleteIcon}>
              <Feather name="check" size={14} color={colors.primary} />
            </View>
            <View style={styles.markCompleteCopy}>
              <Text style={styles.markCompleteText}>{copy.markComplete}</Text>
              <Text style={styles.markCompleteHint}>{copy.markCompleteHint}</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{formatPercent(period.summary.total, period.summary.goal)}</Text>
            <Text style={styles.metricLabel}>{copy.completion}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{average}</Text>
            <Text style={styles.metricLabel}>{copy.dailyAverage}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{mode === 'day' ? dayRecordCount : completedDays}</Text>
            <Text style={styles.metricLabel}>{mode === 'day' ? copy.recordCount : copy.completedDays}</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={[styles.cardHeader, styles.chartHeader]}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{period.trendTitle}</Text>
            <Feather name="bar-chart-2" size={17} color={colors.textSecondary} />
          </View>
          <View style={styles.dateBadge}>
            <Feather name="calendar" size={13} color={colors.textSecondary} />
            <Text style={styles.dateBadgeText}>{period.trendRangeLabel}</Text>
          </View>
        </View>

        {period.points.length > 0 ? (
          <View style={styles.chart}>
            {period.points.map((point, index) => {
              const totalHeight = Math.max(4, Math.round((point.total / maxValue) * 104));
              const goalHeight = Math.max(4, Math.round((point.goal / maxValue) * 104));
              const showLabel = point.showLabel ?? (period.points.length <= 12 || index === 0 || index === period.points.length - 1 || index % 5 === 0);

              return (
                <View key={point.key} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View style={[styles.goalBar, { height: goalHeight }]} />
                    <View
                      style={[
                        styles.totalBar,
                        point.total >= point.goal && styles.totalBarDone,
                        { height: totalHeight },
                      ]}
                    />
                  </View>
                  <Text numberOfLines={1} ellipsizeMode="clip" style={styles.barLabel}>
                    {showLabel ? point.label : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={22} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{copy.emptyTrend}</Text>
          </View>
        )}
      </View>

      <View style={styles.listCard}>
        <Text style={styles.cardTitle}>{copy.recent}</Text>
        {periodRecords.length > 0 ? (
          periodRecords.map((record) => (
            <View key={record.dateKey} style={styles.dayRow}>
              <View style={styles.dayCopy}>
                <Text style={styles.dayTitle}>{formatDayLabel(parseDateKey(record.dateKey))}</Text>
                <View style={styles.dayMetaRow}>
                  <Text style={styles.dayMeta}>{copy.allDay}</Text>
                  <View style={styles.dayDot} />
                  <Text style={styles.dayMeta}>{record.logs.length} {copy.entries}</Text>
                </View>
              </View>
              <View style={styles.dayValueGroup}>
                <Text style={styles.dayValue}>{record.total} ml</Text>
                <Text style={[
                  styles.dayDiff,
                  record.total >= record.goal && styles.dayDiffGood,
                ]}>
                  {formatDiff(record.total - record.goal, language)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{copy.emptyHistory}</Text>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function createStyles(colors: typeof Theme.colors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  pageHeader: {
    marginBottom: 18,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: Theme.radius.full,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonSelected: {
    backgroundColor: colors.surface,
  },
  segmentButtonPressed: {
    opacity: 0.72,
  },
  segmentText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  segmentTextSelected: {
    color: colors.primary,
  },
  periodNavigator: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  periodNavButton: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodNavButtonDisabled: {
    opacity: 0.42,
  },
  periodNavigatorCenter: {
    flex: 1,
    minHeight: 42,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  periodNavigatorText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: Theme.radius.card,
    padding: 18,
    marginBottom: 14,
    elevation: Theme.shadow.card.elevation,
    shadowColor: Theme.shadow.card.color,
    shadowOffset: { width: 0, height: Theme.shadow.card.offsetY },
    shadowOpacity: Theme.shadow.card.opacity,
    shadowRadius: Theme.shadow.card.radius,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: Theme.radius.card,
    padding: 18,
    marginBottom: 14,
    elevation: Theme.shadow.card.elevation,
    shadowColor: Theme.shadow.card.color,
    shadowOffset: { width: 0, height: Theme.shadow.card.offsetY },
    shadowOpacity: Theme.shadow.card.opacity,
    shadowRadius: Theme.shadow.card.radius,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: Theme.radius.card,
    padding: 18,
    marginBottom: 8,
    elevation: Theme.shadow.card.elevation,
    shadowColor: Theme.shadow.card.color,
    shadowOffset: { width: 0, height: Theme.shadow.card.offsetY },
    shadowOpacity: Theme.shadow.card.opacity,
    shadowRadius: Theme.shadow.card.radius,
  },
  cardHeader: {
    gap: 9,
    marginBottom: 14,
  },
  chartHeader: {
    marginBottom: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  dateBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateBadgeText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  diffPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  diffPillGood: {
    backgroundColor: colors.successSoft,
  },
  diffPillText: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
  },
  diffPillTextGood: {
    color: colors.success,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  totalValue: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 42,
    lineHeight: 48,
  },
  totalUnit: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    marginLeft: 6,
    marginBottom: 7,
  },
  goalText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  markCompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: Theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  markCompleteIcon: {
    width: 28,
    height: 28,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCompleteCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  markCompleteText: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  markCompleteHint: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    marginTop: 16,
    paddingVertical: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.border,
  },
  metricValue: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  chart: {
    minHeight: 148,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingTop: 4,
  },
  barColumn: {
    flex: 1,
    minWidth: 4,
    alignItems: 'center',
  },
  barTrack: {
    height: 108,
    width: '100%',
    minWidth: 4,
    maxWidth: 14,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  goalBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderRadius: Theme.radius.full,
    backgroundColor: colors.border,
  },
  totalBar: {
    width: '70%',
    borderRadius: Theme.radius.full,
    backgroundColor: colors.primary,
  },
  totalBarDone: {
    backgroundColor: colors.success,
  },
  barLabel: {
    minHeight: 14,
    width: 24,
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 7,
    textAlign: 'center',
  },
  emptyState: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dayCopy: {
    flex: 1,
    minWidth: 0,
  },
  dayTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  dayMeta: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  dayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  dayDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.border,
  },
  dayValueGroup: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  dayValue: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  dayDiff: {
    color: colors.primary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  dayDiffGood: {
    color: colors.success,
  },
  pickerRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: colors.backdrop,
  },
  pickerCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    elevation: Theme.shadow.floating.elevation,
    shadowColor: Theme.shadow.floating.color,
    shadowOffset: { width: 0, height: Theme.shadow.floating.offsetY },
    shadowOpacity: Theme.shadow.floating.opacity,
    shadowRadius: Theme.shadow.floating.radius,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pickerHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  pickerTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  pickerValue: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  pickerClose: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerMonthBar: {
    minHeight: 38,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    gap: 8,
  },
  pickerNavButton: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerNavButtonDisabled: {
    opacity: 0.45,
  },
  pickerMonthText: {
    flex: 1,
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    textAlign: 'center',
  },
  pickerWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerWeekText: {
    width: `${100 / 7}%`,
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 11,
    textAlign: 'center',
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
  },
  pickerDayCell: {
    width: `${100 / 7}%`,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerDayCellSelected: {
    backgroundColor: colors.primary,
    borderRadius: Theme.radius.full,
  },
  pickerWeekCellSelected: {
    backgroundColor: colors.primarySoft,
    borderRadius: 0,
  },
  pickerWeekCellStart: {
    borderTopLeftRadius: Theme.radius.full,
    borderBottomLeftRadius: Theme.radius.full,
  },
  pickerWeekCellEnd: {
    borderTopRightRadius: Theme.radius.full,
    borderBottomRightRadius: Theme.radius.full,
  },
  pickerDayText: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  pickerDayTextMuted: {
    color: colors.textSecondary,
    opacity: 0.38,
  },
  pickerDayCellDisabled: {
    opacity: 0.32,
  },
  pickerDayTextDisabled: {
    color: colors.textSecondary,
  },
  pickerDayTextSelected: {
    color: colors.surface,
  },
  pickerWeekTextSelected: {
    color: colors.primary,
  },
  pickerOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  pickerOption: {
    width: '30.8%',
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerOptionDisabled: {
    opacity: 0.36,
  },
  pickerOptionText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  pickerOptionTextDisabled: {
    color: colors.textSecondary,
  },
  pickerOptionTextSelected: {
    color: colors.surface,
  },
  wheelPickerColumns: {
    height: PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ITEMS,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerConfirmButton: {
    minHeight: 48,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerConfirmText: {
    color: colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
  },
  });
}
