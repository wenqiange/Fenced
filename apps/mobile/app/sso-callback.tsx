import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../src/lib/auth";

WebBrowser.maybeCompleteAuthSession();

export default function SSOCallbackScreen() {
  const auth = useAuth();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (auth.isLoaded && auth.isSignedIn) {
      router.replace("/(tabs)");
    }
  }, [auth.isLoaded, auth.isSignedIn]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0f12",
  },
});
