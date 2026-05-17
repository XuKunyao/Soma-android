/**
 * GreetingHeader — 问候语头部组件
 *
 * 设计思路：
 * - 根据当前时间显示不同的温暖问候语
 * - 字体大号、留白充足，营造平静氛围
 * - 下方附带一句鼓励性的小语
 */

import React from 'react';
import { AppState, View, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/fixed-scale-text';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';
import type { LanguagePreference } from '@/utils/storage';

/** 根据手机当前小时数返回问候语 */
function getGreeting(language: LanguagePreference, hour: number): { text: string; subtitle: string } {
  const greetings = language === 'en'
    ? {
      morning: { text: 'Good morning', subtitle: 'A new day can begin gently' },
      afternoon: { text: 'Good afternoon', subtitle: 'Pause for a sip between busy moments' },
      evening: { text: 'Good evening', subtitle: 'You have done enough. Take care of yourself' },
      night: { text: 'Late night', subtitle: 'Rest soon, and continue tomorrow' },
    }
    : {
      morning: { text: '早上好', subtitle: '新的一天，慢慢开始' },
      afternoon: { text: '下午好', subtitle: '忙碌之余，别忘了补充水分' },
      evening: { text: '晚上好', subtitle: '辛苦了，照顾一下自己' },
      night: { text: '夜深了', subtitle: '早点休息，明天再继续' },
    };

  if (hour >= 5 && hour < 12) {
    return greetings.morning;
  } else if (hour >= 12 && hour < 18) {
    return greetings.afternoon;
  } else if (hour >= 18 && hour < 23) {
    return greetings.evening;
  } else {
    return greetings.night;
  }
}

export function GreetingHeader() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { state } = useWater();
  const [currentHour, setCurrentHour] = React.useState(() => new Date().getHours());
  const { text, subtitle } = getGreeting(state.settings.language, currentHour);

  React.useEffect(() => {
    const syncHour = () => {
      setCurrentHour(new Date().getHours());
    };

    const timer = setInterval(syncHour, 60 * 1000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncHour();
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{text}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function createStyles(colors: typeof Theme.colors) {
  return StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  greeting: {
    fontSize: Theme.type.pageTitle,
    fontFamily: Theme.fonts.medium,
    color: colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 22,
  },
  });
}
