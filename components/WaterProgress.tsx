/**
 * WaterProgress — 圆形进度指示器
 *
 * 设计思路：
 * - 使用 SVG 绘制一个柔和的弧形进度环
 * - 背景环用淡暖色，进度环用珊瑚橙
 * - 达标后进度环变为柔和绿色，给用户正向反馈
 * - 中心显示当前饮水量/目标量
 * - 弧线端点圆润（strokeLinecap="round"），避免生硬
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';

interface WaterProgressProps {
  current: number;    // 当前饮水量 (ml)
  goal: number;       // 目标量 (ml)
}

export function WaterProgress({ current, goal }: WaterProgressProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const size = 214;                    // 圆环尺寸
  const strokeWidth = 9;              // 线条粗细
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // 计算进度（0 到 1，最大为 1）
  const progress = Math.min(current / goal, 1);
  // SVG strokeDashoffset 控制弧线长度
  const strokeDashoffset = circumference * (1 - progress);

  // 达标后变绿色
  const progressColor = progress >= 1
    ? colors.success
    : colors.primary;

  // 格式化显示（毫升转升）
  const currentDisplay = (current / 1000).toFixed(1);
  const goalDisplay = (goal / 1000).toFixed(1);

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 背景轨道环 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.trackBackground}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* 进度弧线 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          // 从顶部（12点钟方向）开始
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/* 中心文字 */}
      <View style={styles.textContainer}>
        <Text style={styles.currentText}>{currentDisplay}</Text>
        <Text style={styles.dividerText}>/ {goalDisplay} L</Text>
      </View>
    </View>
  );
}

function createStyles(colors: typeof Theme.colors) {
  return StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  currentText: {
    fontSize: Theme.type.metric,
    fontFamily: Theme.fonts.medium,
    color: colors.text,
    letterSpacing: 0,
  },
  dividerText: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  });
}
