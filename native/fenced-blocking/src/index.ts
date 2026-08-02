export type AuthorizationStatus =
  | "notDetermined"
  | "denied"
  | "approved"
  | "unavailable";

export interface PlatformCapabilities {
  platform: "ios" | "android" | "web" | "unknown";
  canBlockApps: boolean;
  canSelectCategories: boolean;
  requiresUsageAccess: boolean;
  practiceOnly: boolean;
  notes: string;
}

export interface ShieldSelection {
  appTokens: string[];
  categoryTokens: string[];
}

const getRN = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("react-native");
  } catch {
    return null;
  }
};

/**
 * JS façade for the native blocking module.
 * Dynamically binds to iOS FamilyControls / Android UsageStats NativeModules when compiled into native binary.
 */
class FencedBlockingModule {
  private authorized: AuthorizationStatus = "notDetermined";
  private active = false;
  private selection: ShieldSelection = { appTokens: [], categoryTokens: [] };

  private getNativeModule() {
    const rn = getRN();
    return rn?.NativeModules?.FencedBlockingModule ?? null;
  }

  getCapabilities(): PlatformCapabilities {
    const rn = getRN();
    const os = rn?.Platform?.OS ?? "unknown";
    const isIOS = os === "ios";
    const isAndroid = os === "android";
    const nativeMod = this.getNativeModule();
    const hasNative = Boolean(nativeMod);

    return {
      platform: isIOS ? "ios" : isAndroid ? "android" : os === "web" ? "web" : "unknown",
      canBlockApps: hasNative,
      canSelectCategories: true,
      requiresUsageAccess: isAndroid,
      practiceOnly: !hasNative,
      notes: hasNative
        ? `Native ${isIOS ? "Screen Time" : "Usage Access"} bridge active.`
        : `Native bridge not linked. Sessions running in practice mode.`,
    };
  }

  async getAuthorizationStatus(): Promise<AuthorizationStatus> {
    const nativeMod = this.getNativeModule();
    if (nativeMod?.getAuthorizationStatus) {
      return await nativeMod.getAuthorizationStatus();
    }
    return this.authorized;
  }

  async requestAuthorization(): Promise<AuthorizationStatus> {
    const nativeMod = this.getNativeModule();
    if (nativeMod?.requestAuthorization) {
      this.authorized = await nativeMod.requestAuthorization();
      return this.authorized;
    }
    this.authorized = "approved"; // Practice mode fallback
    return this.authorized;
  }

  async openUsageAccessSettings(): Promise<void> {
    const nativeMod = this.getNativeModule();
    if (nativeMod?.openUsageAccessSettings) {
      await nativeMod.openUsageAccessSettings();
    }
  }

  async presentAppPicker(preselectedCategories: string[] = []): Promise<ShieldSelection> {
    const nativeMod = this.getNativeModule();
    if (nativeMod?.presentAppPicker) {
      this.selection = await nativeMod.presentAppPicker(preselectedCategories);
      return this.selection;
    }
    this.selection = {
      appTokens: [],
      categoryTokens: [...preselectedCategories],
    };
    return this.selection;
  }

  async applyShield(selection?: ShieldSelection): Promise<{ applied: boolean; practice: boolean }> {
    if (selection) this.selection = selection;
    this.active = true;
    const nativeMod = this.getNativeModule();
    if (nativeMod?.applyShield) {
      const res = await nativeMod.applyShield(this.selection);
      return { applied: res.applied, practice: false };
    }
    return { applied: false, practice: true };
  }

  async clearShield(): Promise<void> {
    this.active = false;
    const nativeMod = this.getNativeModule();
    if (nativeMod?.clearShield) {
      await nativeMod.clearShield();
    }
  }

  isShieldActive(): boolean {
    return this.active;
  }

  getSelection(): ShieldSelection {
    return this.selection;
  }
}

export const FencedBlocking = new FencedBlockingModule();
