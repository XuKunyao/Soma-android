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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';
import { AppText as Text } from '@/components/fixed-scale-text';
import {
  getTodayKey,
  loadWaterHistory,
  type LanguagePreference,
  type WaterDayRecord,
} from '@/utils/storage';

type PeriodMode = 'day' | 'week' | 'month' | 'year';

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

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, 0, 1);
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

function formatMonthRange(startDate: Date, endDate: Date, language: LanguagePreference): string {
  const start = formatCompactMonthLabel(startDate, language);
  const end = formatCompactMonthLabel(endDate, language);

  return start === end ? start : `${start} - ${end}`;
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
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

function getMonthDates(anchorDate: Date): Date[] {
  const today = parseDateKey(getTodayKey());
  const isCurrentMonth = anchorDate.getFullYear() === today.getFullYear()
    && anchorDate.getMonth() === today.getMonth();
  const dayCount = isCurrentMonth
    ? today.getDate()
    : new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();
  return Array.from({ length: dayCount }, (_, index) => (
    new Date(anchorDate.getFullYear(), anchorDate.getMonth(), index + 1)
  ));
}

function getYearMonths(anchorDate: Date): Date[] {
  const today = parseDateKey(getTodayKey());
  const monthCount = anchorDate.getFullYear() === today.getFullYear() ? today.getMonth() + 1 : 12;

  return Array.from({ length: monthCount }, (_, index) => (
    new Date(anchorDate.getFullYear(), index, 1)
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

function buildMonthWeekPoints(anchorDate: Date, recordMap: Map<string, WaterDayRecord>, fallbackGoal: number): TrendPoint[] {
  const dayPoints = buildDayPoints(getMonthDates(anchorDate), recordMap, fallbackGoal);
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

function buildMonthPoints(records: WaterDayRecord[], fallbackGoal: number, language: LanguagePreference, anchorDate: Date): TrendPoint[] {
  const months = getYearMonths(anchorDate);

  return months.map((date) => {
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthRecords = records.filter((record) => record.dateKey.startsWith(monthKey));
    const total = monthRecords.reduce((sum, record) => sum + record.total, 0);
    const today = parseDateKey(getTodayKey());
    const isCurrentMonth = date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth();
    const dayCount = isCurrentMonth
      ? today.getDate()
      : new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
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

function buildPeriod(mode: PeriodMode, records: WaterDayRecord[], fallbackGoal: number, language: LanguagePreference, anchorDate: Date): PeriodData {
  const recordMap = new Map(records.map((record) => [record.dateKey, record]));

  if (mode === 'day') {
    const dateKey = toDateKey(anchorDate);
    const record = recordMap.get(dateKey);
    const points = buildHourlyPoints(record, fallbackGoal);
    const dayPoint = {
      key: dateKey,
      label: formatDayLabel(anchorDate),
      total: record?.total ?? 0,
      goal: record?.goal ?? fallbackGoal,
    };
    return {
      title: samePeriodOrAfterToday('day', anchorDate) ? (language === 'en' ? 'Today' : '今日概览') : (language === 'en' ? 'Daily record' : '每日记录'),
      rangeLabel: `${formatFullDayLabel(anchorDate, language)} 00:00-23:59`,
      trendTitle: language === 'en' ? 'Hourly trend' : '分时完成趋势',
      trendRangeLabel: formatLogTimeRange(record, language),
      points,
      summary: sumPoints([dayPoint]),
    };
  }

  if (mode === 'week') {
    const weekStart = startOfWeek(anchorDate);
    const weekEnd = endOfWeek(anchorDate);
    const points = buildDayPoints(getDatesInRange(weekStart, weekEnd), recordMap, fallbackGoal);
    return {
      title: samePeriodOrAfterToday('week', anchorDate) ? (language === 'en' ? 'This week' : '本周汇总') : (language === 'en' ? 'Weekly record' : '每周记录'),
      rangeLabel: formatDateRange(weekStart, weekEnd, language),
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
    const monthWeekPoints = buildMonthWeekPoints(anchorDate, recordMap, fallbackGoal);
    return {
      title: samePeriodOrAfterToday('month', anchorDate) ? (language === 'en' ? 'This month' : '本月汇总') : (language === 'en' ? 'Monthly record' : '每月记录'),
      rangeLabel: formatDateRange(monthStart, monthEnd, language),
      trendTitle: language === 'en' ? 'Weekly trend' : '每周完成趋势',
      trendRangeLabel: formatMonthLabel(anchorDate, language),
      points: monthWeekPoints,
      summary: sumPoints(monthWeekPoints),
    };
  }

  const yearStart = new Date(anchorDate.getFullYear(), 0, 1);
  const today = parseDateKey(getTodayKey());
  const yearEnd = anchorDate.getFullYear() === today.getFullYear()
    ? today
    : new Date(anchorDate.getFullYear(), 11, 31);
  const yearEndMonth = new Date(yearEnd.getFullYear(), yearEnd.getMonth(), 1);
  const points = buildMonthPoints(records, fallbackGoal, language, anchorDate);
  return {
    title: samePeriodOrAfterToday('year', anchorDate) ? (language === 'en' ? 'This year' : '今年汇总') : (language === 'en' ? 'Yearly record' : '每年记录'),
    rangeLabel: formatMonthRange(yearStart, yearEndMonth, language),
    trendTitle: language === 'en' ? 'Monthly trend' : '每月完成趋势',
    trendRangeLabel: formatYearLabel(anchorDate, language),
    points,
    summary: sumPoints(points),
  };
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
  const language = state.settings.language;
  const copy = language === 'en'
    ? { title: 'Records', subtitle: 'See the rhythm of how you care for yourself', goal: 'Goal', completion: 'Completion', dailyAverage: 'Daily avg', completedDays: 'Days met', emptyTrend: 'Trends will appear after you start recording', recent: 'Records in this period', allDay: 'All day · 00:00-23:59', entries: 'records', emptyHistory: 'No records in this period', previous: 'Previous', next: 'Next' }
    : { title: '记录', subtitle: '看看身体被照顾的节律', goal: '目标', completion: '完成率', dailyAverage: '日均 ml', completedDays: '达标天数', emptyTrend: '开始记录后，这里会生成趋势', recent: '当前周期记录', allDay: '全天 · 00:00-23:59', entries: '次记录', emptyHistory: '这个周期还没有记录', previous: '上一段', next: '下一段' };
  const periods = React.useMemo(() => getPeriods(language), [language]);
  const [mode, setMode] = React.useState<PeriodMode>('week');
  const [anchorDate, setAnchorDate] = React.useState(() => parseDateKey(getTodayKey()));
  const [records, setRecords] = React.useState<WaterDayRecord[]>([]);

  const refreshHistory = React.useCallback(async () => {
    const history = await loadWaterHistory(state.settings.dailyGoal);
    setRecords(history);
  }, [state.settings.dailyGoal]);

  useFocusEffect(
    React.useCallback(() => {
      refreshHistory();
    }, [refreshHistory]),
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

  const period = React.useMemo(
    () => buildPeriod(mode, recordsForView, state.settings.dailyGoal, language, anchorDate),
    [anchorDate, language, mode, recordsForView, state.settings.dailyGoal],
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
    if (mode === 'day') {
      return recordsForView.filter((record) => record.dateKey === toDateKey(anchorDate));
    }

    if (mode === 'week') {
      const startKey = toDateKey(startOfWeek(anchorDate));
      const endKey = toDateKey(endOfWeek(anchorDate));
      return recordsForView.filter((record) => record.dateKey >= startKey && record.dateKey <= endKey);
    }

    if (mode === 'month') {
      const monthKey = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, '0')}`;
      return recordsForView.filter((record) => record.dateKey.startsWith(monthKey));
    }

    return recordsForView.filter((record) => record.dateKey.startsWith(`${anchorDate.getFullYear()}-`));
  }, [anchorDate, mode, recordsForView]);
  const canGoNext = !samePeriodOrAfterToday(mode, anchorDate);
  const movePeriod = React.useCallback((direction: -1 | 1) => {
    setAnchorDate((current) => {
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
    });
  }, [mode]);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{copy.title}</Text>
      <Text style={styles.pageSubtitle}>{copy.subtitle}</Text>

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
          onPress={() => movePeriod(-1)}
          style={({ pressed }) => [
            styles.periodNavButton,
            pressed && styles.segmentButtonPressed,
          ]}
        >
          <Feather name="chevron-left" size={18} color={colors.primary} />
        </Pressable>
        <View style={styles.periodNavigatorCenter}>
          <Feather name="calendar" size={14} color={colors.textSecondary} />
          <Text style={styles.periodNavigatorText}>{period.rangeLabel}</Text>
        </View>
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
            <Text style={styles.metricValue}>{completedDays}</Text>
            <Text style={styles.metricLabel}>{copy.completedDays}</Text>
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
              <View>
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
  pageTitle: {
    fontSize: Theme.type.pageTitle,
    fontFamily: Theme.fonts.medium,
    color: colors.text,
    letterSpacing: 0.5,
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
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
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dayTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  dayMeta: {
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
  });
}
