/**
 * Soma design system: warm, quiet, restrained.
 */

export type ThemeColorScheme = 'light' | 'dark';

export const LightColors = {
  background: '#F5F0E8',
  surface: '#FDFAF4',
  surfaceMuted: '#EFE9DF',
  primarySoft: '#F8EEE7',
  primaryBorder: '#F0D8CC',
  primary: '#D97757',
  primaryPressed: '#C4633E',
  text: '#1A1612',
  textSecondary: '#6B6560',
  border: '#E8E2D9',
  success: '#7A9A6D',
  successSoft: '#ECF1E8',
  danger: '#C65A45',
  dangerSoft: '#F7E7DD',
  trackBackground: '#EDE8DF',
  backdrop: 'rgba(26, 22, 18, 0.30)',
};

export const DarkColors = {
  background: '#1F1F1C',
  surface: '#2D2D2A',
  surfaceMuted: '#252522',
  primarySoft: '#3A312B',
  primaryBorder: '#5F4639',
  primary: '#D97757',
  primaryPressed: '#B96649',
  text: '#F3EFE4',
  textSecondary: '#A9A59C',
  border: '#44413A',
  success: '#A8B894',
  successSoft: '#30362B',
  danger: '#E07A61',
  dangerSoft: '#3A2B25',
  trackBackground: '#383631',
  backdrop: 'rgba(12, 12, 10, 0.62)',
};

export type ThemeColors = typeof LightColors;

export const Theme = {
  colors: LightColors,
  darkColors: DarkColors,
  radius: {
    button: 14,
    card: 16,
    input: 12,
    full: 9999,
  },
  animation: {
    duration: 350,
    easing: 'ease-in-out',
  },
  type: {
    pageTitle: 28,
    sectionTitle: 17,
    body: 14,
    caption: 12,
    metric: 42,
  },
  shadow: {
    card: {
      color: '#1A1612',
      opacity: 0.05,
      radius: 3,
      offsetY: 1,
      elevation: 1,
    },
    floating: {
      color: '#1A1612',
      opacity: 0.08,
      radius: 18,
      offsetY: 12,
      elevation: 0,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  fonts: {
    regular: 'AnthropicSans_400Regular',
    medium: 'AnthropicSans_500Medium',
    display: 'NotoSerifSC_400Regular',
    displayEn: 'AnthropicSerif_600SemiBold',
  },
};

export const Colors = {
  light: {
    text: LightColors.text,
    background: LightColors.background,
    tint: LightColors.primary,
    icon: LightColors.textSecondary,
    tabIconDefault: LightColors.textSecondary,
    tabIconSelected: LightColors.primary,
  },
  dark: {
    text: DarkColors.text,
    background: DarkColors.background,
    tint: DarkColors.primary,
    icon: DarkColors.textSecondary,
    tabIconDefault: DarkColors.textSecondary,
    tabIconSelected: DarkColors.primary,
  },
};
