import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

export function AppText(props: TextProps) {
  return <NativeText {...props} allowFontScaling={false} maxFontSizeMultiplier={1} />;
}

export function AppTextInput(props: TextInputProps) {
  return <NativeTextInput {...props} allowFontScaling={false} maxFontSizeMultiplier={1} />;
}
