/**
 * 记录页 — 汇总长期饮水趋势
 *
 * 从本地按日期保存的饮水记录中汇总日、周、月、年的完成情况。
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { useWater } from '@/contexts/WaterContext';
import {
  getTodayKey,
  loadWaterHistory,
  type WaterDayRecord,
} from '@/utils/storage';

type PeriodMode = 'day' | 'week' | 'month' | 'year';

interface TrendPoint {
  key: string;
  label: string;
  total: number;
  goal: number;
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

const PERIODS: { label: string; value: PeriodMode }[] = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '年', value: 'year' },
];

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

function formatDayLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatFullDayLabel(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateRange(startDate: Date, endDate: Date): string {
  const start = formatFullDayLabel(startDate);
  const end = formatFullDayLabel(endDate);

  return start === end ? start : `${start}-${end}`;
}

function formatDiff(value: number): string {
  if (value === 0) {
    return '刚好达成';
  }

  return value > 0 ? `超出 ${value}ml` : `少 ${Math.abs(value)}ml`;
}

function sumPoints(points: TrendPoint[]) {
  const total = points.reduce((sum, point) => sum + point.total, 0);
  const goal = points.reduce((sum, point) => sum + point.goal, 0);
  return { total, goal, diff: total - goal };
}

function getRecentDates(count: number): Date[] {
  const today = parseDateKey(getTodayKey());
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

function getMonthDates(): Date[] {
  const today = parseDateKey(getTodayKey());
  return Array.from({ length: today.getDate() }, (_, index) => (
    new Date(today.getFullYear(), today.getMonth(), index + 1)
  ));
}

function getYearMonths(): Date[] {
  const today = parseDateKey(getTodayKey());
  return Array.from({ length: today.getMonth() + 1 }, (_, index) => (
    new Date(today.getFullYear(), index, 1)
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

function buildCurrentMonthWeekPoints(recordMap: Map<string, WaterDayRecord>, fallbackGoal: number): TrendPoint[] {
  const dayPoints = buildDayPoints(getMonthDates(), recordMap, fallbackGoal);
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

function buildMonthPoints(records: WaterDayRecord[], fallbackGoal: number): TrendPoint[] {
  const months = getYearMonths();

  return months.map((date) => {
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthRecords = records.filter((record) => record.dateKey.startsWith(monthKey));
    const total = monthRecords.reduce((sum, record) => sum + record.total, 0);
    const dayCount = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const elapsedDays = date.getMonth() === parseDateKey(getTodayKey()).getMonth()
      ? parseDateKey(getTodayKey()).getDate()
      : dayCount;
    const savedGoal = monthRecords.reduce((sum, record) => sum + record.goal, 0);
    const missingGoal = Math.max(0, elapsedDays - monthRecords.length) * fallbackGoal;

    return {
      key: monthKey,
      label: `${date.getMonth() + 1}月`,
      total,
      goal: savedGoal + missingGoal,
    };
  });
}

function buildPeriod(mode: PeriodMode, records: WaterDayRecord[], fallbackGoal: number): PeriodData {
  const recordMap = new Map(records.map((record) => [record.dateKey, record]));
  const today = parseDateKey(getTodayKey());
  const recentDates = getRecentDates(7);
  const recentRange = formatDateRange(recentDates[0], recentDates[recentDates.length - 1]);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const monthWeekPoints = buildCurrentMonthWeekPoints(recordMap, fallbackGoal);

  if (mode === 'day') {
    const points = buildDayPoints(recentDates, recordMap, fallbackGoal);
    const today = points[points.length - 1];
    return {
      title: '今日概览',
      rangeLabel: `${formatFullDayLabel(parseDateKey(getTodayKey()))} 00:00-23:59`,
      trendTitle: '近 7 天趋势',
      trendRangeLabel: recentRange,
      points,
      summary: sumPoints([today]),
    };
  }

  if (mode === 'week') {
    const points = buildDayPoints(recentDates, recordMap, fallbackGoal);
    return {
      title: '近 7 天',
      rangeLabel: recentRange,
      trendTitle: '每日完成趋势',
      trendRangeLabel: recentRange,
      points,
      summary: sumPoints(points),
    };
  }

  if (mode === 'month') {
    return {
      title: '本月汇总',
      rangeLabel: formatDateRange(monthStart, today),
      trendTitle: '本月每周的趋势',
      trendRangeLabel: formatDateRange(monthStart, today),
      points: monthWeekPoints,
      summary: sumPoints(monthWeekPoints),
    };
  }

  const points = buildMonthPoints(records, fallbackGoal);
  return {
    title: '今年汇总',
    rangeLabel: formatDateRange(yearStart, today),
    trendTitle: '每月完成趋势',
    trendRangeLabel: formatDateRange(yearStart, today),
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
  const { state } = useWater();
  const [mode, setMode] = React.useState<PeriodMode>('week');
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
    () => buildPeriod(mode, recordsForView, state.settings.dailyGoal),
    [mode, recordsForView, state.settings.dailyGoal],
  );
  const maxValue = Math.max(
    1,
    ...period.points.map((point) => Math.max(point.total, point.goal)),
  );
  const average = period.points.length > 0
    ? Math.round(period.summary.total / period.points.length)
    : 0;
  const completedDays = period.points.filter((point) => point.total >= point.goal && point.total > 0).length;
  const recentRecords = recordsForView.slice(0, 7);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>记录</Text>
      <Text style={styles.pageSubtitle}>看看身体被照顾的节律</Text>

      <View style={styles.segmented}>
        {PERIODS.map((periodOption) => {
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

      <View style={styles.summaryCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.cardTitle}>{period.title}</Text>
            <Text style={styles.cardRange}>{period.rangeLabel}</Text>
          </View>
          <View style={[
            styles.diffPill,
            period.summary.diff >= 0 && styles.diffPillGood,
          ]}>
            <Text style={[
              styles.diffPillText,
              period.summary.diff >= 0 && styles.diffPillTextGood,
            ]}>
              {formatDiff(period.summary.diff)}
            </Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalValue}>{period.summary.total}</Text>
          <Text style={styles.totalUnit}>ml</Text>
        </View>
        <Text style={styles.goalText}>目标 {period.summary.goal} ml</Text>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{formatPercent(period.summary.total, period.summary.goal)}</Text>
            <Text style={styles.metricLabel}>完成率</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{average}</Text>
            <Text style={styles.metricLabel}>日均 ml</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{completedDays}</Text>
            <Text style={styles.metricLabel}>达标天数</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.cardTitle}>{period.trendTitle}</Text>
            <Text style={styles.cardRange}>{period.trendRangeLabel}</Text>
          </View>
          <Feather name="bar-chart-2" size={17} color={Theme.colors.textSecondary} />
        </View>

        {period.points.length > 0 ? (
          <View style={styles.chart}>
            {period.points.map((point, index) => {
              const totalHeight = Math.max(4, Math.round((point.total / maxValue) * 104));
              const goalHeight = Math.max(4, Math.round((point.goal / maxValue) * 104));
              const showLabel = period.points.length <= 12 || index === 0 || index === period.points.length - 1 || index % 5 === 0;

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
                  <Text style={styles.barLabel}>{showLabel ? point.label : ''}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={22} color={Theme.colors.textSecondary} />
            <Text style={styles.emptyText}>开始记录后，这里会生成趋势</Text>
          </View>
        )}
      </View>

      <View style={styles.listCard}>
        <Text style={styles.cardTitle}>最近记录</Text>
        {recentRecords.length > 0 ? (
          recentRecords.map((record) => (
            <View key={record.dateKey} style={styles.dayRow}>
              <View>
                <Text style={styles.dayTitle}>{formatDayLabel(parseDateKey(record.dateKey))}</Text>
                <Text style={styles.dayMeta}>00:00-23:59 · {record.logs.length} 次记录</Text>
              </View>
              <View style={styles.dayValueGroup}>
                <Text style={styles.dayValue}>{record.total} ml</Text>
                <Text style={[
                  styles.dayDiff,
                  record.total >= record.goal && styles.dayDiffGood,
                ]}>
                  {formatDiff(record.total - record.goal)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>还没有历史记录</Text>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    letterSpacing: 0.5,
  },
  pageSubtitle: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#EFE9DF',
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
    backgroundColor: Theme.colors.surface,
  },
  segmentButtonPressed: {
    opacity: 0.72,
  },
  segmentText: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  segmentTextSelected: {
    color: Theme.colors.primary,
  },
  summaryCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.card,
    padding: 18,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#1A1612',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  chartCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.card,
    padding: 18,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#1A1612',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  listCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.card,
    padding: 18,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#1A1612',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  cardHeaderCopy: {
    flex: 1,
  },
  cardTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  cardRange: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  diffPill: {
    backgroundColor: '#F8EEE7',
    borderRadius: Theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  diffPillGood: {
    backgroundColor: '#ECF1E8',
  },
  diffPillText: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
  },
  diffPillTextGood: {
    color: Theme.colors.success,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  totalValue: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 42,
    lineHeight: 48,
  },
  totalUnit: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    marginLeft: 6,
    marginBottom: 7,
  },
  goalText: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
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
    backgroundColor: Theme.colors.border,
  },
  metricValue: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  metricLabel: {
    color: Theme.colors.textSecondary,
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
    paddingTop: 8,
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
    maxWidth: 18,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  goalBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderRadius: Theme.radius.full,
    backgroundColor: '#E8E2D9',
  },
  totalBar: {
    width: '78%',
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.primary,
  },
  totalBarDone: {
    backgroundColor: Theme.colors.success,
  },
  barLabel: {
    minHeight: 14,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 7,
  },
  emptyState: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: Theme.colors.textSecondary,
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
    borderBottomColor: Theme.colors.border,
  },
  dayTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  dayMeta: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  dayValueGroup: {
    alignItems: 'flex-end',
  },
  dayValue: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  dayDiff: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  dayDiffGood: {
    color: Theme.colors.success,
  },
});
