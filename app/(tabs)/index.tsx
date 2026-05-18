/**
 * 首页 — 喝水追踪主界面
 *
 * 布局结构（从上到下）：
 * 1. 问候语 — 根据时间显示温暖的问候
 * 2. 圆形进度 — 大号弧形显示今日进度
 * 3. "喝了一杯"按钮 — 核心操作
 * 4. 今日记录列表 — 带时间戳的饮水记录
 *
 * 设计原则：
 * - 界面元素越少越好，只保留核心内容
 * - 大量留白，让内容有呼吸感
 * - 按钮使用品牌珊瑚橙色，是页面唯一的强调色
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ToastAndroid,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';
import { WaterProgress } from '@/components/WaterProgress';
import { WaterLogItem } from '@/components/WaterLogItem';
import { GreetingHeader } from '@/components/GreetingHeader';
import { AppText as Text } from '@/components/fixed-scale-text';

const HOME_CUP_IMAGE = require('../../assets/images/home-cup.png');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { state, addWater, deleteLog } = useWater();
  const { todayLogs, todayTotal, settings, isLoaded } = state;
  const copy = settings.language === 'en'
    ? { completed: 'Today\'s goal is complete', add: 'Drank a glass', logs: 'Today\'s records', added: 'Recorded' }
    : { completed: '今日目标已完成', add: '喝了一杯', logs: '今日记录', added: '已记录' };
  const openLogActionRef = React.useRef<SwipeableMethods | null>(null);

  const closeOpenLogAction = React.useCallback(() => {
    openLogActionRef.current?.close();
    openLogActionRef.current = null;
  }, []);

  const handleLogOpen = React.useCallback((swipeable: SwipeableMethods | null) => {
    if (openLogActionRef.current && openLogActionRef.current !== swipeable) {
      openLogActionRef.current.close();
    }

    openLogActionRef.current = swipeable;
  }, []);

  const handleAddWater = React.useCallback(() => {
    closeOpenLogAction();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
    if (Platform.OS === 'android') {
      ToastAndroid.show(`${copy.added} ${settings.cupSize}ml`, ToastAndroid.SHORT);
    }
    addWater();
  }, [addWater, closeOpenLogAction, copy.added, settings.cupSize]);

  // 数据加载中时显示空白（启动屏仍然可见）
  if (!isLoaded) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={closeOpenLogAction}
    >
      <View pointerEvents="none" style={styles.homeCupImageWrap}>
        <Image
          source={HOME_CUP_IMAGE}
          style={styles.homeCupImage}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
      {/* 问候语 */}
      <View onTouchStart={closeOpenLogAction}>
        <GreetingHeader />
      </View>

      {/* 圆形进度指示器 */}
      <View style={styles.progressSection} onTouchStart={closeOpenLogAction}>
        <WaterProgress current={todayTotal} goal={settings.dailyGoal} />
      </View>

      {/* 达标提示 */}
      {todayTotal >= settings.dailyGoal && (
        <Text style={styles.completedText}>
          {copy.completed}
        </Text>
      )}

      {/* 喝了一杯按钮 */}
      <Pressable
        style={({ pressed }) => [
          styles.addButton,
          pressed && styles.addButtonPressed,
        ]}
        onPress={handleAddWater}
      >
        <Feather name="plus" size={19} color={colors.surface} />
        <Text style={styles.addButtonText}>{copy.add} ({settings.cupSize}ml)</Text>
      </Pressable>

      {/* 今日记录 */}
      {todayLogs.length > 0 && (
        <View style={styles.logSection}>
          <Text style={styles.logTitle} onPress={closeOpenLogAction}>{copy.logs}</Text>
          <View style={styles.logCard}>
            {todayLogs.map((log) => (
              <WaterLogItem
                key={log.id}
                amount={log.amount}
                timestamp={log.timestamp}
                onOpen={handleLogOpen}
                onPressItem={closeOpenLogAction}
                onDelete={() => {
                  closeOpenLogAction();
                  deleteLog(log.id);
                }}
              />
            ))}
          </View>
        </View>
      )}

      {/* 底部留白 */}
      <View style={{ height: 32 }} onTouchStart={closeOpenLogAction} />
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
    position: 'relative',
  },
  homeCupImageWrap: {
    position: 'absolute',
    top: 8,
    right: 24,
    width: 95,
    height: 62,
    opacity: 0.96,
  },
  homeCupImage: {
    width: '100%',
    height: '100%',
  },
  progressSection: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 22,
  },
  completedText: {
    textAlign: 'center',
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
    color: colors.success,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: Theme.radius.button,
    minHeight: 54,
    paddingHorizontal: 18,
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  addButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  addButtonText: {
    color: colors.surface,
    fontSize: 17,
    fontFamily: Theme.fonts.medium,
    letterSpacing: 0.3,
  },
  logSection: {
    marginBottom: 8,
  },
  logTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  logCard: {
    backgroundColor: colors.surface,
    borderRadius: Theme.radius.card,
    overflow: 'hidden',
    // 极轻阴影 — 相当于 elevation 1dp
    elevation: Theme.shadow.card.elevation,
    shadowColor: Theme.shadow.card.color,
    shadowOffset: { width: 0, height: Theme.shadow.card.offsetY },
    shadowOpacity: Theme.shadow.card.opacity,
    shadowRadius: Theme.shadow.card.radius,
  },
  });
}
