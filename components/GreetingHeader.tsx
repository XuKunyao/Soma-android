/**
 * GreetingHeader — 问候语头部组件
 *
 * 设计思路：
 * - 根据当前时间显示不同的温暖问候语
 * - 字体大号、留白充足，营造平静氛围
 * - 下方附带一句鼓励性的小语
 */

import React from 'react';
import { AppState } from 'react-native';
import { PageHeader } from '@/components/PageHeader';
import { useWater } from '@/contexts/WaterContext';
import { resolveLanguagePreference } from '@/utils/language';
import type { ResolvedLanguage } from '@/utils/storage';

/** 根据手机当前小时数返回问候语 */
function getGreeting(language: ResolvedLanguage, hour: number): { text: string; subtitle: string } {
  const greetings = language === 'en'
    ? {
      morning: { text: 'Good morning', subtitle: 'A new day can begin gently' },
      noon: { text: 'Good midday', subtitle: 'A quiet sip can reset the day' },
      afternoon: { text: 'Good afternoon', subtitle: 'Pause for a quiet sip' },
      evening: { text: 'Good evening', subtitle: 'Take care of yourself tonight' },
      night: { text: 'Late night', subtitle: 'Rest soon, and continue tomorrow' },
    }
    : {
      morning: { text: '早上好', subtitle: '新的一天，慢慢开始' },
      noon: { text: '中午好', subtitle: '给忙碌的中段，留一口水' },
      afternoon: { text: '下午好', subtitle: '忙碌之余，别忘了补充水分' },
      evening: { text: '晚上好', subtitle: '辛苦了，照顾一下自己' },
      night: { text: '夜深了', subtitle: '早点休息，明天再继续' },
    };

  if (hour >= 5 && hour < 11) {
    return greetings.morning;
  } else if (hour >= 11 && hour < 14) {
    return greetings.noon;
  } else if (hour >= 14 && hour < 18) {
    return greetings.afternoon;
  } else if (hour >= 18 && hour < 23) {
    return greetings.evening;
  } else {
    return greetings.night;
  }
}

export function GreetingHeader() {
  const { state } = useWater();
  const [currentHour, setCurrentHour] = React.useState(() => new Date().getHours());
  const language = resolveLanguagePreference(state.settings.language);
  const { text, subtitle } = getGreeting(language, currentHour);

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
    <PageHeader title={text} subtitle={subtitle} language={language} />
  );
}
