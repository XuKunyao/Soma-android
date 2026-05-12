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
  Alert,
} from 'react-native';
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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import { useWater } from '@/contexts/WaterContext';
import { buildWaterDataExport } from '@/utils/storage';

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

function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTimeInput(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
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
  const [quietStartInput, setQuietStartInput] = React.useState(settings.reminderQuietStart);
  const [quietEndInput, setQuietEndInput] = React.useState(settings.reminderQuietEnd);
  const [isGoalModalVisible, setIsGoalModalVisible] = React.useState(false);
  const [isSystemModalVisible, setIsSystemModalVisible] = React.useState(false);
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
      reminderTitle: 'Reminder interval',
      reminderDescription: 'Receive quiet hydration reminders.',
      quietTitle: 'Quiet hours',
      quietDescription: 'No hydration reminders during this time.',
      quietStart: 'From',
      quietEnd: 'To',
      quietSave: 'Save',
      quietInvalid: 'Use 24-hour time, e.g. 22:00.',
      quietSummary: 'Paused from {start} to {end}',
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
      reminderTitle: '提醒间隔',
      reminderDescription: '定期收到喝水提醒通知',
      quietTitle: '勿扰时间段',
      quietDescription: '这个时间段不会收到喝水提醒。',
      quietStart: '开始',
      quietEnd: '结束',
      quietSave: '保存',
      quietInvalid: '请使用 24 小时制，例如 22:00。',
      quietSummary: '{start} 到 {end} 暂停提醒',
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
  }, [settings.reminderQuietEnd, settings.reminderQuietStart]);
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
    }
  };

  const selectPresetCupSize = (size: number) => {
    updateSettings({ cupSize: size });
    setCustomCupSize('');
  };

  const saveQuietWindow = () => {
    if (!isQuietWindowValid) {
      return;
    }

    updateSettings({
      reminderQuietStart: quietStartInput,
      reminderQuietEnd: quietEndInput,
    });
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
        <View style={styles.quietSection}>
          <View style={styles.quietHeader}>
            <View style={styles.quietTitleRow}>
              <Feather name="moon" size={15} color={colors.textSecondary} />
              <Text style={styles.quietTitle}>{copy.quietTitle}</Text>
            </View>
            <Text style={styles.quietSummary}>{quietSummary}</Text>
          </View>
          <Text style={styles.quietDescription}>{copy.quietDescription}</Text>
          <View style={styles.quietTimeRow}>
            <View style={styles.quietTimeField}>
              <Text style={styles.quietTimeLabel}>{copy.quietStart}</Text>
              <TextInput
                value={quietStartInput}
                onChangeText={(value) => setQuietStartInput(formatTimeInput(value))}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="22:00"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.quietTimeInput,
                  !isQuietStartValid && styles.quietTimeInputInvalid,
                ]}
              />
            </View>
            <View style={styles.quietTimeField}>
              <Text style={styles.quietTimeLabel}>{copy.quietEnd}</Text>
              <TextInput
                value={quietEndInput}
                onChangeText={(value) => setQuietEndInput(formatTimeInput(value))}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="08:00"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.quietTimeInput,
                  !isQuietEndValid && styles.quietTimeInputInvalid,
                ]}
              />
            </View>
            <SoftPressable
              onPress={saveQuietWindow}
              disabled={!isQuietWindowValid}
              style={({ pressed }) => [
                styles.quietSaveButton,
                pressed && isQuietWindowValid && styles.saveButtonPressed,
                !isQuietWindowValid && styles.saveButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.quietSaveText,
                  !isQuietWindowValid && styles.saveButtonTextDisabled,
                ]}
              >
                {copy.quietSave}
              </Text>
            </SoftPressable>
          </View>
          {!isQuietWindowValid ? (
            <Text style={styles.quietInvalidText}>{copy.quietInvalid}</Text>
          ) : null}
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
            <Text style={styles.cardTitle}>{copy.systemTitle}</Text>
            <Text style={styles.systemEntryDescription} numberOfLines={1}>
              {copy.systemEntryDescription}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </SoftPressable>

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
                    {copy.applyGoal}
                  </Text>
                </SoftPressable>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
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
  quietSection: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: 8,
    padding: 12,
    gap: 10,
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
    fontSize: 12,
    lineHeight: 16,
  },
  quietTimeInput: {
    minHeight: 42,
    borderRadius: Theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    fontSize: 12,
    lineHeight: 16,
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
