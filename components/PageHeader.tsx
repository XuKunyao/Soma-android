import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AppText as Text } from '@/components/fixed-scale-text';
import { Theme } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useAppTheme';
import type { ResolvedLanguage } from '@/utils/storage';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  language: ResolvedLanguage;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  language,
  style,
  titleStyle,
  subtitleStyle,
  children,
}: PageHeaderProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors, language), [colors, language]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.copy}>
        <Text
          style={[styles.title, titleStyle]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.92}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, subtitleStyle]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.9}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function createStyles(colors: typeof Theme.colors, language: ResolvedLanguage) {
  const displayFont = language === 'en' ? Theme.fonts.displayEn : Theme.fonts.display;

  return StyleSheet.create({
    container: {
      paddingTop: 8,
      paddingBottom: 6,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.text,
      fontFamily: displayFont,
      fontSize: Theme.type.pageTitle + 2,
      fontWeight: '600',
      lineHeight: 46,
      letterSpacing: 0,
      includeFontPadding: true,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: displayFont,
      fontSize: 15,
      lineHeight: 24,
      marginTop: 6,
    },
  });
}
