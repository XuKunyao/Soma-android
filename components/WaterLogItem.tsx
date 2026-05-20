/**
 * WaterLogItem — 饮水记录列表项
 *
 * 设计思路：
 * - 极简的单行布局：左侧饮水量，右侧时间
 * - 底部用极淡的分割线分隔
 * - 向左滑动露出右侧删除按钮
 * - 整体风格安静、不抢眼
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { AppText as Text } from '@/components/fixed-scale-text';
import { Feather } from '@expo/vector-icons';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';
import { resolveLanguagePreference } from '@/utils/language';

interface WaterLogItemProps {
  amount: number;       // 饮水量 (ml)
  timestamp: number;    // 时间戳 (ms)
  onDelete?: () => void;
  onOpen?: (swipeable: SwipeableMethods | null) => void;
  onPressItem?: () => void;
}

/** 将时间戳格式化为 "14:30" 格式 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function DeleteAction({
  progress,
  onDelete,
}: {
  progress: SharedValue<number>;
  onDelete?: () => void;
}) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { state } = useWater();
  const deleteLabel = resolveLanguagePreference(state.settings.language) === 'en' ? 'Delete' : '删除';
  const actionStyle = useAnimatedStyle(() => {
    const clampedProgress = Math.min(progress.value, 1.08);

    return {
      opacity: interpolate(
        clampedProgress,
        [0, 0.35, 0.92, 1.08],
        [0, 0.72, 1, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: interpolate(
            clampedProgress,
            [0, 0.86, 1.08],
            [22, -3, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            clampedProgress,
            [0, 0.82, 1.08],
            [0.9, 1.04, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <View style={styles.deleteActionWrap}>
      <Animated.View style={[styles.deleteActionMotion, actionStyle]}>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.deleteAction,
            pressed && styles.deleteActionPressed,
          ]}
        >
          <Feather name="trash-2" size={17} color={colors.surface} />
          <Text style={styles.deleteText}>{deleteLabel}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function WaterLogItem({
  amount,
  timestamp,
  onDelete,
  onOpen,
  onPressItem,
}: WaterLogItemProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const swipeableRef = React.useRef<SwipeableMethods>(null);
  const renderRightActions = (progress: SharedValue<number>) => (
    <DeleteAction progress={progress} onDelete={onDelete} />
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2.05}
      rightThreshold={40}
      overshootRight
      overshootFriction={7}
      animationOptions={{
        damping: 16,
        stiffness: 135,
        mass: 0.62,
      }}
      renderRightActions={renderRightActions}
      containerStyle={styles.swipeContainer}
      onSwipeableOpen={() => onOpen?.(swipeableRef.current)}
    >
      <Pressable
        onPress={onPressItem}
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.left}>
          <Feather name="droplet" size={16} color={colors.primary} />
          <Text style={styles.amount}>{amount} ml</Text>
        </View>
        <Text style={styles.time}>{formatTime(timestamp)}</Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

function createStyles(colors: typeof Theme.colors) {
  return StyleSheet.create({
  swipeContainer: {
    backgroundColor: colors.dangerSoft,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  amount: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: colors.text,
  },
  time: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: colors.textSecondary,
  },
  deleteActionWrap: {
    width: 82,
    backgroundColor: colors.dangerSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  deleteActionMotion: {
    flex: 1,
  },
  deleteAction: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  deleteActionPressed: {
    backgroundColor: colors.primaryPressed,
  },
  deleteText: {
    color: colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
  },
  });
}
