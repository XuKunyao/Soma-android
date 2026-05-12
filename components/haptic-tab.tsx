import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useWater } from '@/contexts/WaterContext';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { state } = useWater();

  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (state.settings.hapticsEnabled && process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}