import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="age" />
      <Stack.Screen name="guardian" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="intent" />
      <Stack.Screen name="sources" />
      <Stack.Screen name="explainer" />
      <Stack.Screen name="first-session" />
    </Stack>
  );
}
