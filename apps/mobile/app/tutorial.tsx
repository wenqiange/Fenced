import React from "react";
import { router } from "expo-router";
import { AppTutorialModal } from "../src/components/tutorial";

export default function TutorialScreen() {
  return (
    <AppTutorialModal
      visible={true}
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)");
        }
      }}
    />
  );
}
