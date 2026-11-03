import { useEffect, useState } from "react";
import { View } from "react-native";
import { hapticPanelComplete, hapticPicketDrop } from "../../lib/haptics";
import { playSfx } from "../../lib/sound-engine";
import { useAppSelector } from "../../hooks/use-app-state";
import { Button, Txt } from "../ui";
import { FenceAssemblyView } from "./FenceAssemblyView";

const PICKETS = 8;
const STEP_MS = 380;

/**
 * Onboarding demo: one tap builds a panel in a few seconds, so "the fence gets
 * built while you focus" is shown, not explained. Runs only when asked.
 */
export function FenceDemo({ caption = "Each picket is a few minutes of focus." }: { caption?: string }) {
  const styleId = useAppSelector((s) => s.settings.fenceStyle);
  const [filled, setFilled] = useState(0);
  const [running, setRunning] = useState(false);
  const done = filled >= PICKETS;

  useEffect(() => {
    if (!running) return;
    if (done) {
      setRunning(false);
      void hapticPanelComplete();
      void playSfx("panel");
      return;
    }
    const id = setTimeout(() => {
      setFilled((f) => f + 1);
      hapticPicketDrop();
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [running, filled, done]);

  return (
    <View>
      <FenceAssemblyView
        progress={filled / PICKETS}
        pickets={PICKETS}
        styleId={styleId}
        state={done ? "complete" : "building"}
        accessibilityLabel={done ? "Demo fence panel, complete" : `Demo fence panel, ${filled} of ${PICKETS} pickets`}
      />
      <Txt variant="caption" tone="muted" align="center" style={{ marginTop: 8 }}>
        {done ? "Session done — panel complete. Days of these become your fence line." : caption}
      </Txt>
      <Button
        label={done ? "Build it again" : running ? "Building…" : "Watch a panel build"}
        kind="secondary"
        icon={done ? "refresh" : "hammer-outline"}
        disabled={running}
        onPress={() => {
          setFilled(0);
          setRunning(true);
        }}
        style={{ marginTop: 12 }}
      />
    </View>
  );
}
