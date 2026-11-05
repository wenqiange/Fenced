import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { encodeWav, renderAmbient, renderSfx, type AmbientId, type SfxId } from "./audio/synth";
import { getAppState } from "./local-store";

export type { AmbientId, SfxId } from "./audio/synth";

export const AMBIENT_SOUNDS: { id: AmbientId; label: string; description: string }[] = [
  { id: "rain", label: "Forest rain", description: "Pink noise — steady, soft rainfall" },
  { id: "hearth", label: "Warm hearth", description: "Brown noise — low, enveloping rumble" },
  { id: "white-noise", label: "White noise", description: "Even across every frequency; masks chatter" },
  { id: "waves", label: "Binaural 40 Hz", description: "200/240 Hz tones per ear. Use headphones." },
];

// Bump when synthesis changes so stale cached files are regenerated.
const CACHE_VERSION = 1;

function fileFor(name: string, render: () => Uint8Array): string {
  if (Platform.OS === "web") {
    const bytes = render();
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  }
  const file = new File(Paths.cache, `fenced-${name}-v${CACHE_VERSION}.wav`);
  if (!file.exists) {
    file.create();
    file.write(render());
  }
  return file.uri;
}

const SFX_MODE = {
  playsInSilentMode: false,
  shouldPlayInBackground: false,
} as const;

const FOCUS_MODE = {
  playsInSilentMode: true,
  shouldPlayInBackground: true,
} as const;

let currentMode: "sfx" | "focus" | null = null;

async function setMode(mode: "sfx" | "focus") {
  if (currentMode === mode) return;
  try {
    await setAudioModeAsync(mode === "focus" ? FOCUS_MODE : SFX_MODE);
    currentMode = mode;
  } catch {
    currentMode = null;
  }
}

let ambient: { id: AmbientId; player: AudioPlayer } | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

function clearFade() {
  if (fadeTimer) clearInterval(fadeTimer);
  fadeTimer = null;
}

/** Linear ramp; avoids the click of starting/stopping a loud loop at once. */
function rampVolume(player: AudioPlayer, to: number, ms: number, done?: () => void) {
  clearFade();
  const from = player.volume;
  const steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  fadeTimer = setInterval(() => {
    i += 1;
    player.volume = from + ((to - from) * i) / steps;
    if (i >= steps) {
      clearFade();
      done?.();
    }
  }, 40);
}

export async function playAmbient(id: AmbientId | "silence", volume = getAppState().settings.soundVolume) {
  if (id === "silence") return stopAmbient();
  if (ambient?.id === id) {
    rampVolume(ambient.player, volume, 200);
    if (!ambient.player.playing) ambient.player.play();
    return;
  }
  await stopAmbient(150);
  await setMode("focus");
  try {
    const uri = fileFor(`ambient-${id}`, () => {
      const [l, r] = renderAmbient(id);
      return encodeWav(l, r);
    });
    const player = createAudioPlayer(uri);
    player.loop = true;
    player.volume = 0;
    player.play();
    ambient = { id, player };
    rampVolume(player, volume, 600);
  } catch {
    ambient = null;
  }
}

export function setAmbientVolume(volume: number) {
  if (!ambient) return;
  clearFade();
  ambient.player.volume = volume;
}

export function stopAmbient(fadeMs = 400): Promise<void> {
  const current = ambient;
  ambient = null;
  if (!current) return Promise.resolve();
  return new Promise((resolve) => {
    rampVolume(current.player, 0, fadeMs, () => {
      current.player.pause();
      current.player.remove();
      void setMode("sfx");
      resolve();
    });
  });
}

export function currentAmbient(): AmbientId | null {
  return ambient?.id ?? null;
}

const sfxPlayers = new Map<SfxId, AudioPlayer>();

/** Short cues. Respect the user's "sound effects" switch and silent mode switch. */
export async function playSfx(id: SfxId) {
  if (!getAppState().settings.soundEffects) return;
  if (!ambient) {
    await setMode("sfx");
  }
  try {
    let player = sfxPlayers.get(id);
    if (!player) {
      player = createAudioPlayer(fileFor(`sfx-${id}`, () => encodeWav(renderSfx(id))));
      sfxPlayers.set(id, player);
    }
    player.volume = 0.8;
    await player.seekTo(0);
    player.play();
  } catch {
    /* sound is decoration; never let it break a flow */
  }
}
