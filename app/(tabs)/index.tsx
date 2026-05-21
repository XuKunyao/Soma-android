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
  Modal,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Theme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';
import { WaterProgress } from '@/components/WaterProgress';
import { WaterLogItem } from '@/components/WaterLogItem';
import { GreetingHeader } from '@/components/GreetingHeader';
import { AppText as Text } from '@/components/fixed-scale-text';
import { resolveLanguagePreference } from '@/utils/language';

const HOME_CUP_IMAGE = require('../../assets/images/home-cup.png');
const HOME_CUP_IMAGE_DARK = require('../../assets/images/home-cup-dark.png');
const COMPLETION_CARD_IMAGE = require('../../assets/images/completion-card.png');
const COMPLETION_CARD_IMAGE_DARK = require('../../assets/images/completion-card-dark.png');
const COMPLETION_MESSAGES = {
  en: [
    'You showed up for yourself today',
    'A small promise, beautifully kept',
    'Your body will remember this kindness',
    'Steady care counts, and you did it',
    'One gentle habit got stronger today',
  ],
  zh: [
    '今天也有好好喝水的你真的很棒',
    '对自己的温柔身体都偷偷收到啦',
    '每一口水都是送给自己的小礼物',
    '再忙也记得喝水的人运气不会太差',
    '今天有在认真照顾自己',
    '身体会记住每一个被你善待的日子',
    '愿意照顾自己这件事本身就很了不起',
    '今天的任务完成了给自己一个大拇指',
    '慢慢养成的习惯是最长情的自我陪伴',
    '不管今天过得怎样至少喝够水了',
    '你在用最小的行动做最温柔的事',
    '把自己放在心上的人会越来越好的',
    '今天又为自己做了一件小而确定的事',
    '愿你每天都能轻轻地把自己放在第一位',
  ],
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, width), [colors, width]);
  const { state, addWater, deleteLog } = useWater();
  const { todayLogs, todayTotal, settings, isLoaded } = state;
  const language = resolveLanguagePreference(settings.language);
  const addButtonContentColor = isDark ? colors.text : colors.surface;
  const copy = language === 'en'
    ? {
      completedTitle: 'Goal complete',
      add: 'Drank a glass',
      logs: 'Today\'s records',
      added: 'Recorded',
    }
    : {
      completedTitle: '今天的小目标完成啦',
      add: '喝了一杯',
      logs: '今日记录',
      added: '已记录',
  };
  const openLogActionRef = React.useRef<SwipeableMethods | null>(null);
  const completionProgress = React.useRef(new Animated.Value(0)).current;
  const [hasShownCompletionCardForCurrentGoal, setHasShownCompletionCardForCurrentGoal] = React.useState(false);
  const [isCompletionCardVisible, setIsCompletionCardVisible] = React.useState(false);
  const [completionMessage, setCompletionMessage] = React.useState(
    () => COMPLETION_MESSAGES[language][0],
  );

  const closeOpenLogAction = React.useCallback(() => {
    openLogActionRef.current?.close();
    openLogActionRef.current = null;
  }, []);

  const hideCompletionCard = React.useCallback(() => {
    Animated.timing(completionProgress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsCompletionCardVisible(false);
      }
    });
  }, [completionProgress]);

  React.useEffect(() => {
    if (!isCompletionCardVisible) {
      return;
    }

    const timeout = setTimeout(() => {
      hideCompletionCard();
    }, 6500);

    return () => clearTimeout(timeout);
  }, [hideCompletionCard, isCompletionCardVisible]);

  React.useEffect(() => {
    if (todayTotal < settings.dailyGoal) {
      setHasShownCompletionCardForCurrentGoal(false);
    }
  }, [settings.dailyGoal, todayTotal]);

  const showCompletionCardOnce = React.useCallback(() => {
    const messages = COMPLETION_MESSAGES[language];
    setCompletionMessage(messages[Math.floor(Math.random() * messages.length)]);
    setHasShownCompletionCardForCurrentGoal(true);
    completionProgress.stopAnimation();
    completionProgress.setValue(0);
    setIsCompletionCardVisible(true);
    requestAnimationFrame(() => {
      Animated.spring(completionProgress, {
        toValue: 1,
        damping: 15,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    });
  }, [completionProgress, language]);

  const completionCardAnimatedStyle = React.useMemo(() => ({
    opacity: completionProgress,
    transform: [
      {
        translateY: completionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: completionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  }), [completionProgress]);

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
    const willReachGoal = todayTotal < settings.dailyGoal
      && todayTotal + settings.cupSize >= settings.dailyGoal
      && !hasShownCompletionCardForCurrentGoal;

    if (willReachGoal) {
      showCompletionCardOnce();
    }

    addWater();
  }, [
    addWater,
    closeOpenLogAction,
    copy.added,
    hasShownCompletionCardForCurrentGoal,
    settings.cupSize,
    settings.dailyGoal,
    showCompletionCardOnce,
    todayTotal,
  ]);

  // 数据加载中时显示空白（启动屏仍然可见）
  if (!isLoaded) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={closeOpenLogAction}
      >
        <View pointerEvents="none" style={styles.homeCupImageWrap}>
          <Image
            source={isDark ? HOME_CUP_IMAGE_DARK : HOME_CUP_IMAGE}
            style={styles.homeCupImage}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
        {/* 问候语 */}
        <View style={styles.homeHeader} onTouchStart={closeOpenLogAction}>
          <GreetingHeader />
        </View>

        {/* 圆形进度指示器 */}
        <View style={styles.progressSection} onTouchStart={closeOpenLogAction}>
          <WaterProgress current={todayTotal} goal={settings.dailyGoal} />
        </View>

        {/* 喝了一杯按钮 */}
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={handleAddWater}
        >
          <Feather name="plus" size={19} color={addButtonContentColor} />
          <Text style={[styles.addButtonText, { color: addButtonContentColor }]}>
            {copy.add} ({settings.cupSize}ml)
          </Text>
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

      <Modal
        visible={isCompletionCardVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={hideCompletionCard}
      >
        <View style={styles.completionModalRoot}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.completionBackdrop,
              { opacity: completionProgress },
            ]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={hideCompletionCard} />
          <Animated.View style={[styles.completedCard, completionCardAnimatedStyle]}>
            <Pressable
              onPress={hideCompletionCard}
              hitSlop={8}
              style={({ pressed }) => [
                styles.completedCloseButton,
                pressed && styles.completedCloseButtonPressed,
              ]}
            >
              <Feather name="x" size={14} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.completedImageStage}>
              <Image
                source={isDark ? COMPLETION_CARD_IMAGE_DARK : COMPLETION_CARD_IMAGE}
                style={styles.completedImage}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>
            <View style={styles.completedCopy}>
              <Text style={[styles.completedTitle, language === 'en' && styles.completedTitleEnglish]}>
                {copy.completedTitle}
              </Text>
              <Text
                style={[styles.completedBody, language === 'en' ? styles.completedBodyEnglish : styles.completedBodyChinese]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.88}
              >
                {completionMessage}
              </Text>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: typeof Theme.colors, width: number) {
  const compact = width < 380;
  const pagePadding = 24;
  const homeIllustrationWidth = compact ? 78 : 95;
  const homeIllustrationHeight = compact ? 52 : 62;
  const completionCardSize = Math.min(286, width - pagePadding * 2);

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: pagePadding,
    paddingBottom: 20,
    position: 'relative',
  },
  homeHeader: {
    paddingRight: homeIllustrationWidth + (compact ? 8 : 14),
    minWidth: 0,
  },
  homeCupImageWrap: {
    position: 'absolute',
    top: 8,
    right: pagePadding,
    width: homeIllustrationWidth,
    height: homeIllustrationHeight,
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
  completionModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  completionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  completedCard: {
    alignSelf: 'center',
    width: completionCardSize,
    minHeight: completionCardSize,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: Theme.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    overflow: 'hidden',
    elevation: Theme.shadow.card.elevation,
    shadowColor: Theme.shadow.card.color,
    shadowOffset: { width: 0, height: Theme.shadow.card.offsetY },
    shadowOpacity: Theme.shadow.card.opacity,
    shadowRadius: Theme.shadow.card.radius,
  },
  completedCopy: {
    alignItems: 'center',
    gap: 7,
    alignSelf: 'stretch',
  },
  completedImageStage: {
    width: 174,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  completedImage: {
    width: '100%',
    height: '100%',
  },
  completedTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 31,
    fontFamily: Theme.fonts.display,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0,
  },
  completedTitleEnglish: {
    fontFamily: Theme.fonts.displayEn,
    lineHeight: 33,
  },
  completedBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Theme.fonts.regular,
    textAlign: 'center',
  },
  completedBodyEnglish: {
    fontFamily: Theme.fonts.displayEn,
    lineHeight: 22,
  },
  completedBodyChinese: {
    fontFamily: Theme.fonts.display,
    lineHeight: 22,
  },
  completedCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  completedCloseButtonPressed: {
    opacity: 0.72,
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
