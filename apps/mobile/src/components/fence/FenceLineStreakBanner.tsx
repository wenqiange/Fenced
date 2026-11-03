import { memo, useMemo, useRef } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInRight, useReducedMotion } from "react-native-reanimated";
import Svg, { Line, Polygon, Rect } from "react-native-svg";
import { fenceMaterial, motion, type FenceMaterial } from "@fenced/ui";
import { useAppSelector } from "../../hooks/use-app-state";
import { currentStreak, fenceLine, type FenceLineDay } from "../../lib/stats";
import { useThemeColors } from "../../lib/theme";
import { Txt } from "../ui";

const DAY_W = 30;
const H = 56;

/** Wood richness from minutes focused: more time, deeper and taller panel. */
function richness(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.min(1, 0.35 + minutes / 180);
}

/**
 * The fence line: one panel per day, oldest left, today right. Descriptive,
 * never loss-framed (UK Children's Code): it states the length, and a quiet
 * day is just a stretch with posts and no pickets yet.
 */
export const FenceLineStreakBanner = memo(function FenceLineStreakBanner({
  days = 21,
  styleId,
  showSummary = true,
}: {
  days?: number;
  styleId?: string;
  showSummary?: boolean;
}) {
  const t = useThemeColors();
  const history = useAppSelector((s) => s.sessionHistory);
  const settingsStyle = useAppSelector((s) => s.settings.fenceStyle);
  const m = fenceMaterial(styleId ?? settingsStyle);
  const line = useMemo(() => fenceLine(history, days), [history, days]);
  const streak = useMemo(() => currentStreak(history), [history]);
  const scroll = useRef<ScrollView>(null);
  const reduce = useReducedMotion();
  const totalMinutes = line.reduce((s, d) => s + d.minutes, 0);

  return (
    <View>
      {showSummary && (
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <Txt variant="headline">
            {streak > 0 ? `Your fence line is ${streak} day${streak === 1 ? "" : "s"} long` : "Start your fence line today"}
          </Txt>
          <Txt variant="caption" tone="muted" numeric>
            {Math.round(totalMinutes / 60)}h · {days}d
          </Txt>
        </View>
      )}
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        accessibilityLabel={`Fence line for the last ${days} days. ${line.filter((d) => d.sessions > 0).length} days with focus sessions.`}
        contentContainerStyle={{ paddingRight: 4 }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          {line.map((d, i) => (
            <Animated.View
              key={d.key}
              entering={!reduce && i === line.length - 1 ? FadeInRight.duration(motion.streakExtend) : undefined}
            >
              <DayPanel day={d} m={m} isToday={i === line.length - 1} mutedInk={t.textMuted} accent={t.accent} />
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
});

const DayPanel = memo(function DayPanel({
  day,
  m,
  isToday,
  mutedInk,
  accent,
}: {
  day: FenceLineDay;
  m: FenceMaterial;
  isToday: boolean;
  mutedInk: string;
  accent: string;
}) {
  const r = richness(day.minutes);
  const pickets = 3;
  const pw = 6;
  const gap = (DAY_W - 4 - pickets * pw) / (pickets + 1);
  const label = day.date.toLocaleDateString(undefined, { weekday: "narrow" });

  return (
    <View
      accessible
      accessibilityLabel={`${day.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${
        day.minutes > 0 ? `${day.minutes} minutes focused` : "no sessions"
      }${day.repaired ? ", emergency pass used" : ""}`}
      style={{ width: DAY_W, alignItems: "center" }}
    >
      <Svg width={DAY_W} height={H}>
        {/* Rails run continuously across days: the line stays connected. */}
        <Rect x={0} y={H * 0.38} width={DAY_W} height={3} fill={m.rail} opacity={r > 0 ? 1 : 0.35} />
        <Rect x={0} y={H * 0.72} width={DAY_W} height={3} fill={m.rail} opacity={r > 0 ? 1 : 0.35} />
        {r > 0 &&
          Array.from({ length: pickets }, (_, i) => {
            const x = 2 + gap * (i + 1) + pw * i;
            const top = H * (1 - (0.55 + 0.4 * r));
            return (
              <Polygon
                key={i}
                points={`${x},${top + 4} ${x + pw / 2},${top} ${x + pw},${top + 4} ${x + pw},${H} ${x},${H}`}
                fill={m.picket}
                opacity={0.45 + 0.55 * r}
              />
            );
          })}
        {/* Repaired joint: a diagonal brace, craft rather than damage. */}
        {day.repaired && (
          <Line x1={3} y1={H * 0.74} x2={DAY_W - 3} y2={H * 0.4} stroke={m.latch} strokeWidth={2} strokeLinecap="round" />
        )}
        <Rect x={0} y={H * 0.2} width={2.5} height={H * 0.8} fill={m.post} />
      </Svg>
      <Txt variant="micro" style={{ color: isToday ? accent : mutedInk, marginTop: 4 }}>
        {label}
      </Txt>
    </View>
  );
});
