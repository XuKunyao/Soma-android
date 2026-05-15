/**
 * 设置页 — 极简设置界面
 *
 * 三个设置项：
 * 1. 每日饮水目标（滑动调节，500-4000ml）
 * 2. 单次饮水量（可选 100/150/200/250/300/400/500ml）
 * 3. 提醒间隔（可选 30分/1小时/1.5小时/2小时/3小时，可关闭）
 *
 * 设计原则：
 * - 每个设置项使用卡片包裹
 * - 选项使用柔和的选择芯片（Chip），而非下拉菜单
 * - 温暖的描述文字解释每个设置的含义
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Image,
  Platform,
  useWindowDimensions,
  Alert,
  Switch,
  Keyboard,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, ViewToken } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';
import { AppText as Text, AppTextInput as TextInput } from '@/components/fixed-scale-text';
import { buildWaterDataExport } from '@/utils/storage';

function DeleteTimeAction({
  progress,
  onDelete,
}: {
  progress: SharedValue<number>;
  onDelete?: () => void;
}) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const layout = React.useMemo(() => createSettingsLayout(width), [width]);
  const styles = React.useMemo(() => createStyles(colors, layout), [colors, layout]);
  const { state } = useWater();
  const deleteLabel = state.settings.language === 'en' ? 'Delete' : '删除';

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
    <View style={styles.exactTimeDeleteWrap}>
      <Animated.View style={[styles.exactTimeDeleteMotion, actionStyle]}>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.exactTimeDeleteAction,
            pressed && styles.exactTimeDeleteActionPressed,
          ]}
        >
          <Feather name="trash-2" size={17} color={colors.surface} />
          <Text style={styles.exactTimeDeleteText}>{deleteLabel}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** 可选的单次饮水量 */
const CUP_SIZES = [100, 150, 200, 250, 300, 400, 500];

/** 可选的提醒间隔（分钟） */
const BASE_INTERVALS = [
  { label: '关闭', labelEn: 'Off', value: 0, kind: 'off' as const },
  { label: '30 分钟', labelEn: '30 min', value: 30, kind: 'preset' as const },
  { label: '1 小时', labelEn: '1 hour', value: 60, kind: 'preset' as const },
  { label: '1.5 小时', labelEn: '1.5 hours', value: 90, kind: 'preset' as const },
  { label: '2 小时', labelEn: '2 hours', value: 120, kind: 'preset' as const },
];

const DEFAULT_CUSTOM_INTERVAL_OPTION = {
  label: '3 小时',
  labelEn: '3 hours',
  value: 180,
  kind: 'defaultCustom' as const,
};

const TIME_HOURS = Array.from({ length: 24 }, (_, index) => index);
const TIME_MINUTES = Array.from({ length: 60 }, (_, index) => index);
const PICKER_ITEM_HEIGHT = 44;
const PICKER_VISIBLE_ITEMS = 5;

const LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh' as const },
  { label: 'English', value: 'en' as const },
];

const APPEARANCE_OPTIONS = {
  zh: [
    { label: '跟随系统', value: 'system' as const },
    { label: '浅色', value: 'light' as const },
    { label: '深色', value: 'dark' as const },
  ],
  en: [
    { label: 'System', value: 'system' as const },
    { label: 'Light', value: 'light' as const },
    { label: 'Dark', value: 'dark' as const },
  ],
};

/** 可选的每日目标 */
const DAILY_GOALS = [1000, 1500, 2000, 2500, 3000, 3500, 4000];
const BASE_WEIGHT_SLOPE = 14;
const HYDRATION_GOAL_IMAGE = require('../../assets/images/hydration-goal-illustration.png');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high';
type SexProfile = 'unspecified' | 'female' | 'male';
type DietProfile = 'hydrating' | 'balanced' | 'salty';
type PressableStyle = React.ComponentProps<typeof Pressable>['style'];
type SettingsLayout = ReturnType<typeof createSettingsLayout>;
type IntervalUnit = 'min' | 'hour';
type TimePickerTarget = 'quietStart' | 'quietEnd' | 'reminderTime';

type SoftPressableProps = Omit<React.ComponentProps<typeof Pressable>, 'style'> & {
  scaleTo?: number;
  style?: PressableStyle;
};

function SoftPressable({
  children,
  disabled,
  onPressIn,
  onPressOut,
  scaleTo = 0.99,
  style,
  ...props
}: SoftPressableProps) {
  const [pressed, setPressed] = React.useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const resolvedStyle = typeof style === 'function'
    ? style({ pressed, hovered: false })
    : style;

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        if (!disabled) {
          scale.value = withTiming(scaleTo, { duration: 190 });
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        if (!disabled) {
          scale.value = withSpring(1, {
            damping: 19,
            stiffness: 145,
            mass: 0.62,
          });
        }
        onPressOut?.(event);
      }}
      style={[resolvedStyle, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}


function createSettingsLayout(width: number) {
  const scale = Math.min(1, Math.max(0.82, width / 410));
  const compact = width < 380;
  const s = (value: number) => Math.round(value * scale);

  return {
    scale,
    compact,
    s,
    pagePadding: compact ? 18 : 24,
    cardPadding: s(20),
    cardGap: s(16),
    modalPadding: compact ? 14 : 20,
    modalCardPadding: s(18),
    chipPaddingHorizontal: s(16),
    chipPaddingVertical: s(10),
    chipGap: s(8),
    chipText: s(14),
    pageTitle: s(28),
    sectionTitle: s(17),
    body: s(14),
    caption: s(12),
    profileTitle: s(16),
    resultValue: s(38),
    resultImage: s(104),
    resultCopyPadding: s(74),
  };
}

function isValidTimeInput(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function formatIntervalLabel(minutes: number, language: 'zh' | 'en'): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return language === 'en' ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : `${hours} 小时`;
  }

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return language === 'en' ? `${hours}h ${rest}min` : `${hours}小时${rest}分钟`;
  }

  return language === 'en' ? `${minutes} min` : `${minutes} 分钟`;
}

function normalizeReminderTimes(times: string[]): string[] {
  return [...new Set(times.filter(isValidTimeInput))].sort();
}

function toTimeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function splitTimeValue(value: string): { hour: number; minute: number } {
  if (!isValidTimeInput(value)) {
    return { hour: 9, minute: 0 };
  }

  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

function deriveIntervalInput(minutes: number): { value: string; unit: IntervalUnit } {
  if (minutes > 0 && minutes % 60 === 0) {
    return { value: String(minutes / 60), unit: 'hour' };
  }

  return { value: minutes > 0 ? String(minutes) : '', unit: 'min' };
}

/** 滚轮式时间选择列 — 中心位置始终为选中项，支持循环滚动 */
function WheelColumn({
  data,
  selectedValue,
  onValueChange,
  colors,
  layout,
}: {
  data: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  colors: typeof Theme.colors;
  layout: ReturnType<typeof createSettingsLayout>;
}) {
  const flatListRef = React.useRef<FlatList<number>>(null);
  const paddingItems = Math.floor(PICKER_VISIBLE_ITEMS / 2);
  const paddingHeight = paddingItems * PICKER_ITEM_HEIGHT;
  const dataLen = data.length;

  // 重复 3 组数据实现循环效果
  const repeatedData = React.useMemo(() => [...data, ...data, ...data], [data]);
  const middleOffset = dataLen; // 中间组的起始 index

  // 静默跳到中间组（不带动画）
  const snapToMiddle = React.useCallback(
    (realIndex: number) => {
      flatListRef.current?.scrollToOffset({
        offset: (middleOffset + realIndex) * PICKER_ITEM_HEIGHT,
        animated: false,
      });
    },
    [middleOffset],
  );

  // 选中值变化时滚动到中间组的对应位置
  React.useEffect(() => {
    const realIndex = data.indexOf(selectedValue);
    if (realIndex >= 0 && flatListRef.current) {
      flatListRef.current.scrollToOffset({
        offset: (middleOffset + realIndex) * PICKER_ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [selectedValue, data, middleOffset]);

  const handleScrollEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const repeatedIndex = Math.round(offsetY / PICKER_ITEM_HEIGHT);
      const realIndex = ((repeatedIndex % dataLen) + dataLen) % dataLen;
      const value = data[realIndex];

      // 如果滚出中间组范围，静默跳回
      if (repeatedIndex < dataLen || repeatedIndex >= dataLen * 2) {
        snapToMiddle(realIndex);
      }

      if (value !== selectedValue) {
        onValueChange(value);
      }
    },
    [data, dataLen, selectedValue, onValueChange, snapToMiddle],
  );

  const renderItem = React.useCallback(
    ({ item }: { item: number }) => {
      const selected = item === selectedValue;
      return (
        <View style={{ height: PICKER_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={
              selected
                ? {
                    color: colors.primary,
                    fontFamily: Theme.fonts.medium,
                    fontSize: layout.s(20),
                    opacity: 1,
                  }
                : {
                    color: colors.textSecondary,
                    fontFamily: Theme.fonts.regular,
                    fontSize: layout.s(16),
                    opacity: 0.35,
                  }
            }
          >
            {String(item).padStart(2, '0')}
          </Text>
        </View>
      );
    },
    [selectedValue, colors, layout],
  );

  const getItemLayout = React.useCallback(
    (_: any, index: number) => ({
      length: PICKER_ITEM_HEIGHT,
      offset: PICKER_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const initialIndex = middleOffset + Math.max(0, data.indexOf(selectedValue));

  return (
    <View style={{ flex: 1, height: PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ITEMS }}>
      {/* 中心选中行高亮背景 */}
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
        data={repeatedData}
        keyExtractor={(item, index) => `${index}`}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={PICKER_ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingTop: paddingHeight,
          paddingBottom: paddingHeight,
        }}
        onMomentumScrollEnd={handleScrollEnd}
        initialScrollIndex={initialIndex}
      />
    </View>
  );
}

const ACTIVITY_LEVELS: {
  value: ActivityLevel;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  extraMl: number;
}[] = [
  {
    value: 'sedentary',
    title: '久坐办公',
    titleEn: 'Sedentary',
    subtitle: '较少运动',
    subtitleEn: 'Less movement',
    extraMl: 0,
  },
  {
    value: 'light',
    title: '轻度活动',
    titleEn: 'Light activity',
    subtitle: '偶尔运动',
    subtitleEn: 'Occasional exercise',
    extraMl: 200,
  },
  {
    value: 'moderate',
    title: '中度活动',
    titleEn: 'Moderate',
    subtitle: '经常运动',
    subtitleEn: 'Regular exercise',
    extraMl: 400,
  },
  {
    value: 'high',
    title: '高强度',
    titleEn: 'High intensity',
    subtitle: '高强度运动',
    subtitleEn: 'Intense training',
    extraMl: 700,
  },
];

const SEX_PROFILES: {
  value: SexProfile;
  label: string;
  labelEn: string;
  baseDrinkMl: number;
  referenceWeightKg: number;
}[] = [
  { value: 'unspecified', label: '未指定', labelEn: 'Not specified', baseDrinkMl: 1600, referenceWeightKg: 60 },
  { value: 'female', label: '女性', labelEn: 'Female', baseDrinkMl: 1500, referenceWeightKg: 55 },
  { value: 'male', label: '男性', labelEn: 'Male', baseDrinkMl: 1700, referenceWeightKg: 65 },
];

const DIET_PROFILES: {
  value: DietProfile;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  adjustmentMl: number;
}[] = [
  {
    value: 'hydrating',
    title: '清淡多蔬果',
    titleEn: 'Light and fresh',
    subtitle: '食物含水较多',
    subtitleEn: 'More water-rich foods',
    adjustmentMl: -100,
  },
  {
    value: 'balanced',
    title: '均衡日常',
    titleEn: 'Balanced',
    subtitle: '正常三餐',
    subtitleEn: 'Regular meals',
    adjustmentMl: 0,
  },
  {
    value: 'salty',
    title: '偏咸外卖多',
    titleEn: 'Salty or takeout',
    subtitle: '盐分摄入较高',
    subtitleEn: 'Higher salt intake',
    adjustmentMl: 200,
  },
];

/**
 * 选择芯片组件 — 一个可点击的小标签
 * 选中时使用品牌色，未选中时使用浅色背景
 */
function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const layout = React.useMemo(() => createSettingsLayout(width), [width]);
  const chipStyles = React.useMemo(() => createChipStyles(colors, layout), [colors, layout]);

  return (
    <SoftPressable
      onPress={onPress}
      style={({ pressed }) => [
        chipStyles.chip,
        selected && chipStyles.chipSelected,
      ]}
    >
      <Text
        style={[
          chipStyles.chipText,
          selected && chipStyles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </SoftPressable>
  );
}

function ActivityCard({
  option,
  selected,
  onPress,
}: {
  option: (typeof ACTIVITY_LEVELS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const layout = React.useMemo(() => createSettingsLayout(width), [width]);
  const styles = React.useMemo(() => createStyles(colors, layout), [colors, layout]);

  return (
    <SoftPressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.activityCard,
        selected && styles.activityCardSelected,
        pressed && styles.activityCardPressed,
      ]}
    >
      <View style={styles.activityCopy}>
        <Text
          style={[
            styles.activityTitle,
            selected && styles.activityTitleSelected,
          ]}
        >
          {option.title}
        </Text>
        {selected && (
          <Text
            style={[
              styles.activitySubtitle,
              styles.activitySubtitleSelected,
            ]}
          >
            {option.subtitle}
          </Text>
        )}
      </View>
    </SoftPressable>
  );
}

function SmallOptionCard({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const layout = React.useMemo(() => createSettingsLayout(width), [width]);
  const styles = React.useMemo(() => createStyles(colors, layout), [colors, layout]);

  return (
    <SoftPressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallOptionCard,
        selected && styles.smallOptionCardSelected,
        pressed && styles.activityCardPressed,
      ]}
    >
      <Text
        style={[
          styles.smallOptionTitle,
          selected && styles.smallOptionTitleSelected,
        ]}
      >
        {title}
      </Text>
      {selected && (
        <Text
          style={[
            styles.smallOptionSubtitle,
            styles.smallOptionSubtitleSelected,
          ]}
        >
          {subtitle}
        </Text>
      )}
    </SoftPressable>
  );
}

function createChipStyles(colors: typeof Theme.colors, layout: SettingsLayout) {
  return StyleSheet.create({
  chip: {
    minWidth: layout.compact ? 74 : 82,
    alignItems: 'center',
    paddingHorizontal: layout.chipPaddingHorizontal,
    paddingVertical: layout.chipPaddingVertical,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginRight: layout.chipGap,
    marginBottom: layout.chipGap,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  chipText: {
    fontSize: layout.chipText,
    lineHeight: layout.s(19),
    fontFamily: Theme.fonts.medium,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  });
}

interface CustomSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  trackActive: string;
  trackInactive: string;
  thumbColor: string;
}

const CustomSwitch: React.FC<CustomSwitchProps> = ({ value, onValueChange, trackActive, trackInactive, thumbColor }) => {
  const animValue = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    animValue.value = withTiming(value ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [value, animValue]);

  const animatedTrackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(animValue.value, [0, 1], [trackInactive, trackActive]),
  }));

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animValue.value * 20 }], // 46 - 20(thumb width) - 6(padding 3*2) = 20
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)} hitSlop={8}>
      <Animated.View style={[
        {
          width: 46,
          height: 26,
          borderRadius: 13,
          justifyContent: 'center',
          paddingHorizontal: 3,
        },
        animatedTrackStyle
      ]}>
        <Animated.View style={[
          {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: thumbColor,
          },
          animatedThumbStyle
        ]} />
      </Animated.View>
    </Pressable>
  );
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const layout = React.useMemo(() => createSettingsLayout(width), [width]);
  const styles = React.useMemo(() => createStyles(colors, layout), [colors, layout]);
  const { state, updateSettings } = useWater();
  const { settings } = state;
  const [customCupSize, setCustomCupSize] = React.useState('');
  const [appliedCustomCupSize, setAppliedCustomCupSize] = React.useState<number | null>(null);
  const [quietStartInput, setQuietStartInput] = React.useState(settings.reminderQuietStart);
  const [quietEndInput, setQuietEndInput] = React.useState(settings.reminderQuietEnd);
  const [customReminderIntervalInput, setCustomReminderIntervalInput] = React.useState('');
  const [appliedCustomInterval, setAppliedCustomInterval] = React.useState<number | null>(null);
  const [customReminderIntervalUnit, setCustomReminderIntervalUnit] = React.useState<IntervalUnit>(
    deriveIntervalInput(settings.reminderInterval).unit,
  );
  const [reminderTimeInput, setReminderTimeInput] = React.useState('');
  const [reminderTimesInput, setReminderTimesInput] = React.useState<string[]>(settings.reminderTimes);
  const [editingReminderTime, setEditingReminderTime] = React.useState<string | null>(null);

  const closeOpenTimeAction = React.useCallback(() => {
    // Swipe rows close naturally after the gesture. The modal still calls this
    // callback so we keep a harmless no-op hook here.
  }, []);

  const [timePickerTarget, setTimePickerTarget] = React.useState<TimePickerTarget | null>(null);
  const [timePickerHour, setTimePickerHour] = React.useState(9);
  const [timePickerMinute, setTimePickerMinute] = React.useState(0);
  const [isGoalModalVisible, setIsGoalModalVisible] = React.useState(false);
  const [isExactTimeModalVisible, setIsExactTimeModalVisible] = React.useState(false);
  const [isSystemModalVisible, setIsSystemModalVisible] = React.useState(false);
  const [isQuietModalVisible, setIsQuietModalVisible] = React.useState(false);
  const [isAboutModalVisible, setIsAboutModalVisible] = React.useState(false);
  const [exportStatus, setExportStatus] = React.useState('');
  const [weightKg, setWeightKg] = React.useState('60');
  const [activityLevel, setActivityLevel] = React.useState<ActivityLevel>('sedentary');
  const [sexProfile, setSexProfile] = React.useState<SexProfile>('unspecified');
  const [dietProfile, setDietProfile] = React.useState<DietProfile>('balanced');
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const language = settings.language;
  const isEnglish = language === 'en';
  const aboutAuthorBody = [
    '你好，我是包子小方同学。',
    '这个应用由我独立设计和开发。',
    '',
    '我希望它不是一个催促你的健康工具，',
    '而是一张安静的小便签，',
    '轻轻提醒你在日常里照顾自己。',
    '',
    '谢谢你把它留在手机里。',
    '愿你今天也记得喝一口水。',
  ].join('\n');
  const copy = isEnglish
    ? {
      pageTitle: 'Settings',
      dailyGoalTitle: 'Daily goal',
      customGoal: 'Custom goal',
      dailyGoalDescription: 'Estimate a goal from body weight and activity',
      cupSizeTitle: 'Glass size',
      cupSizeDescription: 'Amount recorded when you tap “Drank a glass”.',
      customCup: 'Custom:',
      apply: 'Apply',
      reminderTitle: 'Reminder notifications',
      reminderDescription: 'Receive quiet hydration reminders.',
      quietTitle: 'Quiet hours:',
      quietDescription: 'No hydration reminders during this time.',
      reminderDetailTitle: 'Reminder settings',
      reminderDetailDescription: 'Exact times come first; otherwise Soma follows the interval.',
      reminderEntryDescription: 'Choose exact times, interval, and quiet hours.',
      customIntervalTitle: 'Custom Interval:',
      customIntervalDescription: 'Defaults to the selected preset interval.',
      customIntervalPlaceholder: 'Interval',
      exactTimeTitle: 'Exact reminder times',
      exactTimeDescription: 'Daily times for hydration reminders.',
      exactTimeEmpty: 'No exact times yet.',
      addTime: 'Add time',
      reminderSettingsSave: 'Save settings',
      intervalInvalid: 'Use 1-720 minutes.',
      quietStart: 'From',
      quietEnd: 'To',
      quietSave: 'Save',
      quietInvalid: 'Use 24-hour time, e.g. 22:00.',
      quietSummary: 'Paused from {start} to {end}',
      selectTime: 'Select time',
      confirmTime: 'Done',
      minuteUnit: 'min',
      hourUnit: 'hour',
      systemTitle: 'System settings',
      systemDescription: 'Language, appearance, backups, and app information.',
      systemEntryDescription: 'Language, appearance, backup, etc.',
      language: 'Language',
      appearance: 'Appearance',
      dataTitle: 'Data storage',
      dataDescription: 'Records are stored inside Soma. Choose a backup location and export a local JSON file.',
      exportPath: 'Backup location',
      exportPathEmpty: 'No backup location selected',
      exportPathSelected: 'Backup location selected',
      chooseExportPath: 'Choose location',
      exportData: 'Export data',
      exportReady: 'Data exported successfully.',
      exportNeedsPath: 'Choose a backup location first.',
      exportCanceled: 'No location was selected.',
      exportUnavailable: 'Folder selection is only available on Android. Data was saved to the app document folder.',
      exportFailed: 'Export failed. Please try again.',
      aboutTitle: 'About Soma',
      aboutDescription: '慢慢喝水，慢慢照顾自己。',
      aboutAuthorTitle: 'About the author',
      aboutAuthorBody,
      author: 'Author',
      contact: 'Contact',
      version: 'Version',
      currentName: '包子小方同学',
      modalTitle: 'Custom hydration goal',
      modalDescription: 'Estimate a water goal for today’s records and reminders.',
      close: 'Close',
      bodyData: 'Body data',
      weight: 'Weight',
      sex: 'Sex reference',
      activity: 'Daily activity',
      diet: 'Diet pattern',
      result: 'Result:',
      resultDescription: 'Recommended daily water goal from your data',
      unitPerDay: 'ml / day',
      missingWeight: 'Enter weight to see the result',
      applyGoal: 'Apply this goal',
      cupSingle: 'About {count} glasses (250ml each)',
      cupRange: 'About {min}-{max} glasses (250ml each)',
    }
    : {
      pageTitle: '设置',
      dailyGoalTitle: '每日饮水目标',
      customGoal: '自定义目标',
      dailyGoalDescription: '根据个人体重和活动量估算目标',
      cupSizeTitle: '单次饮水量',
      cupSizeDescription: '每次点击“喝了一杯”时记录的水量',
      customCup: '自定义杯量：',
      apply: '应用',
      reminderTitle: '提醒通知',
      reminderDescription: '定期收到喝水提醒通知',
      quietTitle: '勿扰时间段：',
      quietDescription: '这个时间段不会收到喝水提醒',
      reminderDetailTitle: '提醒设置',
      reminderDetailDescription: '具体时间优先，未设置时按间隔提醒',
      reminderEntryDescription: '设置具体时间、间隔和勿扰时段。',
      customIntervalTitle: '自定义间隔：',
      customIntervalDescription: '默认显示当前选择的预设间隔。',
      customIntervalPlaceholder: '间隔',
      exactTimeTitle: '设置具体提醒时间',
      exactTimeDescription: '每天在这些时间提醒喝水。',
      exactTimeEmpty: '还没有设置具体时间。',
      addTime: '添加时间',
      reminderSettingsSave: '保存提醒设置',
      intervalInvalid: '请输入 1-720 分钟。',
      quietStart: '开始',
      quietEnd: '结束',
      quietSave: '保存',
      quietInvalid: '请使用 24 小时制，例如 22:00。',
      quietSummary: '{start} 到 {end} 暂停提醒',
      selectTime: '选择时间',
      confirmTime: '完成',
      minuteUnit: '分钟',
      hourUnit: '小时',
      systemTitle: '系统设置',
      systemDescription: '设置语言、外观、数据备份和应用信息。',
      systemEntryDescription: '语言、外观、备份等',
      language: '语言',
      appearance: '外观',
      dataTitle: '数据存储',
      dataDescription: '记录保存在 Soma 应用内部。你可以选择备份位置，并导出本地 JSON 文件。',
      exportPath: '备份位置',
      exportPathEmpty: '尚未选择备份位置',
      exportPathSelected: '已选择备份位置',
      chooseExportPath: '选择位置',
      exportData: '导出数据',
      exportReady: '数据已成功导出。',
      exportNeedsPath: '请先选择备份位置。',
      exportCanceled: '未选择位置。',
      exportUnavailable: '当前平台不支持选择文件夹，已保存到应用文档目录。',
      exportFailed: '导出失败，请重试。',
      aboutTitle: '关于 Soma',
      aboutDescription: '慢慢喝水，慢慢照顾自己。',
      aboutAuthorTitle: '关于作者',
      aboutAuthorBody,
      author: '作者',
      contact: '联系方式',
      version: '版本',
      currentName: '包子小方同学',
      modalTitle: '自定义喝水目标',
      modalDescription: '估算适合今天记录和提醒的喝水量',
      close: '关闭',
      bodyData: '身体数据',
      weight: '体重',
      sex: '性别参考',
      activity: '每日活动量',
      diet: '饮食习惯',
      result: '计算结果：',
      resultDescription: '根据你的数据推荐每日饮水量',
      unitPerDay: 'ml / 天',
      missingWeight: '请输入体重后查看结果',
      applyGoal: '应用这个目标',
      cupSingle: '约 {count} 杯水（每杯 250ml）',
      cupRange: '约 {min}-{max} 杯水（每杯 250ml）',
    };

  React.useEffect(() => {
    setQuietStartInput(settings.reminderQuietStart);
    setQuietEndInput(settings.reminderQuietEnd);
    setReminderTimesInput(settings.reminderTimes);
  }, [
    settings.reminderQuietEnd,
    settings.reminderQuietStart,
    settings.reminderTimes,
  ]);
  const localizedActivityLevels = React.useMemo(
    () => ACTIVITY_LEVELS.map((option) => ({
      ...option,
      title: isEnglish ? option.titleEn : option.title,
      subtitle: isEnglish ? option.subtitleEn : option.subtitle,
    })),
    [isEnglish],
  );
  const localizedDietProfiles = React.useMemo(
    () => DIET_PROFILES.map((option) => ({
      ...option,
      title: isEnglish ? option.titleEn : option.title,
      subtitle: isEnglish ? option.subtitleEn : option.subtitle,
    })),
    [isEnglish],
  );

  const parsedCustomCupSize = Number.parseInt(customCupSize, 10);
  const isCustomCupSizeValid =
    Number.isFinite(parsedCustomCupSize) &&
    parsedCustomCupSize > 0;
  const cupSizeOptions = CUP_SIZES.includes(settings.cupSize)
    ? CUP_SIZES
    : [...CUP_SIZES, settings.cupSize];
  const dailyGoalOptions = DAILY_GOALS.includes(settings.dailyGoal)
    ? DAILY_GOALS
    : [...DAILY_GOALS, settings.dailyGoal];

  const isQuietStartValid = isValidTimeInput(quietStartInput);
  const isQuietEndValid = isValidTimeInput(quietEndInput);
  const isQuietWindowValid = isQuietStartValid && isQuietEndValid;
  const quietSummary = copy.quietSummary
    .replace('{start}', quietStartInput || '--:--')
    .replace('{end}', quietEndInput || '--:--');
  const parsedCustomReminderInterval = Number.parseInt(customReminderIntervalInput, 10);
  const hasCustomReminderIntervalInput = customReminderIntervalInput.trim().length > 0;
  const parsedCustomReminderIntervalMinutes = customReminderIntervalUnit === 'hour'
    ? parsedCustomReminderInterval * 60
    : parsedCustomReminderInterval;
  const isCustomReminderIntervalValid = !hasCustomReminderIntervalInput
    || (Number.isFinite(parsedCustomReminderIntervalMinutes)
      && parsedCustomReminderIntervalMinutes >= 1
      && parsedCustomReminderIntervalMinutes <= 720);
  const activeReminderTimes = normalizeReminderTimes(reminderTimesInput);
  const customIntervalOption = settings.reminderCustomInterval > 0
    ? {
      label: isEnglish
        ? `Custom ${formatIntervalLabel(settings.reminderCustomInterval, language)}`
        : `自定义 ${formatIntervalLabel(settings.reminderCustomInterval, language)}`,
      labelEn: `Custom ${formatIntervalLabel(settings.reminderCustomInterval, 'en')}`,
      value: settings.reminderCustomInterval,
      kind: 'custom' as const,
    }
    : DEFAULT_CUSTOM_INTERVAL_OPTION;
  const isIntervalPreset = BASE_INTERVALS.some(i => i.value === settings.reminderInterval) || !settings.reminderEnabled;
  const reminderIntervalOptions = isIntervalPreset
    ? BASE_INTERVALS
    : [...BASE_INTERVALS, customIntervalOption];
  const parsedWeightKg = Number.parseFloat(weightKg);
  const isWeightValid = Number.isFinite(parsedWeightKg) && parsedWeightKg > 0;
  const selectedActivity = ACTIVITY_LEVELS.find((option) => option.value === activityLevel) ?? ACTIVITY_LEVELS[0];
  const selectedSex = SEX_PROFILES.find((option) => option.value === sexProfile) ?? SEX_PROFILES[0];
  const selectedDiet = DIET_PROFILES.find((option) => option.value === dietProfile) ?? DIET_PROFILES[1];
  const weightAdjustmentMl = isWeightValid
    ? Math.round((parsedWeightKg - selectedSex.referenceWeightKg) * BASE_WEIGHT_SLOPE)
    : 0;
  const estimatedDailyGoal = isWeightValid
    ? Math.min(
      3000,
      Math.max(
        1200,
        Math.round((
          selectedSex.baseDrinkMl +
          weightAdjustmentMl +
          selectedDiet.adjustmentMl +
          selectedActivity.extraMl
        ) / 50) * 50,
      ),
    )
    : 0;
  const cupCountMin = estimatedDailyGoal > 0 ? Math.max(1, Math.floor(estimatedDailyGoal / 250)) : 0;
  const cupCountMax = estimatedDailyGoal > 0 ? Math.max(cupCountMin, Math.ceil(estimatedDailyGoal / 250)) : 0;
  const cupEstimateText = cupCountMin === cupCountMax
    ? copy.cupSingle.replace('{count}', String(cupCountMin))
    : copy.cupRange.replace('{min}', String(cupCountMin)).replace('{max}', String(cupCountMax));
  const exportDirectoryLabel = settings.exportDirectoryUri
    ? copy.exportPathSelected
    : copy.exportPathEmpty;
  const chooseExportDirectory = async () => {
    setExportStatus('');

    if (Platform.OS !== 'android') {
      updateSettings({ exportDirectoryUri: FileSystem.documentDirectory ?? '' });
      setExportStatus(copy.exportUnavailable);
      return;
    }

    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
        settings.exportDirectoryUri || undefined,
      );

      if (!permissions.granted) {
        setExportStatus(copy.exportCanceled);
        return;
      }

      updateSettings({ exportDirectoryUri: permissions.directoryUri });
      setExportStatus(copy.exportPathSelected);
    } catch {
      setExportStatus(copy.exportFailed);
    }
  };

  const exportWaterData = async () => {
    setExportStatus('');

    try {
      const payload = await buildWaterDataExport();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `soma-water-data-${timestamp}`;
      const contents = JSON.stringify(payload, null, 2);

      if (Platform.OS === 'android') {
        if (!settings.exportDirectoryUri) {
          setExportStatus(copy.exportNeedsPath);
          return;
        }

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          settings.exportDirectoryUri,
          filename,
          'application/json',
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, contents, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        setExportStatus(copy.exportReady);
        return;
      }

      if (!FileSystem.documentDirectory) {
        setExportStatus(copy.exportFailed);
        return;
      }

      await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${filename}.json`, contents, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setExportStatus(copy.exportReady);
    } catch {
      setExportStatus(copy.exportFailed);
      Alert.alert(copy.dataTitle, copy.exportFailed);
    }
  };

  const sanitizeDecimal = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const [integerPart, ...decimalParts] = cleaned.split('.');
    return decimalParts.length > 0
      ? `${integerPart}.${decimalParts.join('')}`
      : integerPart;
  };

  const calculateDailyGoal = () => {
    if (!isWeightValid) {
      return;
    }

    updateSettings({ dailyGoal: estimatedDailyGoal });
    setIsGoalModalVisible(false);
  };

  const saveCustomCupSize = () => {
    if (isCustomCupSizeValid) {
      updateSettings({ cupSize: parsedCustomCupSize });
      setAppliedCustomCupSize(parsedCustomCupSize);
      setCustomCupSize('');
      Keyboard.dismiss();
    }
  };

  const selectPresetCupSize = (size: number) => {
    updateSettings({ cupSize: size });
    setAppliedCustomCupSize(null);
    setCustomCupSize('');
  };

  const addReminderTime = () => {
    if (!isValidTimeInput(reminderTimeInput)) {
      return;
    }

    const nextTimes = normalizeReminderTimes([...settings.reminderTimes, reminderTimeInput]);
    updateSettings({ reminderTimes: nextTimes });
    setReminderTimeInput('');
  };

  const removeReminderTime = (time: string) => {
    const nextTimes = settings.reminderTimes.filter((item) => item !== time);
    updateSettings({ reminderTimes: nextTimes });
  };

  const openTimePicker = (target: TimePickerTarget, currentValue: string, editTargetTime?: string) => {
    const { hour, minute } = splitTimeValue(currentValue);
    setTimePickerTarget(target);
    setTimePickerHour(hour);
    setTimePickerMinute(minute);
    if (editTargetTime) {
      setEditingReminderTime(editTargetTime);
    } else {
      setEditingReminderTime(null);
    }
  };

  const confirmTimePicker = () => {
    if (!timePickerTarget) {
      return;
    }

    const nextTime = toTimeValue(timePickerHour, timePickerMinute);
    if (timePickerTarget === 'quietStart') {
      setQuietStartInput(nextTime);
      updateSettings({ reminderQuietStart: nextTime });
    } else if (timePickerTarget === 'quietEnd') {
      setQuietEndInput(nextTime);
      updateSettings({ reminderQuietEnd: nextTime });
    } else {
      if (editingReminderTime) {
        if (nextTime !== editingReminderTime) {
          const wasEnabled = settings.reminderTimes.includes(editingReminderTime);
          const filteredEnabled = settings.reminderTimes.filter(t => t !== editingReminderTime);
          const filteredDisabled = (settings.reminderDisabledTimes || []).filter(t => t !== editingReminderTime);

          if (wasEnabled) {
            updateSettings({
              reminderTimes: normalizeReminderTimes([...filteredEnabled, nextTime]),
              reminderDisabledTimes: filteredDisabled.filter(t => t !== nextTime),
            });
          } else {
            updateSettings({
              reminderTimes: filteredEnabled.filter(t => t !== nextTime),
              reminderDisabledTimes: Array.from(new Set([...filteredDisabled, nextTime])).sort(),
            });
          }
        }
      } else {
        if (!settings.reminderTimes.includes(nextTime)) {
          const nextTimes = normalizeReminderTimes([...settings.reminderTimes, nextTime]);
          updateSettings({
            reminderTimes: nextTimes,
            reminderDisabledTimes: (settings.reminderDisabledTimes || []).filter(t => t !== nextTime),
          });
        }
      }
    }

    setTimePickerTarget(null);
  };

  const toggleCustomReminderIntervalUnit = () => {
    if (!hasCustomReminderIntervalInput || !Number.isFinite(parsedCustomReminderInterval)) {
      setCustomReminderIntervalUnit(customReminderIntervalUnit === 'min' ? 'hour' : 'min');
      return;
    }

    if (customReminderIntervalUnit === 'min') {
      setCustomReminderIntervalInput(String(Math.max(1, Math.round(parsedCustomReminderInterval / 60))));
      setCustomReminderIntervalUnit('hour');
    } else {
      setCustomReminderIntervalInput(String(Math.min(720, parsedCustomReminderInterval * 60)));
      setCustomReminderIntervalUnit('min');
    }
  };

  const applyCustomInterval = () => {
    if (!isCustomReminderIntervalValid || !hasCustomReminderIntervalInput) {
      return;
    }
    updateSettings({
      reminderEnabled: true,
      reminderInterval: parsedCustomReminderIntervalMinutes,
      reminderCustomInterval: parsedCustomReminderIntervalMinutes,
    });
    setAppliedCustomInterval(parsedCustomReminderIntervalMinutes);
    setCustomReminderIntervalInput('');
    Keyboard.dismiss();
  };

  const quietHoursEnabled = !!(settings.reminderQuietStart && settings.reminderQuietEnd);
  const toggleQuietHours = (enabled: boolean) => {
    if (enabled) {
      const start = quietStartInput || '22:00';
      const end = quietEndInput || '08:00';
      setQuietStartInput(start);
      setQuietEndInput(end);
      updateSettings({ reminderQuietStart: start, reminderQuietEnd: end });
    } else {
      updateSettings({ reminderQuietStart: '', reminderQuietEnd: '' });
    }
  };
  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 页面标题 */}
      <Text style={styles.pageTitle}>{copy.pageTitle}</Text>

      {/* 每日饮水目标 */}
      <View style={styles.card}>
        <View style={styles.settingHeader}>
          <Text style={[styles.cardTitle, styles.headerCardTitle]}>{copy.dailyGoalTitle}</Text>
          <SoftPressable
            onPress={() => setIsGoalModalVisible(true)}
            style={({ pressed }) => [
              styles.estimatePill,
              pressed && styles.estimateButtonPressed,
            ]}
          >
            <Text style={styles.estimatePillText}>{copy.customGoal}</Text>
            <Feather name="chevron-right" size={13} color={colors.primary} />
          </SoftPressable>
        </View>
        <Text style={styles.cardDescription}>
          {copy.dailyGoalDescription}
        </Text>
        <View style={styles.chipGroup}>
          {dailyGoalOptions.map((goal) => (
            <Chip
              key={goal}
              label={DAILY_GOALS.includes(goal) ? `${goal} ml` : (isEnglish ? `Custom ${goal}ml` : `自定义 ${goal}ml`)}
              selected={settings.dailyGoal === goal}
              onPress={() => updateSettings({ dailyGoal: goal })}
            />
          ))}
        </View>
      </View>

      {/* 单次饮水量 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{copy.cupSizeTitle}</Text>
        <Text style={styles.cardDescription}>
          {copy.cupSizeDescription}
        </Text>
        <View style={styles.chipGroup}>
          {cupSizeOptions.map((size) => (
            <Chip
              key={size}
              label={CUP_SIZES.includes(size) ? `${size} ml` : (isEnglish ? `Custom ${size}ml` : `自定义 ${size}ml`)}
              selected={settings.cupSize === size}
              onPress={() => selectPresetCupSize(size)}
            />
          ))}
        </View>
        <View style={styles.customSection}>
          <View style={styles.customCopy}>
            <Text style={styles.customTitle}>{copy.customCup}</Text>
          </View>
          <View style={styles.customControl}>
            <View style={styles.customCupInputShell}>
              <TextInput
                value={customCupSize}
                onChangeText={(value) => setCustomCupSize(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={appliedCustomCupSize ? String(appliedCustomCupSize) : "250"}
                placeholderTextColor={colors.textSecondary + '80'}
                style={styles.customInput}
              />
              <Text style={styles.inputUnit}>ml</Text>
            </View>
            <SoftPressable
              onPress={saveCustomCupSize}
              disabled={!isCustomCupSizeValid}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && isCustomCupSizeValid && styles.saveButtonPressed,
                !isCustomCupSizeValid && styles.saveButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  !isCustomCupSizeValid && styles.saveButtonTextDisabled,
                ]}
              >
                {copy.apply}
              </Text>
            </SoftPressable>
          </View>
        </View>
      </View>

      {/* 提醒通知 */}
      <View style={styles.card}>
        <View style={styles.settingHeader}>
          <Text style={[styles.cardTitle, styles.headerCardTitle]}>{copy.reminderTitle}</Text>
          <SoftPressable
            onPress={() => setIsExactTimeModalVisible(true)}
            style={({ pressed }) => [
              styles.estimatePill,
              pressed && styles.estimateButtonPressed,
            ]}
          >
            <Text style={styles.estimatePillText}>{copy.exactTimeTitle}</Text>
            <Feather name="chevron-right" size={13} color={colors.primary} />
          </SoftPressable>
        </View>
        <Text style={styles.cardDescription}>
          {copy.reminderDescription}
        </Text>
        <View style={styles.chipGroup}>
          {reminderIntervalOptions.map((interval) => {
            const isSelected = interval.value === 0
              ? !settings.reminderEnabled
              : settings.reminderEnabled && settings.reminderInterval === interval.value;
            return (
              <Chip
                key={interval.value}
                label={isEnglish ? interval.labelEn : interval.label}
                selected={isSelected}
                onPress={() => {
                  if (interval.value === 0) {
                    updateSettings({ reminderEnabled: false, reminderTimes: [] });
                  } else {
                    updateSettings({
                      reminderEnabled: true,
                      reminderInterval: interval.value,
                    });
                  }
                  setAppliedCustomInterval(null);
                  setCustomReminderIntervalInput('');
                }}
              />
            );
          })}
        </View>
        {/* 自定义间隔 */}
        <View style={styles.customSection}>
          <View style={styles.customCopy}>
            <Text style={styles.customTitle}>{copy.customIntervalTitle}</Text>
          </View>
          <View style={styles.customControl}>
            <View style={styles.customIntervalInputShell}>
              <TextInput
                value={customReminderIntervalInput}
                onChangeText={(value) => setCustomReminderIntervalInput(
                  value.replace(/\D/g, '').slice(0, customReminderIntervalUnit === 'min' ? 3 : 2),
                )}
                keyboardType="number-pad"
                maxLength={customReminderIntervalUnit === 'min' ? 3 : 2}
                placeholder={appliedCustomInterval ? String(customReminderIntervalUnit === 'hour' ? appliedCustomInterval / 60 : appliedCustomInterval) : "30"}
                placeholderTextColor={colors.textSecondary + '80'}
                style={styles.customInput}
              />
              <SoftPressable
                onPress={toggleCustomReminderIntervalUnit}
                style={({ pressed }) => [
                  styles.intervalUnitInline,
                  pressed && styles.estimateButtonPressed,
                ]}
              >
                <Text style={styles.inputUnit}>
                  {customReminderIntervalUnit === 'min' ? copy.minuteUnit : copy.hourUnit}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.textSecondary} style={{ marginTop: 1 }} />
              </SoftPressable>
            </View>
            <SoftPressable
              onPress={applyCustomInterval}
              disabled={!isCustomReminderIntervalValid || !hasCustomReminderIntervalInput}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && isCustomReminderIntervalValid && hasCustomReminderIntervalInput && styles.saveButtonPressed,
                (!isCustomReminderIntervalValid || !hasCustomReminderIntervalInput) && styles.saveButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  (!isCustomReminderIntervalValid || !hasCustomReminderIntervalInput) && styles.saveButtonTextDisabled,
                ]}
              >
                {copy.apply}
              </Text>
            </SoftPressable>
          </View>
          {!isCustomReminderIntervalValid ? (
            <Text style={styles.quietInvalidText}>{copy.intervalInvalid}</Text>
          ) : null}
        </View>

        {/* 勿扰时间段 */}
        <Text style={styles.inlineSectionTitle}>{copy.quietTitle}</Text>
        <View style={styles.quietInlineRow}>
          <View style={styles.quietInlineLeft}>
            <View style={styles.quietInlineIcon}>
              <Feather name="moon" size={17} color={colors.primary} />
            </View>
            <View style={styles.quietInlineCopy}>
              <View style={styles.quietInlineTimeRow}>
                {quietHoursEnabled ? (
                  <>
                    <SoftPressable
                      onPress={() => openTimePicker('quietStart', quietStartInput || '22:00')}
                      style={({ pressed }) => [
                        styles.quietInlineTimeButton,
                        pressed && styles.estimateButtonPressed,
                      ]}
                    >
                      <Text style={styles.quietInlineTimeText}>{quietStartInput || '22:00'}</Text>
                    </SoftPressable>
                    <Text style={styles.quietInlineTimeSep}>–</Text>
                    <SoftPressable
                      onPress={() => openTimePicker('quietEnd', quietEndInput || '08:00')}
                      style={({ pressed }) => [
                        styles.quietInlineTimeButton,
                        pressed && styles.estimateButtonPressed,
                      ]}
                    >
                      <Text style={styles.quietInlineTimeText}>{quietEndInput || '08:00'}</Text>
                    </SoftPressable>
                  </>
                ) : (
                  <Text style={styles.quietInlineDisabledText}>{isEnglish ? 'Not set' : '未设置'}</Text>
                )}
              </View>
              <Text style={styles.quietInlineDesc}>{copy.quietDescription}</Text>
            </View>
          </View>
          <CustomSwitch
            value={quietHoursEnabled}
            onValueChange={toggleQuietHours}
            trackInactive={colors.trackBackground}
            trackActive={colors.primary}
            thumbColor={colors.surface}
          />
        </View>
      </View>
      {/* 系统设置 */}
      <SoftPressable
        onPress={() => setIsSystemModalVisible(true)}
        style={({ pressed }) => [
          styles.card,
          styles.systemEntryCard,
          pressed && styles.estimateButtonPressed,
        ]}
      >
        <View style={styles.systemEntryLeft}>
          <View style={styles.systemEntryIcon}>
            <Feather name="settings" size={17} color={colors.primary} />
          </View>
          <View style={styles.systemEntryCopy}>
            <Text style={[styles.cardTitle, { marginBottom: 4 }]}>{copy.systemTitle}</Text>
            <Text style={styles.systemEntryDescription} numberOfLines={1}>
              {copy.systemEntryDescription}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </SoftPressable>

      <View style={{ height: 32 }} />

      <Modal
        visible={isExactTimeModalVisible}
        transparent
        animationType="none"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={() => setIsExactTimeModalVisible(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Animated.View
            entering={FadeIn.duration(320)}
            exiting={FadeOut.duration(220)}
            style={styles.modalBackdrop}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsExactTimeModalVisible(false)}
            />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.duration(520).easing(Easing.out(Easing.cubic))}
            exiting={FadeOutDown.duration(240).easing(Easing.in(Easing.cubic))}
            style={[
              styles.modalCard,
              { marginTop: Math.max(insets.top + 20, 36) },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{copy.exactTimeTitle}</Text>
                <Text style={styles.modalDescription}>
                  {copy.exactTimeDescription}
                </Text>
              </View>
              <SoftPressable
                onPress={() => setIsExactTimeModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={copy.close}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
              >
                <Feather name="x" size={24} color={colors.textSecondary} />
              </SoftPressable>
            </View>
            <ScrollView
              contentContainerStyle={[styles.modalScrollContent, styles.reminderModalContent]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.exactTimeList}>
                {Array.from(new Set([...settings.reminderTimes, ...(settings.reminderDisabledTimes || [])]))
                  .sort()
                  .map((time) => {
                    const isEnabled = settings.reminderTimes.includes(time);
                    return (
                      <ReanimatedSwipeable
                        key={time}
                        friction={2.05}
                        rightThreshold={40}
                        overshootRight
                        overshootFriction={7}
                        animationOptions={{ damping: 16, stiffness: 135, mass: 0.62 }}
                        containerStyle={styles.exactTimeSwipeContainer}
                        renderRightActions={(progress) => (
                          <DeleteTimeAction
                            progress={progress}
                            onDelete={() => {
                              closeOpenTimeAction();
                              updateSettings({
                                reminderTimes: settings.reminderTimes.filter(t => t !== time),
                                reminderDisabledTimes: (settings.reminderDisabledTimes || []).filter(t => t !== time),
                              });
                            }}
                          />
                        )}
                      >
                        <View style={styles.exactTimeRow}>
                          <SoftPressable
                            onPress={() => {
                              closeOpenTimeAction();
                              openTimePicker('reminderTime', time, time);
                            }}
                            style={({ pressed }) => [
                              styles.exactTimeLeft,
                              pressed && styles.activityCardPressed,
                            ]}
                          >
                            <View style={[styles.exactTimeDot, !isEnabled && styles.exactTimeDotDisabled]} />
                            <Text style={[styles.exactTimeText, !isEnabled && styles.exactTimeTextDisabled]}>{time}</Text>
                          </SoftPressable>
                          <View onStartShouldSetResponder={() => true} style={styles.exactTimeRightWrap}>
                            <CustomSwitch
                              value={isEnabled}
                              onValueChange={(val) => {
                                if (val) {
                                  const nextTimes = normalizeReminderTimes([...settings.reminderTimes, time]);
                                  updateSettings({
                                    reminderTimes: nextTimes,
                                    reminderDisabledTimes: (settings.reminderDisabledTimes || []).filter(t => t !== time),
                                  });
                                } else {
                                  updateSettings({
                                    reminderTimes: settings.reminderTimes.filter(t => t !== time),
                                    reminderDisabledTimes: Array.from(new Set([...(settings.reminderDisabledTimes || []), time])).sort(),
                                  });
                                }
                              }}
                              trackActive={colors.primary}
                              trackInactive={colors.surfaceMuted}
                              thumbColor={colors.surface}
                            />
                          </View>
                        </View>
                      </ReanimatedSwipeable>
                    );
                })}
                <SoftPressable
                  onPress={() => openTimePicker('reminderTime', reminderTimeInput || '09:00')}
                  style={({ pressed }) => [
                    styles.addTimeDashedButton,
                    pressed && styles.estimateButtonPressed,
                  ]}
                >
                  <Feather name="plus" size={15} color={colors.primary} />
                  <Text style={styles.addTimeDashedButtonText}>{copy.addTime}</Text>
                </SoftPressable>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Modal>

      <Modal
        visible={isGoalModalVisible}
        transparent
        animationType="none"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={() => setIsGoalModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Animated.View
            entering={FadeIn.duration(320)}
            exiting={FadeOut.duration(220)}
            style={styles.modalBackdrop}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsGoalModalVisible(false)}
            />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.duration(520).easing(Easing.out(Easing.cubic))}
            exiting={FadeOutDown.duration(240).easing(Easing.in(Easing.cubic))}
            style={[
              styles.modalCard,
              { marginTop: Math.max(insets.top + 20, 36) },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{copy.modalTitle}</Text>
                <Text style={styles.modalDescription}>
                  {copy.modalDescription}
                </Text>
              </View>
              <SoftPressable
                onPress={() => setIsGoalModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={copy.close}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
              >
                <Feather name="x" size={21} color={colors.textSecondary} />
              </SoftPressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.profileCard}>
                <View style={styles.inlineChoiceBlock}>
                  <View style={styles.profileTitleRow}>
                    <Feather name="user" size={16} color={colors.textSecondary} />
                    <Text style={styles.profileTitle}>{copy.bodyData}</Text>
                  </View>

                  <View style={styles.weightRow}>
                    <View style={styles.weightLabelGroup}>
                      <Text style={styles.weightLabel}>{copy.weight}</Text>
                    </View>
                    <View style={styles.weightInputShell}>
                      <TextInput
                        value={weightKg}
                        onChangeText={(value) => setWeightKg(sanitizeDecimal(value))}
                        keyboardType="decimal-pad"
                        placeholder="60"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.weightInput}
                      />
                      <Text style={styles.weightUnit}>kg</Text>
                    </View>
                  </View>

                </View>

                <View style={styles.inlineChoiceBlock}>
                  <View style={styles.profileTitleRow}>
                    <Feather name="users" size={16} color={colors.textSecondary} />
                    <Text style={styles.profileTitle}>{copy.sex}</Text>
                  </View>
                  <View style={styles.sexGroup}>
                    {SEX_PROFILES.map((option) => (
                      <Chip
                        key={option.value}
                        label={isEnglish ? option.labelEn : option.label}
                        selected={sexProfile === option.value}
                        onPress={() => setSexProfile(option.value)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.inlineChoiceBlock}>
                  <View style={styles.profileTitleRow}>
                    <Feather name="activity" size={16} color={colors.textSecondary} />
                    <Text style={styles.profileTitle}>{copy.activity}</Text>
                  </View>
                  <View style={styles.activityGrid}>
                    {localizedActivityLevels.map((option) => (
                      <ActivityCard
                        key={option.value}
                        option={option}
                        selected={activityLevel === option.value}
                        onPress={() => setActivityLevel(option.value)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.inlineChoiceBlock}>
                  <View style={styles.profileTitleRow}>
                    <Feather name="coffee" size={16} color={colors.textSecondary} />
                    <Text style={styles.profileTitle}>{copy.diet}</Text>
                  </View>
                  <View style={styles.dietGrid}>
                    {localizedDietProfiles.map((option) => (
                      <SmallOptionCard
                        key={option.value}
                        title={option.title}
                        subtitle={option.subtitle}
                        selected={dietProfile === option.value}
                        onPress={() => setDietProfile(option.value)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.resultCard}>
                  <View style={styles.resultCopy}>
                    <Text style={styles.resultTitle}>{copy.result}</Text>
                    <Text style={styles.resultDescription} numberOfLines={1}>
                      {copy.resultDescription}
                    </Text>
                    <View style={styles.resultValueRow}>
                      <Text style={styles.resultValue}>
                        {isWeightValid ? estimatedDailyGoal : '--'}
                      </Text>
                      <Text style={styles.resultUnit}>{copy.unitPerDay}</Text>
                    </View>
                    <View style={styles.cupEstimateRow}>
                      <Feather name="droplet" size={16} color={colors.textSecondary} />
                      <Text style={styles.cupEstimateText}>
                        {isWeightValid ? cupEstimateText : copy.missingWeight}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.resultIllustration}>
                    <View style={styles.resultVisualSlot}>
                      <Image
                        source={HYDRATION_GOAL_IMAGE}
                        style={styles.resultImage}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                </View>

                <SoftPressable
                  onPress={calculateDailyGoal}
                  disabled={!isWeightValid}
                  style={({ pressed }) => [
                    styles.modalPrimaryButton,
                    pressed && isWeightValid && styles.saveButtonPressed,
                    !isWeightValid && styles.saveButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalPrimaryText,
                      !isWeightValid && styles.saveButtonTextDisabled,
                    ]}
                  >
                    {copy.applyGoal}
                  </Text>
                </SoftPressable>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={timePickerTarget !== null}
        transparent
        animationType="fade"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={() => setTimePickerTarget(null)}
      >
        <View style={styles.timePickerRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setTimePickerTarget(null)}
          />
          <View style={styles.timePickerCard}>
            <View style={styles.timePickerHeader}>
              <View style={styles.timePickerHeaderLeft}>
                <Text style={styles.timePickerTitle}>{copy.selectTime}</Text>
                <Text style={styles.timePickerValue}>{toTimeValue(timePickerHour, timePickerMinute)}</Text>
              </View>
              <SoftPressable
                onPress={() => setTimePickerTarget(null)}
                accessibilityRole="button"
                accessibilityLabel={copy.close}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
              >
                <Feather name="x" size={21} color={colors.textSecondary} />
              </SoftPressable>
            </View>
            <View style={styles.timePickerColumns}>
              <WheelColumn
                data={TIME_HOURS}
                selectedValue={timePickerHour}
                onValueChange={setTimePickerHour}
                colors={colors}
                layout={layout}
              />
              <Text style={styles.timePickerDivider}>:</Text>
              <WheelColumn
                data={TIME_MINUTES}
                selectedValue={timePickerMinute}
                onValueChange={setTimePickerMinute}
                colors={colors}
                layout={layout}
              />
            </View>
            <SoftPressable
              onPress={confirmTimePicker}
              style={({ pressed }) => [
                styles.modalPrimaryButton,
                pressed && styles.saveButtonPressed,
              ]}
            >
              <Text style={styles.modalPrimaryText}>{copy.confirmTime}</Text>
            </SoftPressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isSystemModalVisible}
        transparent
        animationType="none"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={() => setIsSystemModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Animated.View
            entering={FadeIn.duration(280)}
            exiting={FadeOut.duration(200)}
            style={styles.modalBackdrop}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsSystemModalVisible(false)}
            />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.duration(460).easing(Easing.out(Easing.cubic))}
            exiting={FadeOutDown.duration(220).easing(Easing.in(Easing.cubic))}
            style={[
              styles.modalCard,
              styles.systemModalCard,
              { marginTop: Math.max(insets.top + 20, 36) },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{copy.systemTitle}</Text>
                <Text style={styles.modalDescription}>{copy.systemDescription}</Text>
              </View>
              <SoftPressable
                onPress={() => setIsSystemModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={copy.close}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
              >
                <Feather name="x" size={21} color={colors.textSecondary} />
              </SoftPressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.systemModalContent}
            >
              <View style={styles.systemPanel}>
                <View style={styles.systemSection}>
                  <View style={styles.systemLabelRow}>
                    <Feather name="globe" size={16} color={colors.textSecondary} />
                    <Text style={styles.systemLabel}>{copy.language}</Text>
                  </View>
                  <View style={styles.systemChipGroup}>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        selected={settings.language === option.value}
                        onPress={() => updateSettings({ language: option.value })}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.systemDivider} />

                <View style={styles.systemSection}>
                  <View style={styles.systemLabelRow}>
                    <Feather name="moon" size={16} color={colors.textSecondary} />
                    <Text style={styles.systemLabel}>{copy.appearance}</Text>
                  </View>
                  <View style={styles.systemChipGroup}>
                    {APPEARANCE_OPTIONS[language].map((option) => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        selected={settings.appearance === option.value}
                        onPress={() => updateSettings({ appearance: option.value })}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.systemDivider} />

                <View style={styles.systemSection}>
                  <View style={styles.systemLabelRow}>
                    <Feather name="database" size={16} color={colors.textSecondary} />
                    <Text style={styles.systemLabel}>{copy.dataTitle}</Text>
                  </View>
                  <Text style={styles.systemDescriptionText}>{copy.dataDescription}</Text>
                  <View style={styles.dataPathBox}>
                    <Text style={styles.dataPathLabel}>{copy.exportPath}</Text>
                    <Text style={styles.dataPathValue} numberOfLines={1}>
                      {exportDirectoryLabel}
                    </Text>
                  </View>
                  <View style={styles.systemActionRow}>
                    <SoftPressable
                      onPress={chooseExportDirectory}
                      style={({ pressed }) => [
                        styles.secondaryActionButton,
                        pressed && styles.estimateButtonPressed,
                      ]}
                    >
                      <Text style={styles.secondaryActionText}>{copy.chooseExportPath}</Text>
                    </SoftPressable>
                    <SoftPressable
                      onPress={exportWaterData}
                      style={({ pressed }) => [
                        styles.primaryActionButton,
                        pressed && styles.saveButtonPressed,
                      ]}
                    >
                      <Text style={styles.primaryActionText}>{copy.exportData}</Text>
                    </SoftPressable>
                  </View>
                  {exportStatus ? (
                    <Text style={styles.exportStatusText}>{exportStatus}</Text>
                  ) : null}
                </View>

                <View style={styles.systemDivider} />

                <SoftPressable
                  onPress={() => setIsAboutModalVisible(true)}
                  style={({ pressed }) => [
                    styles.aboutEntry,
                    pressed && styles.estimateButtonPressed,
                  ]}
                >
                  <View style={styles.aboutEntryCopy}>
                    <View style={styles.systemLabelRow}>
                      <Feather name="info" size={16} color={colors.textSecondary} />
                      <Text style={styles.systemLabel}>{copy.aboutTitle}</Text>
                    </View>
                    <Text style={styles.systemDescriptionText}>{copy.aboutDescription}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textSecondary} />
                </SoftPressable>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={isAboutModalVisible}
        transparent
        animationType="none"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={() => setIsAboutModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Animated.View
            style={styles.modalBackdrop}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(160)}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsAboutModalVisible(false)}
            />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))}
            exiting={FadeOutDown.duration(200).easing(Easing.in(Easing.cubic))}
            style={[styles.modalCard, styles.systemModalCard]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{copy.aboutTitle}</Text>
                <Text style={styles.modalDescription}>{copy.aboutDescription}</Text>
              </View>
              <SoftPressable
                onPress={() => setIsAboutModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={copy.close}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
              >
                <Feather name="x" size={24} color={colors.textSecondary} />
              </SoftPressable>
            </View>
            <View style={styles.aboutAuthorCard}>
              <Text style={styles.aboutAuthorTitle}>{copy.aboutAuthorTitle}</Text>
              <Text style={styles.aboutAuthorBody}>{copy.aboutAuthorBody}</Text>
              <View style={styles.aboutInfoGroup}>
                <View style={styles.aboutInfoRow}>
                  <Text style={styles.aboutInfoLabel}>{copy.author}</Text>
                  <Text style={styles.aboutInfoValue}>{copy.currentName}</Text>
                </View>
                <View style={styles.aboutInfoRow}>
                  <Text style={styles.aboutInfoLabel}>{copy.contact}</Text>
                  <Text style={styles.aboutInfoValue}>xukunyao215@163.com</Text>
                </View>
                <View style={styles.aboutInfoRow}>
                  <Text style={styles.aboutInfoLabel}>{copy.version}</Text>
                  <Text style={styles.aboutInfoValue}>v{appVersion}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function createStyles(colors: typeof Theme.colors, layout: SettingsLayout) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: layout.pagePadding,
    paddingBottom: layout.s(20),
  },
  pageTitle: {
    fontSize: layout.pageTitle,
    fontFamily: Theme.fonts.medium,
    color: colors.text,
    marginBottom: layout.s(24),
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: Theme.radius.card,
    padding: layout.cardPadding,
    marginBottom: layout.cardGap,
    // 极轻阴影
    elevation: Theme.shadow.card.elevation,
    shadowColor: Theme.shadow.card.color,
    shadowOffset: { width: 0, height: Theme.shadow.card.offsetY },
    shadowOpacity: Theme.shadow.card.opacity,
    shadowRadius: Theme.shadow.card.radius,
  },
  cardTitle: {
    fontSize: layout.sectionTitle,
    fontFamily: Theme.fonts.medium,
    color: colors.text,
    marginBottom: 6,
  },
  headerCardTitle: {
    marginBottom: 0,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: layout.s(12),
    marginBottom: layout.s(6),
  },
  cardDescription: {
    fontSize: layout.body,
    fontFamily: Theme.fonts.regular,
    color: colors.textSecondary,
    lineHeight: layout.s(20),
    marginBottom: layout.s(16),
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quietEntry: {
    minHeight: 58,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quietEntryLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quietEntryIcon: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quietEntryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  quietEntryTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  quietEntrySummary: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  reminderSummarySection: {
    marginTop: layout.s(10),
    gap: layout.s(10),
  },
  reminderSummaryBlock: {
    gap: layout.s(6),
  },
  reminderSummaryLabel: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: layout.body,
    marginTop: layout.s(4),
  },
  reminderSummaryPills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: layout.s(6),
  },
  reminderSummaryPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: Theme.radius.full,
    paddingHorizontal: layout.s(12),
    paddingVertical: layout.s(5),
  },
  reminderSummaryPillText: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(13),
  },
  reminderQuietPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: Theme.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: layout.s(12),
    paddingVertical: layout.s(5),
  },
  reminderQuietPillText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(13),
  },
  addTimeButton: {
    borderRadius: Theme.radius.button,
    minHeight: layout.s(42),
    paddingHorizontal: layout.s(16),
    justifyContent: 'center' as const,
    backgroundColor: colors.trackBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addTimeButtonEnabled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quietSection: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: 8,
    padding: 12,
    gap: 10,
  },
  quietModalPanel: {
    marginTop: 0,
  },
  quietHeader: {
    gap: 4,
  },
  quietTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  quietTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  quietSummary: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  quietDescription: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  reminderTimeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.s(8),
  },
  reminderTimePill: {
    minHeight: layout.s(34),
    borderRadius: Theme.radius.full,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.s(12),
  },
  reminderTimePillText: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(13),
  },
  quietTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  quietTimeField: {
    flex: 1,
    gap: 6,
  },
  quietTimeLabel: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: layout.s(12),
    lineHeight: layout.s(16),
  },
  quietTimeInput: {
    minHeight: 42,
    borderRadius: Theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  quietTimeInputText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
  },
  quietTimeInputInvalid: {
    borderColor: colors.primary,
  },
  quietSaveButton: {
    minHeight: 42,
    minWidth: 64,
    borderRadius: Theme.radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  quietSaveText: {
    color: colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  quietInvalidText: {
    color: colors.primary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  inlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: layout.s(20),
    marginBottom: layout.s(16),
  },
  inlineSectionTitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: layout.s(14),
    marginBottom: layout.s(8),
  },
  inlineTimePills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: layout.s(8),
    alignItems: 'center' as const,
  },
  addTimePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: layout.s(4),
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed' as const,
    paddingHorizontal: layout.s(14),
    paddingVertical: layout.s(7),
  },
  addTimePillText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: layout.s(13),
  },
  addTimeDashedButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: layout.s(6),
    paddingVertical: layout.s(14),
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: Theme.radius.card,
    marginTop: layout.s(4),
  },
  addTimeDashedButtonText: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(14),
  },
  exactTimeList: {
    paddingTop: layout.s(8),
    paddingBottom: layout.s(16),
  },
  exactTimeSwipeContainer: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: Theme.radius.card,
    marginBottom: layout.s(8),
    overflow: 'hidden',
    backgroundColor: colors.dangerSoft,
  },
  exactTimeRow: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: colors.surface,
  },
  exactTimeLeft: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: layout.s(14),
    paddingHorizontal: layout.s(16),
    paddingVertical: layout.s(14),
  },
  exactTimeRightWrap: {
    justifyContent: 'center',
    paddingRight: layout.s(16),
    paddingLeft: layout.s(16),
  },
  exactTimeDot: {
    width: layout.s(6),
    height: layout.s(6),
    borderRadius: layout.s(3),
    backgroundColor: colors.primary,
  },
  exactTimeDotDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.45,
  },
  exactTimeText: {
    fontSize: layout.s(16),
    fontFamily: Theme.fonts.regular,
    color: colors.text,
  },
  exactTimeTextDisabled: {
    color: colors.textSecondary,
    opacity: 0.45,
  },
  exactTimeDeleteWrap: {
    width: 82,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  exactTimeDeleteMotion: {
    flex: 1,
  },
  exactTimeDeleteAction: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  exactTimeDeleteActionPressed: {
    backgroundColor: colors.primaryPressed,
  },
  exactTimeDeleteText: {
    color: colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
  },
  quietInlineRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: layout.s(12),
  },
  quietInlineLeft: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: layout.s(10),
  },
  quietInlineIcon: {
    width: 38,
    height: 38,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  quietInlineCopy: {
    flex: 1,
    gap: 3,
  },
  quietInlineTimeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: layout.s(6),
    height: layout.s(30),
  },
  quietInlineTimeButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: Theme.radius.input,
    paddingHorizontal: layout.s(10),
    paddingVertical: layout.s(4),
  },
  quietInlineTimeText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
  },
  quietInlineTimeSep: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
  },
  quietInlineDisabledText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    paddingVertical: layout.s(4),
  },
  quietInlineDesc: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  estimatePill: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primarySoft,
    borderRadius: Theme.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
    paddingLeft: layout.s(11),
    paddingRight: layout.s(8),
  },
  estimatePillText: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.caption,
  },
  estimateButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: Theme.radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: 6,
    paddingHorizontal: layout.s(16),
    paddingVertical: layout.s(11),
  },
  estimateButtonPressed: {
    opacity: 0.72,
  },
  estimateButtonText: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.body,
  },
  customSection: {
    alignItems: 'flex-start',
    marginTop: 2,
    paddingTop: 2,
  },
  customCopy: {
    marginBottom: 6,
  },
  customTitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  customControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderControl: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderInputShell: {
    minWidth: layout.s(118),
    maxWidth: layout.s(170),
    flexGrow: 1,
    flexShrink: 1,
    minHeight: layout.s(42),
    backgroundColor: colors.surface,
    borderRadius: Theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.s(12),
  },
  customCupInputShell: {
    width: layout.s(90),
    minHeight: layout.s(42),
    backgroundColor: colors.surfaceMuted,
    borderRadius: Theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.s(12),
  },
  customIntervalInputShell: {
    width: layout.s(115),
    minHeight: layout.s(42),
    backgroundColor: colors.surfaceMuted,
    borderRadius: Theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.s(12),
  },
  customInput: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.body,
    paddingVertical: layout.s(8),
  },
  inputUnit: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.body,
  },
  intervalUnitInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.s(4),
  },
  timeSelectButton: {
    minWidth: layout.s(118),
    minHeight: layout.s(42),
    backgroundColor: colors.surface,
    borderRadius: Theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: layout.s(12),
  },
  timeSelectText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.body,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: Theme.radius.button,
    minHeight: layout.s(42),
    paddingHorizontal: layout.s(16),
    justifyContent: 'center',
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  saveButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  saveButtonText: {
    color: colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.body,
  },
  saveButtonTextDisabled: {
    color: colors.textSecondary,
  },
  systemEntryCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  systemEntryLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  systemEntryIcon: {
    width: 38,
    height: 38,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemEntryCopy: {
    flex: 1,
    minWidth: 0,
  },
  systemEntryDescription: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
  systemRow: {
    gap: 10,
  },
  systemModalCard: {
    maxHeight: '84%',
  },
  reminderModalContent: {
    paddingBottom: 4,
    gap: 10,
  },
  systemModalContent: {
    paddingBottom: 2,
  },
  systemPanel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
  },
  systemSection: {
    gap: 10,
  },
  systemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  systemLabel: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  systemChipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  systemDescriptionText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  aboutEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 14,
    paddingVertical: 2,
  },
  aboutEntryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  systemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  dataPathBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  dataPathLabel: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: layout.s(12),
    lineHeight: layout.s(16),
  },
  dataPathValue: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  systemActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Theme.radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  primaryActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Theme.radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryActionText: {
    color: colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  exportStatusText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  aboutAuthorCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  aboutAuthorTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 17,
    lineHeight: 23,
  },
  aboutAuthorBody: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    lineHeight: 23,
  },
  aboutInfoGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
    gap: 2,
  },
  aboutInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  aboutInfoLabel: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
  },
  aboutInfoValue: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.modalPadding,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: layout.modalCardPadding,
    paddingTop: layout.modalCardPadding,
    paddingBottom: layout.modalCardPadding,
    elevation: Theme.shadow.floating.elevation,
    shadowColor: Theme.shadow.floating.color,
    shadowOffset: { width: 0, height: Theme.shadow.floating.offsetY },
    shadowOpacity: Theme.shadow.floating.opacity,
    shadowRadius: Theme.shadow.floating.radius,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: layout.s(12),
    marginBottom: layout.s(12),
  },
  modalHeaderCopy: {
    flex: 1,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(18),
    lineHeight: layout.s(24),
  },
  modalDescription: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: layout.s(13),
    lineHeight: layout.s(19),
    marginTop: layout.s(4),
  },
  closeButton: {
    width: layout.s(36),
    height: layout.s(36),
    borderRadius: Theme.radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: colors.border,
  },
  timePickerRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.modalPadding,
    backgroundColor: colors.backdrop,
  },
  timePickerCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: layout.modalCardPadding,
    gap: layout.s(14),
    elevation: Theme.shadow.floating.elevation,
    shadowColor: Theme.shadow.floating.color,
    shadowOffset: { width: 0, height: Theme.shadow.floating.offsetY },
    shadowOpacity: Theme.shadow.floating.opacity,
    shadowRadius: Theme.shadow.floating.radius,
  },
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: layout.s(12),
  },
  timePickerHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.s(10),
  },
  timePickerTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(16),
  },
  timePickerValue: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(20),
  },
  timePickerColumns: {
    height: PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ITEMS,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.s(4),
  },
  timePickerColumn: {
    flex: 1,
    alignSelf: 'stretch',
  },
  timePickerDivider: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(22),
  },
  timePickerHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PICKER_ITEM_HEIGHT * Math.floor(PICKER_VISIBLE_ITEMS / 2),
    height: PICKER_ITEM_HEIGHT,
    borderRadius: Theme.radius.input,
    backgroundColor: colors.primarySoft,
  },
  timePickerOption: {
    height: PICKER_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerOptionText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: layout.s(16),
    opacity: 0.35,
  },
  timePickerOptionTextSelected: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(20),
    opacity: 1,
  },
  modalScrollContent: {
    paddingBottom: 2,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: layout.s(14),
    gap: layout.s(16),
  },
  profileTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.profileTitle,
    lineHeight: layout.s(21),
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.s(8),
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: layout.s(16),
    minHeight: layout.s(54),
    paddingHorizontal: layout.s(12),
    paddingVertical: layout.s(7),
  },
  weightLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  weightLabel: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  weightInputShell: {
    width: layout.s(104),
    minHeight: layout.s(40),
    backgroundColor: colors.surface,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  weightInput: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(15),
    paddingVertical: layout.s(6),
  },
  weightUnit: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
  },
  inlineChoiceBlock: {
    gap: 8,
  },
  sexGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.s(8),
    marginBottom: layout.s(4),
  },
  activityCard: {
    width: '47.6%',
    minHeight: layout.s(58),
    backgroundColor: colors.surfaceMuted,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.s(8),
    paddingHorizontal: layout.s(10),
    paddingVertical: layout.s(8),
  },
  activityCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  activityCardPressed: {
    opacity: 0.86,
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  activityTitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(13),
    lineHeight: layout.s(17),
    textAlign: 'center',
  },
  activityTitleSelected: {
    color: colors.primary,
  },
  activitySubtitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: layout.s(11),
    lineHeight: layout.s(15),
    marginTop: layout.s(3),
    textAlign: 'center',
  },
  activitySubtitleSelected: {
    color: colors.primary,
  },
  dietGrid: {
    flexDirection: 'row',
    gap: layout.s(8),
    marginBottom: layout.s(2),
  },
  smallOptionCard: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.s(60),
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: layout.s(8),
    paddingVertical: layout.s(8),
  },
  smallOptionCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  smallOptionTitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(12),
    lineHeight: layout.s(16),
    textAlign: 'center',
  },
  smallOptionTitleSelected: {
    color: colors.primary,
  },
  smallOptionSubtitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: layout.s(4),
  },
  smallOptionSubtitleSelected: {
    color: colors.primary,
  },
  resultCard: {
    minHeight: layout.s(118),
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: layout.s(14),
    marginTop: layout.s(2),
    marginBottom: layout.s(12),
    position: 'relative',
    overflow: 'hidden',
  },
  resultCopy: {
    paddingRight: layout.resultCopyPadding,
    zIndex: 1,
  },
  resultTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.profileTitle,
    lineHeight: layout.s(21),
  },
  resultDescription: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  resultValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: layout.s(10),
  },
  resultValue: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.resultValue,
    lineHeight: layout.s(44),
  },
  resultUnit: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(15),
    lineHeight: layout.s(24),
    marginLeft: layout.s(6),
    marginBottom: layout.s(4),
  },
  cupEstimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: layout.s(10),
  },
  cupEstimateText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  resultIllustration: {
    position: 'absolute',
    top: layout.s(20),
    right: layout.s(12),
    width: layout.resultImage,
    height: layout.resultImage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultVisualSlot: {
    width: layout.resultImage,
    height: layout.resultImage,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultImage: {
    width: layout.s(108),
    height: layout.s(112),
  },
  modalPrimaryButton: {
    minHeight: layout.s(48),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: Theme.radius.full,
    paddingHorizontal: layout.s(18),
  },
  modalPrimaryText: {
    color: colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: layout.s(15),
  },
  });
}
