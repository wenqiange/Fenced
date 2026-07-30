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

/**
 * JS façade for the native blocking module.
 * Real iOS FamilyControls / Android UsageStats bridges land here later.
 * Until then every call is practice-mode safe.
 */
class FencedBlockingModule {
  private authorized: AuthorizationStatus = "notDetermined";
  private active = false;
  private selection: ShieldSelection = { appTokens: [], categoryTokens: [] };

  getCapabilities(): PlatformCapabilities {
    // Native detection arrives with the Expo module; assume practice-only for now.
    return {
      platform: "unknown",
      canBlockApps: false,
      canSelectCategories: true,
      requiresUsageAccess: false,
      practiceOnly: true,
      notes:
        "Native Screen Time / Usage Access bridge not linked yet. Sessions run in practice mode.",
    };
  }

  async getAuthorizationStatus(): Promise<AuthorizationStatus> {
    return this.authorized;
  }

  async requestAuthorization(): Promise<AuthorizationStatus> {
    // Simulate a grant so product flows can be exercised without native code.
    this.authorized = "unavailable";
    return this.authorized;
  }

  async openUsageAccessSettings(): Promise<void> {
    // Android-only; no-op until Kotlin module ships.
  }

  async presentAppPicker(preselectedCategories: string[] = []): Promise<ShieldSelection> {
    this.selection = {
      appTokens: [],
      categoryTokens: [...preselectedCategories],
    };
    return this.selection;
  }

  async applyShield(selection?: ShieldSelection): Promise<{ applied: boolean; practice: boolean }> {
    if (selection) this.selection = selection;
    this.active = true;
    return { applied: false, practice: true };
  }

  async clearShield(): Promise<void> {
    this.active = false;
  }

  isShieldActive(): boolean {
    return this.active;
  }

  getSelection(): ShieldSelection {
    return this.selection;
  }
}

export const FencedBlocking = new FencedBlockingModule();
