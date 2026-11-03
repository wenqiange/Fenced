import { forwardRef } from "react";
import { Pressable, type PressableProps, type View, type ViewStyle, type StyleProp } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { springs } from "@fenced/ui";
import { hapticSelection, hapticTaskCheck } from "../../lib/haptics";

const APressable = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  /** Scale on press-in. 1 disables the effect. */
  pressScale?: number;
  haptic?: "none" | "selection" | "soft";
}

/**
 * The house pressable: springs to 0.97 on touch-down (feedback lands before
 * the finger lifts), optional haptic, and a 44pt minimum hit area via hitSlop.
 */
export const AnimatedPressable = forwardRef<View, AnimatedPressableProps>(function AnimatedPressable(
  { pressScale = 0.97, haptic = "none", onPressIn, onPressOut, onPress, style, hitSlop = 8, disabled, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <APressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={hitSlop}
      disabled={disabled}
      onPressIn={(e) => {
        if (!reduce && pressScale !== 1) scale.value = withSpring(pressScale, springs.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, springs.press);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic === "selection") hapticSelection();
        else if (haptic === "soft") hapticTaskCheck();
        onPress?.(e);
      }}
      style={[style, animated, disabled && { opacity: 0.45 }]}
      {...rest}
    />
  );
});
