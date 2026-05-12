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
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Image,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';

/** 可选的单次饮水量 */
const CUP_SIZES = [100, 150, 200, 250, 300, 400, 500];

/** 可选的提醒间隔（分钟） */
const INTERVALS = [
  { label: '关闭', labelEn: 'Off', value: 0 },
  { label: '30 分钟', labelEn: '30 min', value: 30 },
  { label: '1 小时', labelEn: '1 hour', value: 60 },
  { label: '1.5 小时', labelEn: '1.5 hours', value: 90 },
  { label: '2 小时', labelEn: '2 hours', value: 120 },
  { label: '3 小时', labelEn: '3 hours', value: 180 },
];

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
  const chipStyles = React.useMemo(() => createChipStyles(colors), [colors]);

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
  const styles = React.useMemo(() => createStyles(colors), [colors]);

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
  const styles = React.useMemo(() => createStyles(colors), [colors]);

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

function createChipStyles(colors: typeof Theme.colors) {
  return StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  chipText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  });
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { state, updateSettings } = useWater();
  const { settings } = state;
  const [customCupSize, setCustomCupSize] = React.useState(String(settings.cupSize));
  const [isGoalModalVisible, setIsGoalModalVisible] = React.useState(false);
  const [weightKg, setWeightKg] = React.useState('60');
  const [activityLevel, setActivityLevel] = React.useState<ActivityLevel>('sedentary');
  const [sexProfile, setSexProfile] = React.useState<SexProfile>('unspecified');
  const [dietProfile, setDietProfile] = React.useState<DietProfile>('balanced');
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const language = settings.language;
  const isEnglish = language === 'en';
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
      reminderTitle: 'Reminder interval',
      reminderDescription: 'Receive quiet hydration reminders.',
      systemTitle: 'System settings',
      systemDescription: 'Language, appearance, feedback, and app information.',
      language: 'Language',
      appearance: 'Appearance',
      haptics: 'Haptic feedback',
      hapticsDescription: 'Subtle touch response for supported controls.',
      on: 'On',
      off: 'Off',
      dataTitle: 'Data storage',
      dataDescription: 'Records and preferences stay on this device.',
      aboutTitle: 'About Soma',
      aboutDescription: 'A quiet hydration reminder shaped for daily care.',
      author: 'Author',
      version: 'Version',
      currentName: 'XuKunyao',
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
      reminderTitle: '提醒间隔',
      reminderDescription: '定期收到喝水提醒通知',
      systemTitle: '系统设置',
      systemDescription: '设置语言、外观、反馈和应用信息。',
      language: '语言',
      appearance: '外观',
      haptics: '触感反馈',
      hapticsDescription: '为支持的控件提供轻微触感。',
      on: '开启',
      off: '关闭',
      dataTitle: '数据存储',
      dataDescription: '记录和偏好保存在当前设备本地。',
      aboutTitle: '关于 Soma',
      aboutDescription: '一款安静克制的喝水提醒工具。',
      author: '作者',
      version: '版本',
      currentName: 'XuKunyao',
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
    }
  };

  const selectPresetCupSize = (size: number) => {
    updateSettings({ cupSize: size });
    setCustomCupSize('');
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
              label={`${goal} ml`}
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
              label={`${size} ml`}
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
            <View style={styles.customInputShell}>
              <TextInput
                value={customCupSize}
                onChangeText={(value) => setCustomCupSize(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="250"
                placeholderTextColor={colors.textSecondary}
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

      {/* 提醒间隔 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{copy.reminderTitle}</Text>
        <Text style={styles.cardDescription}>
          {copy.reminderDescription}
        </Text>
        <View style={styles.chipGroup}>
          {INTERVALS.map((interval) => {
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
                    updateSettings({ reminderEnabled: false });
                  } else {
                    updateSettings({
                      reminderEnabled: true,
                      reminderInterval: interval.value,
                    });
                  }
                }}
              />
            );
          })}
        </View>
      </View>
      {/* 系统设置 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{copy.systemTitle}</Text>
        <Text style={styles.cardDescription}>{copy.systemDescription}</Text>

        <View style={styles.systemRow}>
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

        <View style={styles.systemRow}>
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

        <View style={styles.systemRow}>
          <View style={styles.systemLabelRow}>
            <Feather name="smartphone" size={16} color={colors.textSecondary} />
            <Text style={styles.systemLabel}>{copy.haptics}</Text>
          </View>
          <Text style={styles.systemDescriptionText}>{copy.hapticsDescription}</Text>
          <View style={styles.systemChipGroup}>
            <Chip
              label={copy.on}
              selected={settings.hapticsEnabled}
              onPress={() => updateSettings({ hapticsEnabled: true })}
            />
            <Chip
              label={copy.off}
              selected={!settings.hapticsEnabled}
              onPress={() => updateSettings({ hapticsEnabled: false })}
            />
          </View>
        </View>

        <View style={styles.systemDivider} />

        <View style={styles.systemRow}>
          <View style={styles.systemLabelRow}>
            <Feather name="database" size={16} color={colors.textSecondary} />
            <Text style={styles.systemLabel}>{copy.dataTitle}</Text>
          </View>
          <Text style={styles.systemDescriptionText}>{copy.dataDescription}</Text>
        </View>

        <View style={styles.systemDivider} />

        <View style={styles.systemRow}>
          <View style={styles.systemLabelRow}>
            <Feather name="info" size={16} color={colors.textSecondary} />
            <Text style={styles.systemLabel}>{copy.aboutTitle}</Text>
          </View>
          <Text style={styles.systemDescriptionText}>{copy.aboutDescription}</Text>
          <View style={styles.aboutInfoRow}>
            <Text style={styles.aboutInfoLabel}>{copy.author}</Text>
            <Text style={styles.aboutInfoValue}>{copy.currentName}</Text>
          </View>
          <View style={styles.aboutInfoRow}>
            <Text style={styles.aboutInfoLabel}>{copy.version}</Text>
            <Text style={styles.aboutInfoValue}>v{appVersion}</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 32 }} />

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
                    {copy.apply}这个目标
                  </Text>
                </SoftPressable>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: Theme.radius.card,
    padding: 20,
    marginBottom: 16,
    // 极轻阴影
    elevation: Theme.shadow.card.elevation,
    shadowColor: Theme.shadow.card.color,
    shadowOffset: { width: 0, height: Theme.shadow.card.offsetY },
    shadowOpacity: Theme.shadow.card.opacity,
    shadowRadius: Theme.shadow.card.radius,
  },
  cardTitle: {
    fontSize: Theme.type.sectionTitle,
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
    gap: 12,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    paddingLeft: 11,
    paddingRight: 8,
  },
  estimatePillText: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
  },
  estimateButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: Theme.radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  estimateButtonPressed: {
    opacity: 0.72,
  },
  estimateButtonText: {
    color: colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
  },
  customSection: {
    alignItems: 'flex-start',
    marginTop: 6,
    paddingTop: 4,
  },
  customCopy: {
    marginBottom: 8,
  },
  customTitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  customControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customInputShell: {
    width: 90,
    minHeight: 42,
    backgroundColor: colors.surfaceMuted,
    borderRadius: Theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  customInput: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    paddingVertical: 8,
  },
  inputUnit: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: Theme.radius.button,
    minHeight: 42,
    paddingHorizontal: 16,
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
    fontSize: 14,
  },
  saveButtonTextDisabled: {
    color: colors.textSecondary,
  },
  systemRow: {
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
  systemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 14,
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
    paddingHorizontal: 20,
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
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    elevation: Theme.shadow.floating.elevation,
    shadowColor: Theme.shadow.floating.color,
    shadowOffset: { width: 0, height: Theme.shadow.floating.offsetY },
    shadowOpacity: Theme.shadow.floating.opacity,
    shadowRadius: Theme.shadow.floating.radius,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  modalHeaderCopy: {
    flex: 1,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 18,
    lineHeight: 24,
  },
  modalDescription: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: colors.border,
  },
  modalScrollContent: {
    paddingBottom: 2,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    gap: 16,
  },
  profileTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    lineHeight: 21,
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 16,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    width: 104,
    minHeight: 40,
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
    fontSize: 15,
    paddingVertical: 6,
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
    gap: 8,
    marginBottom: 4,
  },
  activityCard: {
    width: '48.5%',
    minHeight: 58,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
  },
  activityTitleSelected: {
    color: colors.primary,
  },
  activitySubtitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
    textAlign: 'center',
  },
  activitySubtitleSelected: {
    color: colors.primary,
  },
  dietGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  smallOptionCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  smallOptionCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  smallOptionTitle: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
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
    marginTop: 4,
  },
  smallOptionSubtitleSelected: {
    color: colors.primary,
  },
  resultCard: {
    minHeight: 118,
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    marginTop: 2,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  resultCopy: {
    paddingRight: 82,
    zIndex: 1,
  },
  resultTitle: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    lineHeight: 21,
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
    marginTop: 10,
  },
  resultValue: {
    color: colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 38,
    lineHeight: 44,
  },
  resultUnit: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    lineHeight: 24,
    marginLeft: 6,
    marginBottom: 4,
  },
  cupEstimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  cupEstimateText: {
    color: colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  resultIllustration: {
    position: 'absolute',
    top: 20,
    right: 12,
    width: 102,
    height: 102,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultVisualSlot: {
    width: 102,
    height: 102,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultImage: {
    width: 108,
    height: 112,
  },
  modalPrimaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 18,
  },
  modalPrimaryText: {
    color: colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
  },
  });
}
