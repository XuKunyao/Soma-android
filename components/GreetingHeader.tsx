/**
 * GreetingHeader — 问候语头部组件
 *
 * 设计思路：
 * - 根据当前时间显示不同的温暖问候语
 * - 字体大号、留白充足，营造平静氛围
 * - 下方附带一句鼓励性的小语
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

/** 根据小时数返回问候语 */
function getGreeting(): { text: string; subtitle: string } {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return {
      text: '早上好',
      subtitle: '新的一天，慢慢开始',
    };
  } else if (hour >= 12 && hour < 18) {
    return {
      text: '下午好',
      subtitle: '忙碌之余，别忘了补充水分',
    };
  } else if (hour >= 18 && hour < 23) {
    return {
      text: '晚上好',
      subtitle: '辛苦了，照顾一下自己',
    };
  } else {
    return {
      text: '夜深了',
      subtitle: '早点休息，明天再继续',
    };
  }
}

export function GreetingHeader() {
  const { text, subtitle } = getGreeting();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{text}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  greeting: {
    fontSize: Theme.type.pageTitle,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    marginTop: 6,
    lineHeight: 22,
  },
});
