/** Pure calendar geometry: no RN imports, unit-tested. */

export interface MonthCell {
  date: Date;
  inMonth: boolean;
}

/**
 * Monday-first month grid with exactly as many weeks as the month spans:
 * 35 cells usually, 42 when the 1st falls late and the month is long (e.g. a
 * 31-day month starting on Saturday) — the fixed 35 used to cut off the 30th/31st.
 */
export function monthMatrix(anchor: Date): MonthCell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => {
    const date = new Date(year, month, i - offset + 1);
    return { date, inMonth: date.getMonth() === month };
  });
}

export interface TimedItem {
  id: string;
  start: Date;
  end: Date;
}

export interface PlacedItem<T extends TimedItem> {
  item: T;
  /** Minutes from midnight, clamped to the day. */
  top: number;
  height: number;
  column: number;
  columns: number;
}

/**
 * Lays out one day's events: overlapping events share the width in columns,
 * like every calendar app. Minimum height keeps short events tappable.
 */
export function layoutDay<T extends TimedItem>(items: readonly T[], day: Date, minMinutes = 20): PlacedItem<T>[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const startMs = dayStart.getTime();
  const toMin = (d: Date) => Math.min(1440, Math.max(0, (d.getTime() - startMs) / 60_000));

  const sorted = [...items]
    .map((item) => ({ item, top: toMin(item.start), bottom: Math.max(toMin(item.end), toMin(item.start) + minMinutes) }))
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const out: PlacedItem<T>[] = [];
  let cluster: { top: number; bottom: number; col: number }[] = [];
  let clusterEnd = -1;
  let clusterStartIdx = 0;

  const flush = () => {
    const columns = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (let i = clusterStartIdx; i < out.length; i++) out[i].columns = columns;
  };

  for (const e of sorted) {
    if (e.top >= clusterEnd) {
      flush();
      cluster = [];
      clusterStartIdx = out.length;
    }
    // First column whose last event ended before this one starts.
    let col = 0;
    while (cluster.some((c) => c.col === col && c.bottom > e.top)) col++;
    cluster.push({ top: e.top, bottom: e.bottom, col });
    clusterEnd = Math.max(clusterEnd, e.bottom);
    out.push({ item: e.item, top: e.top, height: e.bottom - e.top, column: col, columns: 1 });
  }
  flush();
  return out;
}
