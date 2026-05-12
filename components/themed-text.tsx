import { StyleSheet, Text, type TextProps } from 'react-native';

import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const colors = useThemeColors();
  const color = type === 'link' ? colors.primary : colors.text;

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Theme.fonts.regular,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Theme.fonts.medium,
  },
  title: {
    fontSize: 32,
    lineHeight: 32,
    fontFamily: Theme.fonts.medium,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.medium,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
  },
});