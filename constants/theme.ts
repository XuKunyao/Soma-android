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
  background: '#1F1A17',
  surface: '#29231F',
  surfaceMuted: '#352E29',
  primarySoft: '#3A2A24',
  primaryBorder: '#674434',
  primary: '#E18A68',
  primaryPressed: '#C86D4B',
  text: '#F4EFE8',
  textSecondary: '#B9AEA5',
  border: '#463D36',
  success: '#A3B894',
  successSoft: '#2E392D',
  danger: '#F08A72',
  dangerSoft: '#3B2923',
  trackBackground: '#3B342F',
  backdrop: 'rgba(10, 8, 7, 0.56)',
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
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
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
