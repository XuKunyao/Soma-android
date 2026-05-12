import { useColorScheme } from 'react-native';
import { DarkColors, LightColors, type ThemeColorScheme } from '@/constants/theme';
import { useWater } from '@/contexts/WaterContext';
import type { AppearancePreference } from '@/utils/storage';

export function resolveThemeScheme(
  appearance: AppearancePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): ThemeColorScheme {
  if (appearance === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }

  return appearance;
}

export function useAppTheme() {
  const systemScheme = useColorScheme();
  const { state } = useWater();
  const scheme = resolveThemeScheme(state.settings.appearance, systemScheme);
  const colors = scheme === 'dark' ? DarkColors : LightColors;

  return {
    colors,
    colorScheme: scheme,
    isDark: scheme === 'dark',
  };
}

export function useThemeColors() {
  return useAppTheme().colors;
}