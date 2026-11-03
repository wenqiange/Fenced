/**
 * @fenced/blocking — JS façade over the native shield.
 *
 * Two modes, always reported honestly via `getCapabilities().mode`:
 *  - "native":  a compiled binary with the Expo module below is present.
 *  - "sandbox": Expo Go / web / simulator without the binary. Nothing is
 *               blocked at the OS level; the app can preview and *simulate*
 *               shield hits in-app so the whole flow is demonstrable.
 */

export type AuthorizationStatus = "notDetermined" | "denied" | "approved" | "unavailable";

export type BlockingMode = "native" | "sandbox";

export interface PlatformCapabilities {
  platform: "ios" | "android" | "web" | "unknown";
  mode: BlockingMode;
  canBlockApps: boolean;
  canSelectCategories: boolean;
  requiresUsageAccess: boolean;
  /** Kept for older call sites: true whenever mode is "sandbox". */
  practiceOnly: boolean;
  notes: string;
}

export interface ShieldSelection {
  /** Opaque platform tokens (iOS ApplicationToken / Android package names). */
  appTokens: string[];
  categoryTokens: string[];
}

export interface ShieldHitEvent {
  /** Display name when the platform exposes one (Android); iOS never does. */
  appName: string | null;
  categoryId: string | null;
  at: string;
  simulated: boolean;
}

/**
 * Contract the native module must implement (Swift: FencedBlockingModule
 * using FamilyControls + ManagedSettings + DeviceActivity; Kotlin:
 * com.fenced.blocking.FencedBlockingModule using UsageStatsManager polling
 * + an overlay Activity). All methods are async on the native side.
 *
 * Events (Expo Modules EventEmitter):
 *  - "onShieldHit": ShieldHitEvent — iOS from a ShieldAction extension via
 *    App Group, Android when the foreground app is in the selection.
 */
export interface NativeFencedBlocking {
  getAuthorizationStatus(): Promise<AuthorizationStatus>;
  /** iOS: AuthorizationCenter.requestAuthorization(for: .individual). */
  requestAuthorization(): Promise<AuthorizationStatus>;
  /** Android only: opens Settings › Usage access. */
  openUsageAccessSettings?(): Promise<void>;
  /** iOS: FamilyActivityPicker. Android: in-app list of launchable packages. */
  presentAppPicker(preselectedCategories: string[]): Promise<ShieldSelection>;
  /** iOS: ManagedSettingsStore.shield = selection. Android: start monitor. */
  applyShield(selection: ShieldSelection): Promise<{ applied: boolean }>;
  clearShield(): Promise<void>;
  /** Emergency pass: lift the shield, re-apply automatically after N s. */
  pauseShield?(seconds: number): Promise<void>;
  addListener?(event: "onShieldHit", cb: (e: ShieldHitEvent) => void): { remove(): void };
}

// ─── Sandbox catalog ────────────────────────────────────────────────────────

export interface SandboxApp {
  id: string;
  name: string;
  /** Ionicons glyph; the app renders it. */
  icon: string;
}

export interface SandboxCategory {
  id: string;
  label: string;
  icon: string;
  apps: SandboxApp[];
}

/** Realistic examples so the picker and simulator feel like the real thing. */
export const SANDBOX_CATALOG: SandboxCategory[] = [
  {
    id: "social",
    label: "Social",
    icon: "people-outline",
    apps: [
      { id: "instagram", name: "Instagram", icon: "logo-instagram" },
      { id: "facebook", name: "Facebook", icon: "logo-facebook" },
      { id: "x", name: "X", icon: "logo-twitter" },
      { id: "snapchat", name: "Snapchat", icon: "logo-snapchat" },
      { id: "reddit", name: "Reddit", icon: "logo-reddit" },
    ],
  },
  {
    id: "video",
    label: "Short-form Video",
    icon: "play-circle-outline",
    apps: [
      { id: "tiktok", name: "TikTok", icon: "logo-tiktok" },
      { id: "youtube", name: "YouTube", icon: "logo-youtube" },
      { id: "twitch", name: "Twitch", icon: "logo-twitch" },
    ],
  },
  {
    id: "games",
    label: "Games",
    icon: "game-controller-outline",
    apps: [
      { id: "clash", name: "Clash Royale", icon: "game-controller-outline" },
      { id: "candy", name: "Candy Crush", icon: "game-controller-outline" },
      { id: "roblox", name: "Roblox", icon: "cube-outline" },
    ],
  },
  {
    id: "messaging",
    label: "Messaging",
    icon: "chatbubbles-outline",
    apps: [
      { id: "whatsapp", name: "WhatsApp", icon: "logo-whatsapp" },
      { id: "discord", name: "Discord", icon: "logo-discord" },
      { id: "telegram", name: "Telegram", icon: "paper-plane-outline" },
    ],
  },
  {
    id: "news",
    label: "News",
    icon: "newspaper-outline",
    apps: [
      { id: "news", name: "News", icon: "newspaper-outline" },
      { id: "flipboard", name: "Flipboard", icon: "book-outline" },
    ],
  },
  {
    id: "shopping",
    label: "Shopping",
    icon: "bag-handle-outline",
    apps: [
      { id: "amazon", name: "Amazon", icon: "logo-amazon" },
      { id: "temu", name: "Temu", icon: "pricetag-outline" },
    ],
  },
  {
    id: "browsers",
    label: "Browsers",
    icon: "globe-outline",
    apps: [
      { id: "safari", name: "Safari", icon: "compass-outline" },
      { id: "chrome", name: "Chrome", icon: "logo-chrome" },
    ],
  },
];

export function sandboxAppsFor(selection: ShieldSelection): SandboxApp[] {
  const out: SandboxApp[] = [];
  for (const cat of SANDBOX_CATALOG) {
    for (const app of cat.apps) {
      if (selection.categoryTokens.includes(cat.id) || selection.appTokens.includes(app.id)) out.push(app);
    }
  }
  return out;
}

// ─── Module ─────────────────────────────────────────────────────────────────

const getRN = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("react-native");
  } catch {
    return null;
  }
};

type Listener = (e: ShieldHitEvent) => void;

class FencedBlockingModule {
  private authorized: AuthorizationStatus = "notDetermined";
  private active = false;
  private pausedUntil = 0;
  private selection: ShieldSelection = { appTokens: [], categoryTokens: [] };
  private listeners = new Set<Listener>();
  private nativeSub: { remove(): void } | null = null;

  /** Expo Modules register on globalThis.expo.modules; legacy on NativeModules. */
  private native(): NativeFencedBlocking | null {
    const g = globalThis as { expo?: { modules?: Record<string, unknown> } };
    const expoMod = g.expo?.modules?.FencedBlocking as NativeFencedBlocking | undefined;
    return expoMod ?? (getRN()?.NativeModules?.FencedBlockingModule as NativeFencedBlocking | undefined) ?? null;
  }

  getCapabilities(): PlatformCapabilities {
    const os = getRN()?.Platform?.OS ?? "unknown";
    const isIOS = os === "ios";
    const isAndroid = os === "android";
    const hasNative = Boolean(this.native());
    return {
      platform: isIOS ? "ios" : isAndroid ? "android" : os === "web" ? "web" : "unknown",
      mode: hasNative ? "native" : "sandbox",
      canBlockApps: hasNative,
      canSelectCategories: true,
      requiresUsageAccess: isAndroid,
      practiceOnly: !hasNative,
      notes: hasNative
        ? `Native ${isIOS ? "Screen Time" : "Usage Access"} bridge active.`
        : "Shield Sandbox: no apps are blocked on this build. You can preview and simulate the shield inside Fenced.",
    };
  }

  isSandbox(): boolean {
    return !this.native();
  }

  async getAuthorizationStatus(): Promise<AuthorizationStatus> {
    const n = this.native();
    return n ? n.getAuthorizationStatus() : this.authorized;
  }

  async requestAuthorization(): Promise<AuthorizationStatus> {
    const n = this.native();
    this.authorized = n ? await n.requestAuthorization() : "approved";
    return this.authorized;
  }

  async openUsageAccessSettings(): Promise<void> {
    await this.native()?.openUsageAccessSettings?.();
  }

  async presentAppPicker(preselectedCategories: string[] = []): Promise<ShieldSelection> {
    const n = this.native();
    this.selection = n
      ? await n.presentAppPicker(preselectedCategories)
      : { appTokens: [], categoryTokens: [...preselectedCategories] };
    return this.selection;
  }

  async applyShield(selection?: ShieldSelection): Promise<{ applied: boolean; practice: boolean }> {
    if (selection) this.selection = selection;
    this.active = true;
    this.pausedUntil = 0;
    const n = this.native();
    if (!n) return { applied: false, practice: true };
    if (!this.nativeSub && n.addListener) {
      this.nativeSub = n.addListener("onShieldHit", (e) => this.emit(e));
    }
    const res = await n.applyShield(this.selection);
    return { applied: res.applied, practice: false };
  }

  async clearShield(): Promise<void> {
    this.active = false;
    this.pausedUntil = 0;
    this.nativeSub?.remove();
    this.nativeSub = null;
    await this.native()?.clearShield();
  }

  /** Emergency pass: lowers the shield for `seconds`, then re-arms itself. */
  async pauseShield(seconds: number): Promise<void> {
    this.pausedUntil = Date.now() + seconds * 1000;
    const n = this.native();
    if (n?.pauseShield) {
      await n.pauseShield(seconds);
      return;
    }
    if (n) {
      await n.clearShield();
      setTimeout(() => {
        if (this.active) void n.applyShield(this.selection);
      }, seconds * 1000);
    }
  }

  isShieldActive(): boolean {
    return this.active && Date.now() >= this.pausedUntil;
  }

  getSelection(): ShieldSelection {
    return this.selection;
  }

  onShieldHit(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Sandbox only: pretend the user opened a fenced app. Returns false (and
   * emits nothing) when the shield is down, like the real thing would.
   */
  simulateDistraction(app: SandboxApp | null = null): boolean {
    if (!this.isShieldActive()) return false;
    const cat = app ? SANDBOX_CATALOG.find((c) => c.apps.some((a) => a.id === app.id)) : null;
    this.emit({ appName: app?.name ?? null, categoryId: cat?.id ?? null, at: new Date().toISOString(), simulated: true });
    return true;
  }

  private emit(e: ShieldHitEvent) {
    for (const l of this.listeners) l(e);
  }
}

export const FencedBlocking = new FencedBlockingModule();
