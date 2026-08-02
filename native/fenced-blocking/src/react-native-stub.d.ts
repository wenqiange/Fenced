declare module "react-native" {
  export const NativeModules: Record<string, any>;
  export const Platform: {
    OS: "ios" | "android" | "web" | "windows" | "macos" | string;
    select: <T>(obj: Record<string, T>) => T;
  };
}
