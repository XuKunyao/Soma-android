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
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
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
import { useWater } from '@/contexts/WaterContext';

/** 可选的单次饮水量 */
const CUP_SIZES = [100, 150, 200, 250, 300, 400, 500];

/** 可选的提醒间隔（分钟） */
const INTERVALS = [
  { label: '关闭', value: 0 },
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 },
  { label: '1.5 小时', value: 90 },
  { label: '2 小时', value: 120 },
  { label: '3 小时', value: 180 },
];

/** 可选的每日目标 */
const DAILY_GOALS = [1000, 1500, 2000, 2500, 3000, 3500, 4000];
const BASE_WEIGHT_SLOPE = 14;
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
  subtitle: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  extraMl: number;
}[] = [
  {
    value: 'sedentary',
    title: '久坐办公',
    subtitle: '较少运动',
    icon: 'monitor',
    extraMl: 0,
  },
  {
    value: 'light',
    title: '轻度活动',
    subtitle: '偶尔运动',
    icon: 'wind',
    extraMl: 200,
  },
  {
    value: 'moderate',
    title: '中度活动',
    subtitle: '经常运动',
    icon: 'activity',
    extraMl: 400,
  },
  {
    value: 'high',
    title: '高强度',
    subtitle: '高强度运动',
    icon: 'zap',
    extraMl: 700,
  },
];

const SEX_PROFILES: {
  value: SexProfile;
  label: string;
  baseDrinkMl: number;
  referenceWeightKg: number;
}[] = [
  { value: 'unspecified', label: '未指定', baseDrinkMl: 1600, referenceWeightKg: 60 },
  { value: 'female', label: '女性', baseDrinkMl: 1500, referenceWeightKg: 55 },
  { value: 'male', label: '男性', baseDrinkMl: 1700, referenceWeightKg: 65 },
];

const DIET_PROFILES: {
  value: DietProfile;
  title: string;
  subtitle: string;
  adjustmentMl: number;
}[] = [
  {
    value: 'hydrating',
    title: '清淡多蔬果',
    subtitle: '食物含水较多',
    adjustmentMl: -100,
  },
  {
    value: 'balanced',
    title: '均衡日常',
    subtitle: '正常三餐',
    adjustmentMl: 0,
  },
  {
    value: 'salty',
    title: '偏咸外卖多',
    subtitle: '盐分摄入较高',
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
  return (
    <SoftPressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.activityCard,
        selected && styles.activityCardSelected,
        pressed && styles.activityCardPressed,
      ]}
    >
      <Feather
        name={option.icon}
        size={18}
        color={selected ? Theme.colors.primary : Theme.colors.textSecondary}
      />
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

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: Theme.colors.primarySoft,
    borderColor: Theme.colors.primaryBorder,
  },
  chipText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  chipTextSelected: {
    color: Theme.colors.primary,
  },
});

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { state, updateSettings } = useWater();
  const { settings } = state;
  const [customCupSize, setCustomCupSize] = React.useState(String(settings.cupSize));
  const [isGoalModalVisible, setIsGoalModalVisible] = React.useState(false);
  const [weightKg, setWeightKg] = React.useState('60');
  const [activityLevel, setActivityLevel] = React.useState<ActivityLevel>('sedentary');
  const [sexProfile, setSexProfile] = React.useState<SexProfile>('unspecified');
  const [dietProfile, setDietProfile] = React.useState<DietProfile>('balanced');

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
    ? `约 ${cupCountMin} 杯水（每杯 250ml）`
    : `约 ${cupCountMin}-${cupCountMax} 杯水（每杯 250ml）`;

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
      <Text style={styles.pageTitle}>设置</Text>

      {/* 每日饮水目标 */}
      <View style={styles.card}>
        <View style={styles.settingHeader}>
          <Text style={[styles.cardTitle, styles.headerCardTitle]}>每日饮水目标</Text>
          <SoftPressable
            onPress={() => setIsGoalModalVisible(true)}
            style={({ pressed }) => [
              styles.estimatePill,
              pressed && styles.estimateButtonPressed,
            ]}
          >
            <Text style={styles.estimatePillText}>自定义目标</Text>
            <Feather name="chevron-right" size={13} color={Theme.colors.primary} />
          </SoftPressable>
        </View>
        <Text style={styles.cardDescription}>
          根据个人体重和活动量估算目标
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
        <Text style={styles.cardTitle}>单次饮水量</Text>
        <Text style={styles.cardDescription}>
          每次点击“喝了一杯”时记录的水量
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
            <Text style={styles.customTitle}>自定义杯量：</Text>
          </View>
          <View style={styles.customControl}>
            <View style={styles.customInputShell}>
              <TextInput
                value={customCupSize}
                onChangeText={(value) => setCustomCupSize(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="250"
                placeholderTextColor={Theme.colors.textSecondary}
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
                应用
              </Text>
            </SoftPressable>
          </View>
        </View>
      </View>

      {/* 提醒间隔 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>提醒间隔</Text>
        <Text style={styles.cardDescription}>
          定期收到喝水提醒通知
        </Text>
        <View style={styles.chipGroup}>
          {INTERVALS.map((interval) => {
            const isSelected = interval.value === 0
              ? !settings.reminderEnabled
              : settings.reminderEnabled && settings.reminderInterval === interval.value;
            return (
              <Chip
                key={interval.value}
                label={interval.label}
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

      {/* 关于 */}
      <View style={styles.aboutSection}>
        <Text style={styles.aboutText}>Soma · 喝水提醒</Text>
        <Text style={styles.aboutVersion}>v1.0.0</Text>
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
                <Text style={styles.modalTitle}>自定义喝水目标</Text>
                <Text style={styles.modalDescription}>
                  估算适合今天记录和提醒的喝水量
                </Text>
              </View>
              <SoftPressable
                onPress={() => setIsGoalModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="关闭"
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
              >
                <Feather name="x" size={21} color={Theme.colors.textSecondary} />
              </SoftPressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.profileCard}>
                <View style={styles.modalSectionBlock}>
                  <View style={styles.modalSectionHeader}>
                    <Feather name="user" size={16} color={Theme.colors.textSecondary} />
                    <Text style={styles.profileTitle}>身体数据</Text>
                  </View>

                  <View style={styles.weightRow}>
                    <View style={styles.weightLabelGroup}>
                      <Feather name="box" size={16} color={Theme.colors.textSecondary} />
                      <Text style={styles.weightLabel}>体重</Text>
                    </View>
                    <View style={styles.weightInputShell}>
                      <TextInput
                        value={weightKg}
                        onChangeText={(value) => setWeightKg(sanitizeDecimal(value))}
                        keyboardType="decimal-pad"
                        placeholder="60"
                        placeholderTextColor={Theme.colors.textSecondary}
                        style={styles.weightInput}
                      />
                      <Text style={styles.weightUnit}>kg</Text>
                    </View>
                  </View>

                  <View style={styles.inlineChoiceBlock}>
                    <Text style={styles.choiceLabel}>性别参考</Text>
                    <View style={styles.sexGroup}>
                      {SEX_PROFILES.map((option) => (
                        <Chip
                          key={option.value}
                          label={option.label}
                          selected={sexProfile === option.value}
                          onPress={() => setSexProfile(option.value)}
                        />
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.profileDivider} />

                <View style={styles.modalSectionBlock}>
                  <View style={styles.modalSectionHeader}>
                    <Feather name="activity" size={16} color={Theme.colors.textSecondary} />
                    <Text style={styles.profileTitle}>生活习惯</Text>
                  </View>

                  <Text style={styles.choiceLabel}>每日活动量</Text>
                  <View style={styles.activityGrid}>
                    {ACTIVITY_LEVELS.map((option) => (
                      <ActivityCard
                        key={option.value}
                        option={option}
                        selected={activityLevel === option.value}
                        onPress={() => setActivityLevel(option.value)}
                      />
                    ))}
                  </View>

                  <Text style={styles.choiceLabel}>饮食习惯</Text>
                  <View style={styles.dietGrid}>
                    {DIET_PROFILES.map((option) => (
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
                    <Text style={styles.resultTitle}>计算结果</Text>
                    <Text style={styles.resultDescription}>根据你的数据推荐每日饮水量</Text>
                    <View style={styles.resultValueRow}>
                      <Text style={styles.resultValue}>
                        {isWeightValid ? estimatedDailyGoal : '--'}
                      </Text>
                      <Text style={styles.resultUnit}>ml / 天</Text>
                    </View>
                    <View style={styles.cupEstimateRow}>
                      <Feather name="droplet" size={16} color={Theme.colors.textSecondary} />
                      <Text style={styles.cupEstimateText}>
                        {isWeightValid ? cupEstimateText : '请输入体重后查看结果'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.resultIllustration}>
                    <View style={styles.resultVisualSlot}>
                      <View style={styles.resultVisualMark} />
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
                    应用这个目标
                  </Text>
                </SoftPressable>
                <SoftPressable
                  onPress={() => setIsGoalModalVisible(false)}
                  style={({ pressed }) => [
                    styles.modalSecondaryButton,
                    pressed && styles.modalSecondaryButtonPressed,
                  ]}
                >
                  <Text style={styles.modalSecondaryText}>取消</Text>
                </SoftPressable>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: Theme.type.pageTitle,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Theme.colors.surface,
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
    color: Theme.colors.text,
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
    color: Theme.colors.textSecondary,
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
    backgroundColor: Theme.colors.primarySoft,
    borderRadius: Theme.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.primaryBorder,
    paddingLeft: 11,
    paddingRight: 8,
  },
  estimatePillText: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
  },
  estimateButton: {
    alignSelf: 'flex-start',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  estimateButtonPressed: {
    opacity: 0.72,
  },
  estimateButtonText: {
    color: Theme.colors.primary,
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
    color: Theme.colors.textSecondary,
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
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: Theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  customInput: {
    flex: 1,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    paddingVertical: 8,
  },
  inputUnit: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.button,
    minHeight: 42,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  saveButtonPressed: {
    backgroundColor: Theme.colors.primaryPressed,
  },
  saveButtonDisabled: {
    backgroundColor: Theme.colors.surfaceMuted,
  },
  saveButtonText: {
    color: Theme.colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
  },
  saveButtonTextDisabled: {
    color: Theme.colors.textSecondary,
  },
  aboutSection: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 16,
  },
  aboutText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  aboutVersion: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.border,
    marginTop: 4,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Theme.colors.backdrop,
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: Theme.colors.surface,
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
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 18,
    lineHeight: 24,
  },
  modalDescription: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: Theme.colors.border,
  },
  modalScrollContent: {
    paddingBottom: 2,
  },
  profileCard: {
    gap: 14,
  },
  modalSectionBlock: {
    gap: 10,
  },
  profileTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
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
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  weightInputShell: {
    width: 104,
    minHeight: 40,
    backgroundColor: Theme.colors.surface,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  weightInput: {
    flex: 1,
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    paddingVertical: 6,
  },
  weightUnit: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
  },
  profileDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.border,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineChoiceBlock: {
    gap: 8,
  },
  choiceLabel: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
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
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  activityCardSelected: {
    backgroundColor: Theme.colors.primarySoft,
    borderColor: Theme.colors.primaryBorder,
  },
  activityCardPressed: {
    opacity: 0.86,
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  activityTitleSelected: {
    color: Theme.colors.primary,
  },
  activitySubtitle: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  activitySubtitleSelected: {
    color: Theme.colors.primary,
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
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  smallOptionCardSelected: {
    backgroundColor: Theme.colors.primarySoft,
    borderColor: Theme.colors.primaryBorder,
  },
  smallOptionTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  smallOptionTitleSelected: {
    color: Theme.colors.primary,
  },
  smallOptionSubtitle: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 4,
  },
  smallOptionSubtitleSelected: {
    color: Theme.colors.primary,
  },
  resultCard: {
    minHeight: 118,
    backgroundColor: Theme.colors.primarySoft,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    padding: 14,
    marginTop: 2,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  resultCopy: {
    flex: 1,
    zIndex: 1,
  },
  resultTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    lineHeight: 21,
  },
  resultDescription: {
    color: Theme.colors.textSecondary,
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
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 38,
    lineHeight: 44,
  },
  resultUnit: {
    color: Theme.colors.textSecondary,
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
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  resultIllustration: {
    width: 86,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  resultVisualSlot: {
    width: 78,
    height: 78,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.primaryBorder,
    backgroundColor: Theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultVisualMark: {
    width: 24,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.primaryBorder,
    backgroundColor: Theme.colors.primarySoft,
  },
  modalSecondaryButton: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    borderRadius: Theme.radius.button,
  },
  modalSecondaryButtonPressed: {
    backgroundColor: Theme.colors.surfaceMuted,
  },
  modalSecondaryText: {
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
  },
  modalPrimaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 18,
  },
  modalPrimaryText: {
    color: Theme.colors.surface,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
  },
});
