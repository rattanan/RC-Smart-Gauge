export type DemoLap = { index: number; duration: number };
export function demoTiming(elapsed: number) {
  const crossings: number[] = [];
  for (let cycle = 0; cycle <= Math.floor(elapsed / 87000); cycle++)
    for (const offset of [2000, 31000, 59000]) {
      const time = cycle * 87000 + offset;
      if (time + 200 <= elapsed) crossings.push(time);
    }
  const laps: DemoLap[] = crossings
    .slice(1)
    .map((time, i) => ({ index: i + 1, duration: time - crossings[i] }));
  const best = laps.reduce<DemoLap | null>(
    (best, lap) => (!best || lap.duration < best.duration ? lap : best),
    null,
  );
  return {
    laps,
    best,
    current: crossings.length ? elapsed - crossings.at(-1)! : null,
    seen: crossings.some((time) => elapsed - time < 800),
  };
}
export function formatTime(ms: number | null) {
  if (ms === null) return "—";
  return `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0")}:${((ms % 60000) / 1000).toFixed(1).padStart(4, "0")}`;
}
